"""F4 — Brand Signaling: check_signals (PRD Section 7 F4, Table 12).

Sends a rendered/uploaded image to a vision LLM with a fixed rubric and the
brand's target positioning, gets back where the design actually lands on
each axis plus evidence and suggested fix knobs. Gaps, match score and
verdict are computed deterministically in Python from the LLM's `detected`
values (PRD Table 9's formula) — the LLM is only trusted for perception
judgment, never arithmetic.

Reliability trick (PRD Table 25 "Signal critic gives unstable scores"):
temperature 0, a fixed rubric, schema validation with one retry on a bad
response (PRD Table 13 "Invalid JSON from LLM").
"""

import base64
import io
import json
import os

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import ValidationError

from schemas import (
    BrandProfile,
    FixKnobs,
    Positioning,
    SignalGaps,
    SignalResult,
    VisionAuditResponse,
    VisionCriticResponse,
)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# PRD Table 8's poles (0 and 100) plus 25/50/75 anchors authored to match
# them, so the critic scores against a fixed scale instead of its own vibe
# each time (PRD 5.2's "reliability trick").
RUBRIC = """\
Score each axis 0-100 against these anchors:

premium (0=affordable/budget, cheap and generic -> 100=premium/luxury, opulent and exclusive)
  0: looks cheap, generic, low-cost
  25: functional, unpretentious, everyday value
  50: decent quality, not especially upscale or cheap
  75: refined materials, restrained design, feels considered
  100: opulent, exclusive, every detail deliberate

modern (0=traditional/classic, heritage and nostalgic -> 100=modern/trendy, cutting-edge)
  0: heritage motifs, old-fashioned typography, nostalgic
  25: familiar, safe, dated but acceptable
  50: neither old nor cutting-edge, timeless
  75: current design trends, clean digital-native feel
  100: cutting-edge, of-the-moment, experimental

playful (0=serious/formal, stern and corporate -> 100=playful/fun, bold and irreverent)
  0: stern, corporate, no humor
  25: polite, low-key, mostly businesslike
  50: some warmth, not silly
  75: friendly, approachable, a bit of fun
  100: bold color, humor, energetic, irreverent

niche (0=mass-market, broad generic appeal -> 100=niche/specialist, for a specific crowd)
  0: broad appeal, generic, for everyone
  25: wide appeal with light personality
  50: has a point of view but still broadly legible
  75: clearly made for a particular taste or crowd
  100: unmistakably for a specific subculture or expert audience
"""

SYSTEM_PROMPT = f"""You are the Signal Check critic for BrandOS, a brand-identity tool. \
You are shown one marketing asset (poster, social post, etc.) and the business's target \
brand perception. Judge only what the image actually communicates visually - composition, \
color, typography, photography, density - never the business's reputation or claims.

{RUBRIC}

Reply with ONLY a single JSON object, no markdown fences, no prose outside it, in exactly \
this shape:
{{
  "detected": {{"premium": <0-100 int>, "modern": <0-100 int>, "playful": <0-100 int>, "niche": <0-100 int>}},
  "issue": "<one plain-language sentence naming the biggest gap between how this reads and the target, and what causes it>",
  "evidence": ["<short, concrete, visual observation>", "..."],
  "fix": {{
    "density": "open" | "balanced",
    "font_style": "display_bold" | "serif_elegant" | "rounded_friendly" | "clean_sans",
    "photo_tone": "warm" | "neutral" | "cool" | "dark",
    "accent_usage": <0.0-1.0>,
    "overlay": <0.0-0.8>,
    "layout_variant": "left" | "center" | "split"
  }}
}}
Include 1-3 evidence items. In "fix", include only the knobs you'd actually change to close \
the gap - omit any knob that's already right.
"""


AUDIT_SYSTEM_PROMPT = f"""You are the Brand Audit critic for BrandOS, a brand-identity tool. \
You are shown ONE of several of a business's existing marketing images. Describe only what \
this image actually communicates visually - composition, colour, typography, photography, \
density - so it can be compared against the business's other images and its brand target.

{RUBRIC}

Also tag the image's visual style using this closed vocabulary (pick the single closest value):
  font_style: "display_bold" | "serif_elegant" | "rounded_friendly" | "clean_sans"
  photo_tone: "warm" | "neutral" | "cool" | "dark"

Reply with ONLY a single JSON object, no markdown fences, no prose outside it, in exactly \
this shape:
{{
  "detected": {{"premium": <0-100 int>, "modern": <0-100 int>, "playful": <0-100 int>, "niche": <0-100 int>}},
  "font_style": "<one of the font_style values above>",
  "photo_tone": "<one of the photo_tone values above>",
  "colours": ["<1-4 dominant colours, short names or hex>"],
  "issue": "<one plain-language sentence on the most notable thing about how this image reads>"
}}
"""


class VisionCheckError(Exception):
    """check_signals couldn't get a usable response from the vision LLM."""


class VisionNotConfiguredError(VisionCheckError):
    """No OPENROUTER_API_KEY set — a deploy/config issue, not an upstream failure."""


class InvalidImageError(VisionCheckError):
    """Upload passed the router's magic-byte sniff but Pillow can't decode it."""


# Vision API cost scales with image resolution, and an owner's phone photo
# can be 10-20 MP for no benefit here — judging palette/typography/density
# doesn't need full resolution. Capping the longest side keeps cost
# predictable regardless of what gets uploaded (measured: an unresized
# 3000x4000 photo cost ~1.7x a 1280-capped one for the same check).
MAX_DIMENSION = 1280
JPEG_QUALITY = 85


def prepare_image(data: bytes) -> tuple[bytes, str]:
    """Decode, downscale to MAX_DIMENSION, and re-encode as JPEG. Also the
    re-encode PRD Table 21 suggests for uploads generally, and it collapses
    PNG/JPEG/WebP input to one format so the model always sees the same kind
    of payload."""
    try:
        image = Image.open(io.BytesIO(data))
        image = ImageOps.exif_transpose(image)  # phone photos often carry rotation in EXIF, not pixels
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise InvalidImageError(f"Could not decode image: {exc}") from exc

    if image.mode != "RGB":
        image = image.convert("RGB")

    if max(image.size) > MAX_DIMENSION:
        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY)
    return buffer.getvalue(), "image/jpeg"


def _build_user_content(profile: BrandProfile, image_b64: str, mime: str) -> list[dict]:
    meaning_lines = "\n".join(f"- {k}: {v}" for k, v in profile.meaning.items()) or "(none set yet)"
    context = f"""Brand: {profile.name} ({profile.category})
Target positioning: premium={profile.positioning.premium}, modern={profile.positioning.modern}, \
playful={profile.positioning.playful}, niche={profile.positioning.niche}
What the brand's choices are meant to say:
{meaning_lines}
Do: {", ".join(profile.do) or "(none)"}
Don't: {", ".join(profile.dont) or "(none)"}
"""
    return [
        {"type": "text", "text": context},
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
    ]


def _parse_json_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    return json.loads(cleaned)


async def _call_model(client: httpx.AsyncClient, api_key: str, model: str, messages: list[dict]) -> str:
    response = await client.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Title": "Marque.ai",
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": 0,
            "max_tokens": 1000,
            # Force well-formed JSON from the critic. Without this the model
            # occasionally emits a trailing comma / unquoted key and the whole
            # check 502s (observed live in prod). Belt-and-suspenders with the
            # parse-and-retry-once path below.
            "response_format": {"type": "json_object"},
        },
        timeout=45,
    )
    if response.status_code != 200:
        raise VisionCheckError(f"OpenRouter returned {response.status_code}: {response.text[:300]}")
    body = response.json()
    try:
        return body["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise VisionCheckError(f"Unexpected OpenRouter response shape: {body}") from exc


def _compute_result(critic: VisionCriticResponse, target: Positioning, round_num: int) -> SignalResult:
    axes = ("premium", "modern", "playful", "niche")
    gaps = {axis: getattr(critic.detected, axis) - getattr(target, axis) for axis in axes}
    # PRD Table 9: match = 100 - average absolute gap; pass = match >= 80 AND no single axis gap > 20.
    avg_abs_gap = sum(abs(g) for g in gaps.values()) / len(axes)
    match = round(100 - avg_abs_gap)
    verdict = "pass" if match >= 80 and max(abs(g) for g in gaps.values()) <= 20 else "needs_fix"
    return SignalResult(
        round=round_num,
        detected=critic.detected,
        target=target,
        gaps=SignalGaps(**gaps),
        match=match,
        verdict=verdict,
        issue=critic.issue,
        evidence=critic.evidence,
        fix=critic.fix,
    )


def apply_fix_knobs(current: dict, fix: FixKnobs) -> dict:
    """Merge the critic's sparse suggested knobs over an asset's current knobs,
    returning a new dict (the F4 fix loop's 'revise style knobs' step). Only the
    knobs the critic actually set are changed; floats are clamped to their valid
    renderer ranges so a suggestion can never push a knob out of bounds.

    This is the backend's canonical merge; the frontend mirrors the same logic
    in lib/signal.js so it can re-render round 2 without a round-trip. Kept here
    too so the loop is testable server-side and a future server-side renderer
    reuses it.
    """
    from knobs import ACCENT_RANGE, OVERLAY_RANGE

    updated = dict(current)
    for field, value in fix.model_dump(exclude_none=True).items():
        if field == "accent_usage":
            value = max(ACCENT_RANGE[0], min(ACCENT_RANGE[1], value))
        elif field == "overlay":
            value = max(OVERLAY_RANGE[0], min(OVERLAY_RANGE[1], value))
        updated[field] = value
    return updated


async def _critic_call(client, api_key, model, messages, model_cls):
    """Call the vision model and validate the reply against `model_cls`, with the
    PRD Table 13 retry-once-on-bad-JSON path. Shared by check_signals (F4) and
    analyse_asset (F10) so the reliability scaffolding lives in exactly one place."""
    raw = await _call_model(client, api_key, model, messages)
    try:
        return model_cls(**_parse_json_response(raw))
    except (json.JSONDecodeError, ValidationError, TypeError) as first_error:
        # PRD Table 13: "Invalid JSON from LLM -> validate with schema,
        # retry once with the error message."
        messages.append({"role": "assistant", "content": raw})
        messages.append(
            {
                "role": "user",
                "content": (
                    f"That reply was invalid: {first_error}. "
                    "Reply again with ONLY the corrected JSON object, no markdown fences, no prose."
                ),
            }
        )
        raw_retry = await _call_model(client, api_key, model, messages)
        try:
            return model_cls(**_parse_json_response(raw_retry))
        except (json.JSONDecodeError, ValidationError, TypeError) as second_error:
            raise VisionCheckError(f"Vision critic returned unusable output twice: {second_error}") from second_error


def _api_key_and_model() -> tuple[str, str]:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise VisionNotConfiguredError("OPENROUTER_API_KEY is not configured")
    model = os.environ.get("OPENROUTER_SIGNAL_MODEL", "qwen/qwen3-vl-32b-instruct")
    return api_key, model


async def check_signals(profile: BrandProfile, image_bytes: bytes, round_num: int = 1) -> SignalResult:
    api_key, model = _api_key_and_model()

    resized_bytes, resized_mime = prepare_image(image_bytes)
    image_b64 = base64.b64encode(resized_bytes).decode("ascii")
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_content(profile, image_b64, resized_mime)},
    ]

    async with httpx.AsyncClient() as client:
        critic = await _critic_call(client, api_key, model, messages, VisionCriticResponse)

    return _compute_result(critic, profile.positioning, round_num)


async def analyse_asset(profile: BrandProfile, image_bytes: bytes) -> VisionAuditResponse:
    """F10 — per-image style read for a brand audit. Same reliability scaffolding
    as check_signals (temperature 0, fixed rubric, schema validation + retry),
    but the model also tags font_style / photo_tone / dominant colours so the
    audit can count distinct treatments across images."""
    api_key, model = _api_key_and_model()

    resized_bytes, resized_mime = prepare_image(image_bytes)
    image_b64 = base64.b64encode(resized_bytes).decode("ascii")
    messages = [
        {"role": "system", "content": AUDIT_SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_content(profile, image_b64, resized_mime)},
    ]

    async with httpx.AsyncClient() as client:
        return await _critic_call(client, api_key, model, messages, VisionAuditResponse)
