from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

from knobs import ACCENT_RANGE, KNOB_VALUES, OVERLAY_RANGE

# Reusable, bounded string types for public-facing input. Business identity
# fields (name/category) are stripped and must be non-empty after stripping;
# everything else just gets a sane upper bound so a public endpoint can't be
# used to stuff arbitrarily large strings/lists into the database.
NameStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ShortStr = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
WordStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
RuleStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]

MAX_LIST_ITEMS = 20
MAX_PRODUCTS = 100
MAX_MEANING_ENTRIES = 30


class ProductIn(BaseModel):
    name: NameStr
    price: float | None = Field(ge=0, default=None)
    photo: ShortStr | None = None


class Positioning(BaseModel):
    premium: int = Field(ge=0, le=100, default=50)
    modern: int = Field(ge=0, le=100, default=50)
    playful: int = Field(ge=0, le=100, default=50)
    niche: int = Field(ge=0, le=100, default=50)


class Palette(BaseModel):
    primary: HexColor
    secondary: HexColor
    accent: HexColor
    light: HexColor = "#FFFFFF"
    dark: HexColor = "#0B0B0B"


class Fonts(BaseModel):
    heading: str
    body: str


class Logo(BaseModel):
    type: Literal["wordmark", "upload"] = "wordmark"
    url: ShortStr | None = None


class Voice(BaseModel):
    language: str = "Hinglish"
    tone: str = ""


def _validate_meaning(value: dict[str, str] | None) -> dict[str, str] | None:
    if value is None:
        return value
    if len(value) > MAX_MEANING_ENTRIES:
        raise ValueError(f"meaning cannot have more than {MAX_MEANING_ENTRIES} entries")
    for key, val in value.items():
        if len(key) > 60 or len(val) > 200:
            raise ValueError("meaning keys must be <=60 chars and values <=200 chars")
    return value


class BrandProfile(BaseModel):
    """The Brand Memory contract. See PRD Section 9.1."""

    id: str | None = None
    name: NameStr
    category: NameStr
    city: ShortStr | None = None
    audience: ShortStr | None = None
    price_level: int = Field(ge=1, le=3, default=2)
    products: list[ProductIn] = Field(default_factory=list, max_length=MAX_PRODUCTS)
    positioning: Positioning = Field(default_factory=Positioning)
    personality: list[WordStr] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    palette: Palette | None = None
    fonts: Fonts | None = None
    logo: Logo = Field(default_factory=Logo)
    photo_style: ShortStr | None = None
    voice: Voice = Field(default_factory=Voice)
    meaning: dict[str, str] = Field(default_factory=dict)
    do: list[RuleStr] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    dont: list[RuleStr] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    preferences: list[RuleStr] = Field(default_factory=list, max_length=MAX_LIST_ITEMS * 2)
    version: int = 1

    _check_meaning = field_validator("meaning")(_validate_meaning)


class BrandCreate(BaseModel):
    """What the owner provides at onboarding (F1). Everything else is filled in later."""

    name: NameStr
    category: NameStr
    city: ShortStr | None = None
    audience: ShortStr | None = None
    price_level: int = Field(ge=1, le=3, default=2)
    personality: list[WordStr] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    products: list[ProductIn] = Field(default_factory=list, max_length=MAX_PRODUCTS)


class IdentityDirection(BaseModel):
    """One of the 2 proposed identity directions (F3)."""

    key: str
    palette: Palette
    fonts: Fonts
    meaning: dict[str, str]


class IdentityApply(BaseModel):
    """Body for POST /v1/brands/{id}/identity/apply — locks a proposed direction
    into Brand Memory. `fields` supports the PRD's "lock/regenerate individual
    parts" (Section 7, F3): omit it to apply the full direction (palette +
    fonts + meaning, the default), or pass a subset to take only those parts
    from the template and leave the rest of the current identity untouched.
    """

    key: str
    fields: list[Literal["palette", "fonts"]] | None = Field(default=None, min_length=1)


class MemoryRuleAppend(BaseModel):
    """Body for POST /v1/brands/{id}/memory/rules — adds one entry to a
    do/dont/preferences list without needing to resend the whole list (PATCH
    /memory replaces the list wholesale; this appends one item). Matches the
    PRD's 'owner says X, agent adds a Don't rule' tool (Section 8.2,
    update_memory)."""

    field: Literal["do", "dont", "preferences"]
    value: RuleStr


class BrandMemoryPatch(BaseModel):
    """Partial update for PATCH /v1/brands/{id}/memory — any subset of BrandProfile fields."""

    name: NameStr | None = None
    category: NameStr | None = None
    city: ShortStr | None = None
    audience: ShortStr | None = None
    price_level: int | None = Field(ge=1, le=3, default=None)
    products: list[ProductIn] | None = Field(default=None, max_length=MAX_PRODUCTS)
    positioning: Positioning | None = None
    personality: list[WordStr] | None = Field(default=None, max_length=MAX_LIST_ITEMS)
    palette: Palette | None = None
    fonts: Fonts | None = None
    logo: Logo | None = None
    photo_style: ShortStr | None = None
    voice: Voice | None = None
    meaning: dict[str, str] | None = None
    do: list[RuleStr] | None = Field(default=None, max_length=MAX_LIST_ITEMS)
    dont: list[RuleStr] | None = Field(default=None, max_length=MAX_LIST_ITEMS)
    preferences: list[RuleStr] | None = Field(default=None, max_length=MAX_LIST_ITEMS * 2)

    _check_meaning = field_validator("meaning")(_validate_meaning)


# --- F4: Brand Signaling + auto-fix (PRD Section 7 F4, Section 9.4) ---

DensityT = Literal[tuple(KNOB_VALUES["density"])]
FontStyleT = Literal[tuple(KNOB_VALUES["font_style"])]
PhotoToneT = Literal[tuple(KNOB_VALUES["photo_tone"])]
LayoutVariantT = Literal[tuple(KNOB_VALUES["layout_variant"])]


class FixKnobs(BaseModel):
    """Style knobs the fix loop is allowed to change (PRD 9.3 / Table 14). All
    optional - the critic only suggests the knobs it has an opinion on.

    `accent_usage` and `overlay` are continuous (0-1 / 0-0.8) because that's how
    the renderer (AssetPreview) consumes them; the rest are closed enums."""

    density: DensityT | None = None
    font_style: FontStyleT | None = None
    photo_tone: PhotoToneT | None = None
    accent_usage: float | None = Field(default=None, ge=ACCENT_RANGE[0], le=ACCENT_RANGE[1])
    overlay: float | None = Field(default=None, ge=OVERLAY_RANGE[0], le=OVERLAY_RANGE[1])
    layout_variant: LayoutVariantT | None = None


class SignalGaps(BaseModel):
    """detected - target per axis. Signed, unlike Positioning (PRD 9.4 example: playful gap -35)."""

    premium: int = Field(ge=-100, le=100)
    modern: int = Field(ge=-100, le=100)
    playful: int = Field(ge=-100, le=100)
    niche: int = Field(ge=-100, le=100)


class VisionCriticResponse(BaseModel):
    """The exact shape the vision LLM must return. Validating against this
    (and retrying once on failure - PRD Table 13 "Invalid JSON from LLM") is
    the schema-validation half of the reliability trick; temperature 0 and a
    fixed rubric (vision.py) are the other half (PRD Table 25)."""

    detected: Positioning
    issue: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    evidence: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]] = Field(
        min_length=1, max_length=5
    )
    fix: FixKnobs


class SignalResult(BaseModel):
    """PRD Section 9.4. `gaps`, `match` and `verdict` are computed in code from
    the LLM's `detected` vs the brand's `target` (PRD Table 9's formula) -
    never taken from the LLM directly, the same reliability principle as F1's
    deterministic brand_dna.py. No `asset_id`: F4 here checks any uploaded
    image, not a stored asset - there's no asset library yet (F5/F8)."""

    round: int = Field(ge=1, le=2, default=1)
    detected: Positioning
    target: Positioning
    gaps: SignalGaps
    match: int = Field(ge=0, le=100)
    verdict: Literal["pass", "needs_fix"]
    issue: str
    evidence: list[str]
    fix: FixKnobs
