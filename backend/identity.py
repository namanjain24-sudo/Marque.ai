"""F3 — Brand Identity, light version (PRD Section 7, F3).

A small curated set of identity templates (palette + font pair + meaning),
rather than free LLM generation — matches the PRD's own reliability
principle (Section 5.1 "slots, not free coordinates"): results are always
valid and instant, no AI call needed. `propose_identity` picks the 2
templates whose mood is closest to the brand's positioning sliders.

Fonts are drawn from a curated set of 8 Google Fonts (PRD 7, F3).
"""

from typing import TypedDict

from schemas import Positioning


class _PaletteDict(TypedDict):
    primary: str
    secondary: str
    accent: str
    light: str
    dark: str


class _FontsDict(TypedDict):
    heading: str
    body: str


class _MoodDict(TypedDict):
    premium: int
    modern: int
    playful: int
    niche: int


class IdentityTemplate(TypedDict):
    key: str
    palette: _PaletteDict
    fonts: _FontsDict
    meaning: dict[str, str]
    mood: _MoodDict


TEMPLATES: list[IdentityTemplate] = [
    {
        "key": "bold_premium",
        "palette": {
            "primary": "#E63946",
            "secondary": "#111111",
            "accent": "#F1FAEE",
            "light": "#FFFFFF",
            "dark": "#0B0B0B",
        },
        "fonts": {"heading": "Bebas Neue", "body": "Inter"},
        "meaning": {
            "red primary": "energy and appetite",
            "near-black background": "premium, confident",
            "condensed display headline": "bold, modern",
        },
        "mood": {"premium": 70, "modern": 75, "playful": 70, "niche": 50},
    },
    {
        "key": "elegant_classic",
        "palette": {
            "primary": "#B08D57",
            "secondary": "#1C1C1C",
            "accent": "#F5F1E8",
            "light": "#FFFFFF",
            "dark": "#0A0A0A",
        },
        "fonts": {"heading": "Playfair Display", "body": "Work Sans"},
        "meaning": {
            "gold accent": "luxury, refinement",
            "serif headline": "timeless, elegant",
            "dark base": "premium, serious",
        },
        "mood": {"premium": 85, "modern": 40, "playful": 20, "niche": 60},
    },
    {
        "key": "playful_bright",
        "palette": {
            "primary": "#FF6B35",
            "secondary": "#FFD23F",
            "accent": "#06AED5",
            "light": "#FFFFFF",
            "dark": "#1A1A1A",
        },
        "fonts": {"heading": "Poppins", "body": "DM Sans"},
        "meaning": {
            "warm orange": "friendly, energetic",
            "rounded sans headline": "approachable, fun",
            "bright cyan accent": "youthful",
        },
        "mood": {"premium": 35, "modern": 65, "playful": 90, "niche": 30},
    },
    {
        "key": "modern_minimal",
        "palette": {
            "primary": "#2B2D42",
            "secondary": "#8D99AE",
            "accent": "#EF233C",
            "light": "#EDF2F4",
            "dark": "#121212",
        },
        "fonts": {"heading": "Space Grotesk", "body": "Inter"},
        "meaning": {
            "muted blue-grey": "modern, minimal",
            "geometric headline": "clean, confident",
            "red accent": "sharp focus",
        },
        "mood": {"premium": 55, "modern": 90, "playful": 35, "niche": 55},
    },
    {
        "key": "earthy_niche",
        "palette": {
            "primary": "#6B4226",
            "secondary": "#283618",
            "accent": "#DDA15E",
            "light": "#FEFAE0",
            "dark": "#1B1B1B",
        },
        "fonts": {"heading": "Fraunces", "body": "Work Sans"},
        "meaning": {
            "earthy brown": "authentic, artisanal",
            "serif display font": "crafted, specialist",
            "olive-gold tones": "natural, grounded",
        },
        "mood": {"premium": 60, "modern": 35, "playful": 30, "niche": 85},
    },
]

# 8 curated Google Fonts across the templates above:
# Bebas Neue, Inter, Playfair Display, Work Sans, Poppins, DM Sans,
# Space Grotesk, Fraunces


def _distance(mood: _MoodDict, target: Positioning) -> int:
    axes = ("premium", "modern", "playful", "niche")
    return sum(abs(mood[axis] - getattr(target, axis)) for axis in axes)


def propose_identity(target: Positioning, n: int = 2) -> list[IdentityTemplate]:
    ranked = sorted(TEMPLATES, key=lambda t: _distance(t["mood"], target))
    return ranked[:n]


def get_template(key: str) -> IdentityTemplate | None:
    return next((t for t in TEMPLATES if t["key"] == key), None)
