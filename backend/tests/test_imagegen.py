"""Hero image generation (imagegen.py) + its wiring into generate_campaign.

The OpenRouter image call is mocked (pytest-httpx); on-disk writes go to a tmp
MEDIA_ROOT. Zero credits: no test ever hits the network or needs a real key.
"""

import base64
import io

import pytest
from PIL import Image

import imagegen
import uploads
from asset_gen import generate_campaign
from imagegen import (
    ImageGenError,
    ImageGenNotConfigured,
    _extract_image_bytes,
    build_prompt,
    generate_hero,
    try_generate_hero,
)
from schemas import BrandProfile

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def _png_data_url() -> str:
    """A valid 8x8 PNG as a data URL, exactly the shape the image model returns."""
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color=(120, 60, 20)).save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _image_response(data_url: str) -> dict:
    return {
        "choices": [
            {"message": {"role": "assistant", "content": "", "images": [{"type": "image_url", "image_url": {"url": data_url}}]}}
        ]
    }


@pytest.fixture(autouse=True)
def _tmp_media(tmp_path, monkeypatch):
    monkeypatch.setattr(uploads, "MEDIA_ROOT", str(tmp_path))


def _brand(**overrides) -> BrandProfile:
    defaults = {"name": "Burger Lab", "category": "Cafe"}
    defaults.update(overrides)
    return BrandProfile(**defaults)


# --- unit: prompt + response parsing -------------------------------------

def test_build_prompt_forbids_text_and_varies_by_format():
    poster = build_prompt("Burger Lab", "Cafe", "poster", "Truffle Burger", "warm")
    story = build_prompt("Burger Lab", "Cafe", "story", "Truffle Burger", "dark")
    assert "NO text" in poster
    assert "vertical 4:5" in poster
    assert "tall vertical 9:16" in story
    # Different tone -> different mood phrase -> distinct prompt
    assert poster != story


def test_extract_image_bytes_from_data_url():
    raw = _extract_image_bytes(_image_response(_png_data_url()))
    assert isinstance(raw, bytes) and len(raw) > 0
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"


def test_extract_image_bytes_no_images_raises():
    with pytest.raises(ImageGenError):
        _extract_image_bytes({"choices": [{"message": {"images": []}}]})


def test_extract_image_bytes_non_data_url_raises():
    bad = {"choices": [{"message": {"images": [{"image_url": {"url": "https://x/y.png"}}]}}]}
    with pytest.raises(ImageGenError):
        _extract_image_bytes(bad)


# --- unit: generate_hero + the seam --------------------------------------

async def test_generate_hero_no_key_raises_not_configured(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(ImageGenNotConfigured):
        await generate_hero("anything")


async def test_try_generate_hero_returns_none_without_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    assert await try_generate_hero("anything") is None


async def test_generate_hero_happy_path(monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    httpx_mock.add_response(url=OPENROUTER_URL, json=_image_response(_png_data_url()))
    raw = await generate_hero("a warm background")
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"


async def test_try_generate_hero_swallows_upstream_error(monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    httpx_mock.add_response(url=OPENROUTER_URL, status_code=500, text="boom")
    assert await try_generate_hero("x") is None


# --- integration: generate_campaign attaches hero images -----------------

@pytest.mark.httpx_mock(assert_all_responses_were_requested=False)
async def test_campaign_attaches_hero_images_when_enabled(monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("MARQUE_HERO_IMAGES", "1")
    # With a key present the copywriter also fires (and falls back to regex when
    # it gets an image-shaped reply) before the 4 image calls. Queue plenty of
    # image responses; unused ones are fine (assert flag above).
    for _ in range(8):
        httpx_mock.add_response(url=OPENROUTER_URL, json=_image_response(_png_data_url()))

    brand = _brand()
    campaign = await generate_campaign(brand, "Launch truffle burger at ₹399", today="2026-10-01")

    heroes = [a["slots"].get("hero_image") for a in campaign["assets"]]
    # Every asset got a stored hero image URL under /media.
    assert all(h and h.startswith("/media/hero_") for h in heroes)
    # Distinct file per asset (keyed by asset id).
    assert len(set(heroes)) == len(heroes)


async def test_campaign_without_key_leaves_hero_none(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("MARQUE_HERO_IMAGES", raising=False)
    brand = _brand()
    campaign = await generate_campaign(brand, "Launch truffle burger at ₹399", today="2026-10-01")
    assert all(a["slots"].get("hero_image") is None for a in campaign["assets"])
    # Campaign still has its 4 assets — image-gen is never load-bearing.
    assert len(campaign["assets"]) == 4


async def test_image_gen_flag_gate(monkeypatch):
    """Key present but the opt-in flag off -> image gen stays disabled (cost
    control: the key alone does not opt you into paid image generation)."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("MARQUE_HERO_IMAGES", raising=False)
    assert imagegen.image_gen_enabled() is False
    monkeypatch.setenv("MARQUE_HERO_IMAGES", "1")
    assert imagegen.image_gen_enabled() is True


@pytest.mark.httpx_mock(assert_all_responses_were_requested=False)
async def test_campaign_survives_image_failure(monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("MARQUE_HERO_IMAGES", "1")
    # All calls 500 -> copy falls back to regex, heroes stay None, campaign still
    # succeeds. Queue extra error responses; unused ones are fine (flag above).
    for _ in range(8):
        httpx_mock.add_response(url=OPENROUTER_URL, status_code=500, text="boom")
    brand = _brand()
    campaign = await generate_campaign(brand, "Launch truffle burger at ₹399", today="2026-10-01")
    assert len(campaign["assets"]) == 4
    assert all(a["slots"].get("hero_image") is None for a in campaign["assets"])
