"""F5 (light) — asset generation (P2: real LLM copy behind the seam).

Turns a brand profile + a one-line goal into a campaign of 4 assets (poster,
Instagram post, story, WhatsApp creative), each with text `slots` and style
`knobs`.

Copy (headline/subline/core_message) comes from the LLM copywriter when a key is
present (copywriter_llm.py), reading the brand's voice + do/dont rules; otherwise
from the deterministic regex headline below. Either path yields the same `slots`
shape, so the renderer and persistence don't change.

The facts rule: price/discount/dates are ALWAYS extracted from the owner's goal
in Python (`_extract_price`) — never written or invented by the model. `knobs`
stay deterministic (derived from positioning). The browser is the renderer, so
these shapes match exactly what `AssetPreview.jsx` consumes; knob values come
from `knobs.py` (the single source of truth).
"""

import logging
import re

from models import new_id
from schemas import BrandProfile, CreativeCore

logger = logging.getLogger(__name__)

# Per-format metadata the frontend expects (label + canonical export size).
FORMATS = [
    {"type": "poster", "label": "Poster", "size": "1080×1350"},
    {"type": "post", "label": "Instagram post", "size": "1080×1080"},
    {"type": "story", "label": "Story", "size": "1080×1920"},
    {"type": "whatsapp", "label": "WhatsApp creative", "size": "1080×1080"},
]

# Price badge: prefer an explicit ₹-amount anywhere in the goal; only fall back
# to a bare 2-5 digit number if there's no ₹ at all. A number immediately
# followed by "%" (e.g. "20% off") is a discount, not a price — excluded.
_RUPEE_RE = re.compile(r"₹\s?\d[\d,]*")
_BARE_NUM_RE = re.compile(r"(?<!\d)\d{2,5}(?!\s?%)(?!\d)")

# Per-format CTA — WhatsApp/story get channel-appropriate calls to action.
_CTA_BY_TYPE = {
    "poster": "Order on WhatsApp",
    "post": "Link in bio",
    "story": "Swipe up to order",
    "whatsapp": "Order on WhatsApp",
}


def _extract_price(goal: str) -> str | None:
    rupee = _RUPEE_RE.search(goal)
    if rupee:
        return "₹" + rupee.group(0).lstrip("₹").strip()
    bare = _BARE_NUM_RE.search(goal)
    return f"₹{bare.group(0)}" if bare else None


def _headline(goal: str, brand: BrandProfile) -> str:
    """Short headline from the goal. Strip a trailing price phrase so it doesn't
    repeat the badge, cap length, and fall back to the brand name."""
    text = _RUPEE_RE.sub("", goal)
    text = _BARE_NUM_RE.sub("", text)
    text = text.replace(" %", "").strip(" .,-–—%")
    text = re.sub(r"\s{2,}", " ", text)
    # Drop a preposition left dangling where a price phrase was removed
    # ("...burger at  this weekend" -> "...burger this weekend").
    text = re.sub(r"\b(at|for|just|only|from)\s+(?=this|now|today|$)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+(at|for|from)$", "", text, flags=re.IGNORECASE).strip()
    if not text:
        return brand.name
    # Keep it punchy — first clause, title-ish, bounded.
    first = re.split(r"[.!?\n]", text)[0].strip()
    headline = (first or text)[:60].strip()
    return headline[:1].upper() + headline[1:] if headline else brand.name


def _font_style(brand: BrandProfile) -> str:
    """Pick a font style from positioning: playful/modern -> display_bold,
    premium+classic -> serif_elegant, otherwise clean_sans."""
    p = brand.positioning
    if p.premium >= 70 and p.modern < 50:
        return "serif_elegant"
    if p.playful >= 60 or p.modern >= 70:
        return "display_bold"
    if p.playful < 35 and p.premium < 50:
        return "clean_sans"
    return "display_bold"


def _photo_tone(brand: BrandProfile) -> str:
    """Warm for playful/food-leaning brands, dark for premium, cool otherwise."""
    p = brand.positioning
    if p.premium >= 75:
        return "dark"
    if p.playful >= 55:
        return "warm"
    return "cool"


def _accent_usage(brand: BrandProfile) -> float:
    """More playful -> louder accent. Maps playful 0-100 onto 0.4-0.85."""
    return round(0.4 + (brand.positioning.playful / 100) * 0.45, 2)


def _base_knobs(brand: BrandProfile) -> dict:
    return {
        "density": "balanced",
        "font_style": _font_style(brand),
        "photo_tone": _photo_tone(brand),
        "accent_usage": _accent_usage(brand),
        "overlay": 0.4,
        "layout_variant": "left",
    }


# Per-format knob tweaks layered over the brand base, so the 4 assets don't
# look identical (stories get more vertical room + a stronger scrim, etc.).
_FORMAT_KNOB_OVERRIDES = {
    "poster": {"density": "open", "layout_variant": "left"},
    "post": {"density": "balanced", "layout_variant": "center"},
    "story": {"density": "open", "overlay": 0.5, "layout_variant": "center"},
    "whatsapp": {"density": "balanced", "layout_variant": "split"},
}


def _slots_for(fmt: str, brand: BrandProfile, headline: str, price: str | None, subline: str) -> dict:
    return {
        "headline": headline,
        "subline": subline,
        "price": price,
        "cta": _CTA_BY_TYPE.get(fmt, "Order now"),
        "logo": brand.name,
        "hero_image": None,
    }


def _heuristic_core(brand: BrandProfile, goal: str) -> CreativeCore:
    """The deterministic regex copy — the default and the LLM fallback. Writes
    WORDS only; price is added separately so this never embeds a number."""
    headline = _headline(goal, brand)
    subline = "This week only" if "week" in goal.lower() else brand.category
    core_message = ". ".join(part for part in (headline, "Limited time") if part)
    return CreativeCore(headline=headline, subline=subline, core_message=core_message)


async def _creative_core(brand: BrandProfile, goal: str) -> tuple[CreativeCore, str]:
    """Copy switch (same seam as P1): LLM when a key is present, else/on failure
    the regex heuristic. Returns (core, source) where source is 'llm'|'heuristic'
    — logged, not exposed. Never raises: a copy failure degrades to the heuristic
    so campaign generation always succeeds."""
    from copywriter_llm import CopywriterError, CopywriterNotConfigured, write_creative_core

    try:
        core = await write_creative_core(brand, goal)
        logger.info("Campaign copy written via LLM for %r", brand.name)
        return core, "llm"
    except CopywriterNotConfigured:
        return _heuristic_core(brand, goal), "heuristic"
    except CopywriterError as exc:
        logger.warning("Copywriter LLM failed (%s); falling back to regex for %r", exc, brand.name)
        return _heuristic_core(brand, goal), "heuristic"


async def generate_campaign(brand: BrandProfile, goal: str, *, today: str) -> dict:
    """Build a full campaign dict matching the frontend's campaign contract
    (id, name, objective, core_message, status, date, assets[]). `today` is
    passed in (ISO date string) rather than read from the clock so the function
    stays pure/testable.

    Copy comes from the LLM (or regex fallback); the price badge is extracted
    from the goal in Python and appended to subline/core_message here — the model
    never supplies a number (the facts rule)."""
    price = _extract_price(goal)
    core, _copy_source = await _creative_core(brand, goal)
    headline = core.headline

    # Inject the Python-extracted price into the supporting copy. The model's
    # subline/core_message carry NO figures; we append the owner's own price.
    subline = " · ".join(b for b in (core.subline or brand.category, price) if b)
    core_message = ". ".join(part for part in (core.core_message, price) if part) or headline

    base = _base_knobs(brand)
    assets = []
    for fmt in FORMATS:
        knobs = {**base, **_FORMAT_KNOB_OVERRIDES.get(fmt["type"], {})}
        assets.append(
            {
                "id": new_id("a"),
                "type": fmt["type"],
                "label": fmt["label"],
                "size": fmt["size"],
                # Not yet checked — the browser runs Signal Check on demand (F4).
                "signal_match": None,
                "signal_verdict": None,
                "slots": _slots_for(fmt["type"], brand, headline, price, subline),
                "knobs": knobs,
            }
        )

    return {
        "id": new_id("c"),
        "name": headline,
        "objective": goal,
        "core_message": core_message,
        "status": "Draft",
        "date": today,
        "assets": assets,
    }
