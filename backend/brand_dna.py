"""F1 — Brand Onboarding + Brand DNA (PRD Section 7, F1).

Two paths, selected automatically by `propose_brand_dna` (SPEC-P1):

- **Heuristic (always available, offline, instant):** the deterministic lookup
  tables below propose 4 positioning values, 3 do/dont rules and a tone. This is
  the default and the fallback — onboarding always completes well under the 30s
  acceptance target regardless of API availability.
- **LLM (when OPENROUTER_API_KEY is set):** `brand_dna_llm.py` proposes real
  per-brand DNA via one text call. If it fails for any reason we swallow the
  error and return the heuristic result — the AI can never fail onboarding.

The LLM path is trusted only for the qualitative fields; palette/fonts stay F3's
curated-template job (see routers/brands.py).
"""

import logging

from schemas import BrandDNAProposal, Positioning

logger = logging.getLogger(__name__)

PERSONALITY_AXIS_HINTS: dict[str, dict[str, int]] = {
    "premium": {"premium": 25, "playful": -10},
    "luxury": {"premium": 30, "modern": 5},
    "affordable": {"premium": -25},
    "budget": {"premium": -30},
    "modern": {"modern": 25},
    "trendy": {"modern": 20, "playful": 10},
    "classic": {"modern": -25},
    "traditional": {"modern": -30},
    "playful": {"playful": 30},
    "fun": {"playful": 25},
    "bold": {"playful": 15, "premium": 5},
    "serious": {"playful": -25},
    "formal": {"playful": -30, "modern": -5},
    "corporate": {"playful": -20, "modern": -10},
    "niche": {"niche": 25},
    "specialist": {"niche": 20},
    "experimental": {"niche": 15, "modern": 10},
    "mass-market": {"niche": -25},
    "cozy": {"playful": 10, "premium": -5},
    "simple": {"modern": -5, "niche": -5},
    "minimal": {"modern": 15, "niche": 10},
}

PRICE_LEVEL_PREMIUM_BASE = {1: 30, 2: 50, 3: 75}

GENERIC_DO = ["real product photos", "consistent logo placement"]
GENERIC_DONT = ["stock photos", "low-resolution images"]

EXTRA_DO_BY_PRICE = {1: "clear value/price callouts"}
EXTRA_DONT_BY_PRICE = {3: "cheap-looking discount badges"}

TONE_HINTS: dict[str, str] = {
    "premium": "refined",
    "luxury": "refined",
    "playful": "cheeky",
    "fun": "cheeky",
    "bold": "confident",
    "modern": "direct",
    "trendy": "direct",
    "classic": "formal",
    "traditional": "formal",
    "serious": "formal",
    "formal": "formal",
    "corporate": "formal",
    "niche": "specialist",
    "specialist": "specialist",
    "experimental": "playful",
    "cozy": "warm",
    "simple": "plain-spoken",
    "minimal": "plain-spoken",
    "affordable": "friendly",
    "budget": "friendly",
}


def propose_positioning(personality: list[str], price_level: int) -> dict[str, int]:
    axes = {
        "premium": PRICE_LEVEL_PREMIUM_BASE.get(price_level, 50),
        "modern": 50,
        "playful": 50,
        "niche": 50,
    }
    for word in personality:
        hints = PERSONALITY_AXIS_HINTS.get(word.strip().lower())
        if not hints:
            continue
        for axis, delta in hints.items():
            axes[axis] += delta
    return {axis: max(0, min(100, value)) for axis, value in axes.items()}


def propose_do_dont(price_level: int) -> tuple[list[str], list[str]]:
    do = [*GENERIC_DO, EXTRA_DO_BY_PRICE.get(price_level, "legible price formatting")]
    dont = [*GENERIC_DONT, EXTRA_DONT_BY_PRICE.get(price_level, "inconsistent fonts across posts")]
    return do, dont


def propose_tone(personality: list[str]) -> str:
    descriptors: list[str] = []
    for word in personality:
        hint = TONE_HINTS.get(word.strip().lower())
        if hint and hint not in descriptors:
            descriptors.append(hint)
    if not descriptors:
        descriptors = ["short", "clear"]
    return ", ".join(descriptors[:3]) + ", no corporate words"


def _heuristic_dna(personality: list[str], price_level: int) -> BrandDNAProposal:
    """Assemble the deterministic Brand DNA from the lookup-table functions above.
    Always succeeds, offline and instant — the default path and the LLM fallback."""
    do, dont = propose_do_dont(price_level)
    return BrandDNAProposal(
        positioning=Positioning(**propose_positioning(personality, price_level)),
        do=do,
        dont=dont,
        tone=propose_tone(personality),
        meaning={},
    )


async def propose_brand_dna(
    *,
    name: str,
    category: str,
    city: str | None,
    audience: str | None,
    price_level: int,
    personality: list[str],
    products: list[str],
) -> tuple[BrandDNAProposal, str]:
    """The single DNA entry point onboarding calls (SPEC-P1 §5).

    Returns `(proposal, source)` where source is "llm" or "heuristic" — kept
    internal (logged, used by tests), not exposed in the API response.

    Auto-switch: if a key is present, try the LLM once (with its own retry-once);
    on ANY failure fall back to the heuristic. If no key, heuristic directly.
    Onboarding must never fail because of the AI.
    """
    # Imported lazily so the heuristic path (and its tests) never import httpx
    # or touch the LLM module.
    from brand_dna_llm import BrandDNAError, BrandDNANotConfigured, _call_dna_model

    try:
        proposal = await _call_dna_model(
            name=name,
            category=category,
            city=city,
            audience=audience,
            price_level=price_level,
            personality=personality,
            products=products,
        )
        logger.info("Brand DNA proposed via LLM for %r", name)
        return proposal, "llm"
    except BrandDNANotConfigured:
        # Expected when no key is set — the default, not an error worth logging loudly.
        return _heuristic_dna(personality, price_level), "heuristic"
    except BrandDNAError as exc:
        # The LLM was configured but couldn't produce valid DNA — log and fall back,
        # never 500 the onboarding.
        logger.warning("Brand DNA LLM failed (%s); falling back to heuristic for %r", exc, name)
        return _heuristic_dna(personality, price_level), "heuristic"
