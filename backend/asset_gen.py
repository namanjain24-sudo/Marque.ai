"""F5 (light) — deterministic asset generation.

Turns a brand profile + a one-line goal into a campaign of 4 assets (poster,
Instagram post, story, WhatsApp creative), each with text `slots` and style
`knobs`. Same philosophy as brand_dna.py / identity.py: pure Python heuristics,
no LLM call, so it's instant and works offline. A text-LLM copy pass can be
dropped in later behind the same function signature ("we'll build the agent
eventually") without changing the contract.

The `slots` + `knobs` shapes match exactly what the frontend renderer
(`AssetPreview.jsx`) consumes, because the browser is the renderer here. Knob
values come from `knobs.py` (the single source of truth, reconciled with the
renderer).
"""

import re

from models import new_id
from schemas import BrandProfile

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
    headline = headline[:1].upper() + headline[1:] if headline else brand.name
    # Brand Memory guard: a generated headline must never contain a word the
    # brand has told us not to use. If any meaningful word (len > 3) from any
    # `dont` rule appears in the headline, fall back to the safe brand name.
    headline_lower = headline.lower()
    for rule in brand.dont:
        for word in rule.lower().split():
            if len(word) > 3 and word in headline_lower:
                return brand.name
    return headline


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


def generate_campaign(brand: BrandProfile, goal: str, *, today: str) -> dict:
    """Build a full campaign dict matching the frontend's campaign contract
    (id, name, objective, core_message, status, date, assets[]). `today` is
    passed in (ISO date string) rather than read from the clock so the function
    stays pure/testable."""
    price = _extract_price(goal)
    headline = _headline(goal, brand)
    subline_bits = [b for b in ("This week only" if "week" in goal.lower() else None, price) if b]
    subline = " · ".join(subline_bits) if subline_bits else brand.category
    core_message = ". ".join(part for part in (headline, price, "Limited time") if part)

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
