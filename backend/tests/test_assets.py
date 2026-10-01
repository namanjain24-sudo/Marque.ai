"""F8 (light) — POST/GET/DELETE /v1/brands/{id}/assets, save-on-check.

The OpenRouter call is mocked (pytest-httpx); the on-disk write goes to a tmp
MEDIA_ROOT so the suite never touches the real media dir.
"""

import io
import json

import pytest
from PIL import Image


def _tiny_png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), color=(230, 60, 70)).save(buf, format="PNG")
    return buf.getvalue()


TINY_PNG = _tiny_png()

VALID_CRITIC_JSON = {
    "detected": {"premium": 88, "modern": 82, "playful": 40, "niche": 60},
    "issue": "Reads more luxury and serious than the playful brand target.",
    "evidence": ["Gold thin serif headline reads luxury"],
    "fix": {"font_style": "rounded_friendly", "accent_usage": 0.9},
}


def _openrouter_response(content: str) -> dict:
    return {"choices": [{"message": {"content": content}}]}


def _mock_critic(httpx_mock, times: int = 1):
    for _ in range(times):
        httpx_mock.add_response(
            url="https://openrouter.ai/api/v1/chat/completions",
            json=_openrouter_response(json.dumps(VALID_CRITIC_JSON)),
        )


async def _create_brand(client, **overrides):
    # Brand creation is setup, not the thing under test here. Force the heuristic
    # DNA path (no network) even if the test has set a key for the signal-check
    # call, so onboarding doesn't fire an unmocked LLM request.
    import os

    payload = {"name": "Asset Test", "category": "Cafe", "price_level": 2}
    payload.update(overrides)
    saved = os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        resp = await client.post("/v1/brands", json=payload)
    finally:
        if saved is not None:
            os.environ["OPENROUTER_API_KEY"] = saved
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture(autouse=True)
def _tmp_media(tmp_path, monkeypatch):
    """Point media storage at a tmp dir for every test in this module."""
    import uploads

    monkeypatch.setattr(uploads, "MEDIA_ROOT", str(tmp_path))


async def test_save_asset_creates_row_file_and_score(client, monkeypatch, httpx_mock, tmp_path):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    _mock_critic(httpx_mock)

    resp = await client.post(
        f"/v1/brands/{brand['id']}/assets",
        files={"image": ("poster.png", TINY_PNG, "image/png")},
        data={"type": "poster", "label": "My poster"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["type"] == "poster"
    assert body["label"] == "My poster"
    assert body["source"] == "upload"
    # match comes from the computed SignalResult, not the raw LLM output
    assert isinstance(body["signal_match"], int)
    assert body["signal_verdict"] in ("pass", "needs_fix")
    # png_url points at the served path, and the file actually exists on disk
    assert body["png_url"].startswith("/media/")
    filename = body["png_url"].split("/")[-1]
    assert (tmp_path / filename).exists()


async def test_save_asset_unknown_type_falls_back_to_other(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    _mock_critic(httpx_mock)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/assets",
        files={"image": ("x.png", TINY_PNG, "image/png")},
        data={"type": "billboard"},
    )
    assert resp.status_code == 201
    assert resp.json()["type"] == "other"


async def test_list_assets_newest_first_and_filtered(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    _mock_critic(httpx_mock, times=3)
    for t in ("poster", "post", "poster"):
        r = await client.post(
            f"/v1/brands/{brand['id']}/assets",
            files={"image": ("x.png", TINY_PNG, "image/png")},
            data={"type": t},
        )
        assert r.status_code == 201

    # all three, newest first
    resp = await client.get(f"/v1/brands/{brand['id']}/assets")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 3
    created = [i["created_at"] for i in items]
    assert created == sorted(created, reverse=True)

    # filtered by type
    resp = await client.get(f"/v1/brands/{brand['id']}/assets", params={"type": "poster"})
    assert [i["type"] for i in resp.json()] == ["poster", "poster"]


async def test_get_and_delete_asset(client, monkeypatch, httpx_mock, tmp_path):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    _mock_critic(httpx_mock)
    saved = (
        await client.post(
            f"/v1/brands/{brand['id']}/assets",
            files={"image": ("x.png", TINY_PNG, "image/png")},
        )
    ).json()
    asset_id = saved["id"]
    filename = saved["png_url"].split("/")[-1]
    assert (tmp_path / filename).exists()

    # GET one
    resp = await client.get(f"/v1/brands/{brand['id']}/assets/{asset_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == asset_id

    # DELETE removes row + file
    resp = await client.delete(f"/v1/brands/{brand['id']}/assets/{asset_id}")
    assert resp.status_code == 204
    assert not (tmp_path / filename).exists()
    resp = await client.get(f"/v1/brands/{brand['id']}/assets/{asset_id}")
    assert resp.status_code == 404


async def test_save_asset_404_unknown_brand(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    resp = await client.post(
        "/v1/brands/brand_nope/assets",
        files={"image": ("x.png", TINY_PNG, "image/png")},
    )
    assert resp.status_code == 404


async def test_save_asset_422_bad_upload(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    # not an image (bad magic bytes)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/assets",
        files={"image": ("x.txt", b"hello not an image", "text/plain")},
    )
    assert resp.status_code == 422


async def test_save_asset_422_empty_file(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/assets",
        files={"image": ("x.png", b"", "image/png")},
    )
    assert resp.status_code == 422


async def test_save_asset_503_without_key(client, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/assets",
        files={"image": ("x.png", TINY_PNG, "image/png")},
    )
    assert resp.status_code == 503
