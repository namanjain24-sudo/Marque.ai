"""F10 — POST /v1/brands/{id}/audit + GET /audits, OpenRouter mocked."""

import io
import json

import pytest
from PIL import Image


def _tiny_png(colour=(230, 60, 70)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), color=colour).save(buf, format="PNG")
    return buf.getvalue()


TINY_PNG = _tiny_png()


def _audit_json(premium=70, font="display_bold", tone="warm", colours=("red",)):
    return {
        "detected": {"premium": premium, "modern": 70, "playful": 70, "niche": 55},
        "font_style": font,
        "photo_tone": tone,
        "colours": list(colours),
        "issue": "a note about this image",
    }


def _openrouter_response(content: str) -> dict:
    return {"choices": [{"message": {"content": content}}]}


def _mock_reads(httpx_mock, payloads):
    for p in payloads:
        httpx_mock.add_response(
            url="https://openrouter.ai/api/v1/chat/completions",
            json=_openrouter_response(json.dumps(p)),
        )


async def _create_brand(client, **overrides):
    # Brand creation is setup, not under test. Force the heuristic DNA path (no
    # network) even when the test has set a key for the audit call, so onboarding
    # doesn't fire an unmocked LLM request.
    import os

    payload = {"name": "Audit Test", "category": "Cafe", "price_level": 2}
    payload.update(overrides)
    saved = os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        resp = await client.post("/v1/brands", json=payload)
    finally:
        if saved is not None:
            os.environ["OPENROUTER_API_KEY"] = saved
    assert resp.status_code == 201
    return resp.json()


def _files(n):
    return [("images", (f"img{i}.png", TINY_PNG, "image/png")) for i in range(n)]


async def test_audit_happy_path(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    _mock_reads(
        httpx_mock,
        [
            _audit_json(premium=20, font="display_bold", tone="warm", colours=("red",)),
            _audit_json(premium=90, font="serif_elegant", tone="cool", colours=("blue",)),
            _audit_json(premium=55, font="clean_sans", tone="dark", colours=("green",)),
        ],
    )
    resp = await client.post(f"/v1/brands/{brand['id']}/audit", files=_files(3))
    assert resp.status_code == 200
    body = resp.json()
    assert 0 <= body["consistency_score"] <= 100
    assert "font style" in body["summary"]
    assert body["counts"]["font_styles"] == 3
    assert len(body["issues"]) <= 3
    assert all("suggested_fix" in i for i in body["issues"])
    assert body["image_count"] == 3


async def test_audit_rejects_too_few_images(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    resp = await client.post(f"/v1/brands/{brand['id']}/audit", files=_files(1))
    assert resp.status_code == 422


async def test_audit_rejects_too_many_images(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    resp = await client.post(f"/v1/brands/{brand['id']}/audit", files=_files(6))
    assert resp.status_code == 422


async def test_audit_404_unknown_brand(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    resp = await client.post("/v1/brands/brand_nope/audit", files=_files(2))
    assert resp.status_code == 404


async def test_audit_503_without_key(client, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    brand = await _create_brand(client)
    resp = await client.post(f"/v1/brands/{brand['id']}/audit", files=_files(2))
    assert resp.status_code == 503


async def test_audit_persists_and_lists_history(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    _mock_reads(httpx_mock, [_audit_json(), _audit_json(font="clean_sans")])
    resp = await client.post(f"/v1/brands/{brand['id']}/audit", files=_files(2))
    assert resp.status_code == 200

    hist = await client.get(f"/v1/brands/{brand['id']}/audits")
    assert hist.status_code == 200
    records = hist.json()
    assert len(records) == 1
    assert records[0]["brand_id"] == brand["id"]
    assert 0 <= records[0]["report"]["consistency_score"] <= 100
    assert records[0]["report"]["image_count"] == 2
