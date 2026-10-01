"""F1 — Brand Onboarding + Brand DNA (PRD Section 7, F1).

Deterministic defaults the agent proposes when a brand is first created:
4 positioning slider values and 3 do/dont rules. No LLM call is needed for
this path, so onboarding always completes well under the 30s acceptance
target regardless of API availability.

A vision-LLM-based version of this (reading a website URL, logo or
screenshots per the PRD) is not implemented yet — it needs an LLM API key.
See PROGRESS.md.
"""

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
