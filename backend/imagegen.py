"""P2 — Real hero-image generation for campaign assets.

The brand constraint (the brief): an image model makes BACKGROUNDS/HERO imagery
only; text, logo, price and CTA are always HTML/CSS layers on top (correct
spelling, editable). So this never draws a whole poster — it generates a single
textless background photo per asset, which AssetPreview renders UNDER the
existing text layers.

Same auto-switch + graceful-fallback seam as copywriter_llm.py / brand_dna_llm.py:
key present -> generate; else, or on ANY failure -> return None and the renderer
falls back to its CSS gradient. Image generation must NEVER fail a campaign run —
a missing hero just means the gradient shows, exactly as before this feature.

Model: an OpenRouter image-output model (default google/gemini-2.5-flash-image),
called with `modalities: ["image","text"]`. The reply carries the image as a
data-URL at choices[0].message.images[0].image_url.url (verified live).
"""

import asyncio
import base64
import logging
import os

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_IMAGE_MODEL = "google/gemini-2.5-flash-image"
# One image per asset; a campaign generates 4 concurrently. Cap concurrency so a
# burst of campaigns doesn't open too many upstream connections at once.
_IMAGE_TIMEOUT = 90


class ImageGenNotConfigured(Exception):
    """No OPENROUTER_API_KEY — skip hero generation, keep the gradient."""


class ImageGenError(Exception):
    """The image path could not produce a usable image — keep the gradient."""


def _model_name() -> str:
    return os.environ.get("OPENROUTER_IMAGE_MODEL", DEFAULT_IMAGE_MODEL)


def image_gen_enabled() -> bool:
    """True when hero image generation should run: an API key is present AND the
    explicit opt-in flag `MARQUE_HERO_IMAGES` is truthy.

    Two gates on purpose: image generation is the most expensive call in the app
    (~$0.04/image, 4 per campaign), so it is OFF unless a deployment deliberately
    turns it on — the key alone (needed for signal-check and copy) does not opt
    you in. This also keeps the test suite and dev runs from ever spending on
    images: tests never set the flag."""
    if not os.environ.get("OPENROUTER_API_KEY"):
        return False
    return os.environ.get("MARQUE_HERO_IMAGES", "").strip().lower() in {"1", "true", "yes", "on"}


# Aspect guidance per format so the hero suits the frame it lands in.
_FORMAT_FRAMING = {
    "poster": "vertical 4:5 composition",
    "post": "square 1:1 composition",
    "story": "tall vertical 9:16 composition",
    "whatsapp": "square 1:1 composition",
}

_TONE_MOOD = {
    "warm": "warm golden tones, cosy inviting light",
    "dark": "dark moody low-key lighting, deep shadows",
    "cool": "cool blue-tinted tones, crisp clean light",
}


def build_prompt(brand_name: str, category: str, fmt: str, headline: str, photo_tone: str) -> str:
    """A background-only prompt per asset. Distinct per format (framing) and per
    the asset's photo_tone knob, so the 4 assets in a campaign get 4 different
    images rather than one repeated. Explicitly forbids text/logos/people so the
    HTML/CSS layers own all type (the brief's hard rule)."""
    framing = _FORMAT_FRAMING.get(fmt, "square composition")
    mood = _TONE_MOOD.get(photo_tone, _TONE_MOOD["warm"])
    return (
        f"A professional background image for a {category} brand marketing creative. "
        f"Theme: {headline}. "
        f"Cinematic commercial photography, {mood}, shallow depth of field, premium feel. "
        f"{framing}. "
        "IMPORTANT: background/scene only — absolutely NO text, NO letters, NO words, "
        "NO logos, NO watermarks, NO people's faces. Leave clean negative space for a "
        "headline to be added later."
    )


def _extract_image_bytes(payload: dict) -> bytes:
    """Pull the generated image out of an OpenRouter image-model reply. The image
    is a data-URL (data:image/...;base64,<data>) under
    choices[0].message.images[0].image_url.url."""
    try:
        images = payload["choices"][0]["message"].get("images") or []
    except (KeyError, IndexError, TypeError) as exc:
        raise ImageGenError(f"Unexpected image response shape: {exc}") from exc
    if not images:
        raise ImageGenError("Model returned no image")
    url = ""
    first = images[0]
    if isinstance(first, dict):
        url = first.get("image_url", {}).get("url", "")
    if not url.startswith("data:image"):
        raise ImageGenError("Image reply was not a data URL")
    try:
        _, b64 = url.split(",", 1)
        return base64.b64decode(b64)
    except (ValueError, base64.binascii.Error) as exc:
        raise ImageGenError(f"Could not decode image data: {exc}") from exc


async def generate_hero(prompt: str) -> bytes:
    """One image-model call -> raw image bytes (PNG). Raises ImageGen* on any
    failure; callers catch and fall back to the gradient. Never returns None —
    either bytes or an exception, so the caller's try/except is explicit."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ImageGenNotConfigured("OPENROUTER_API_KEY is not configured")
    model = _model_name()

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "X-Title": "Marque.ai",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "modalities": ["image", "text"],
                },
                timeout=_IMAGE_TIMEOUT,
            )
    except httpx.RequestError as exc:
        logger.error("Image-gen network error: %s", exc)
        raise ImageGenError("Image service unavailable") from exc

    if response.status_code != 200:
        logger.error("Image-gen returned %d: %s", response.status_code, response.text[:300])
        raise ImageGenError(f"Image service returned {response.status_code}")

    return _extract_image_bytes(response.json())


async def try_generate_hero(prompt: str) -> bytes | None:
    """Convenience wrapper: generate a hero or return None on ANY failure (no
    key, network, bad response). This is the campaign-safe entry point — a hero
    is a best-effort enhancement, never a reason a campaign fails."""
    try:
        return await generate_hero(prompt)
    except (ImageGenNotConfigured, ImageGenError) as exc:
        logger.info("Hero image skipped (%s)", exc)
        return None
    except Exception as exc:  # defensive: never let image-gen bubble into generation
        logger.warning("Hero image unexpected failure: %s", exc)
        return None


async def generate_heroes(prompts: list[str]) -> list[bytes | None]:
    """Generate N heroes concurrently; each slot is bytes or None (failed/skipped).
    Order matches the input prompts."""
    return list(await asyncio.gather(*(try_generate_hero(p) for p in prompts)))
