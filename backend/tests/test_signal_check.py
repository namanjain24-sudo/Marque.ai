"""F4 — POST /v1/brands/{id}/signal-check, with the OpenRouter HTTP call
mocked (pytest-httpx). The real integration is exercised manually against
the live API, not in the suite that runs in CI without a key.
"""

import base64
import json

import pytest

# Smallest valid 1x1 transparent PNG.
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)

VALID_CRITIC_JSON = {
    "detected": {"premium": 88, "modern": 82, "playful": 40, "niche": 60},
    "issue": "Reads more luxury and serious than the playful brand target.",
    "evidence": ["Gold thin serif headline reads luxury", "Dark empty space reads formal"],
    "fix": {"font_style": "rounded_friendly", "accent_usage": "high"},
}


def _openrouter_response(content: str) -> dict:
    return {"choices": [{"message": {"content": content}}]}


async def _create_brand(client, **overrides):
    payload = {"name": "Signal Test", "category": "Cafe", "price_level": 2}
    payload.update(overrides)
    resp = await client.post("/v1/brands", json=payload)
    assert resp.status_code == 201
    return resp.json()


async def test_404_for_unknown_brand(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    resp = await client.post(
        "/v1/brands/brand_nope/signal-check",
        files={"image": ("a.png", TINY_PNG, "image/png")},
    )
    assert resp.status_code == 404


async def test_503_when_not_configured(client, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("a.png", TINY_PNG, "image/png")},
    )
    assert resp.status_code == 503


async def test_422_on_non_image_upload(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("a.txt", b"not an image", "text/plain")},
    )
    assert resp.status_code == 422


async def test_422_on_empty_upload(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("a.png", b"", "image/png")},
    )
    assert resp.status_code == 422


async def test_422_on_oversized_upload(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    oversized = TINY_PNG + b"\x00" * (10 * 1024 * 1024)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("a.png", oversized, "image/png")},
    )
    assert resp.status_code == 422


async def test_happy_path_computes_result_from_llm_detected_values(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client, price_level=2)
    # Burger-Lab-shaped target so the gaps match the PRD's own worked example.
    patch_resp = await client.patch(
        f"/v1/brands/{brand['id']}/memory",
        json={"positioning": {"premium": 70, "modern": 80, "playful": 75, "niche": 55}},
    )
    assert patch_resp.status_code == 200

    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(json.dumps(VALID_CRITIC_JSON)),
    )

    resp = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("poster.png", TINY_PNG, "image/png")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["detected"] == VALID_CRITIC_JSON["detected"]
    assert body["gaps"] == {"premium": 18, "modern": 2, "playful": -35, "niche": 5}
    assert body["match"] == 85
    assert body["verdict"] == "needs_fix"
    assert body["issue"] == VALID_CRITIC_JSON["issue"]
    assert body["fix"]["font_style"] == "rounded_friendly"


async def test_markdown_fenced_json_is_parsed(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    fenced = "```json\n" + json.dumps(VALID_CRITIC_JSON) + "\n```"
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(fenced),
    )
    resp = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("poster.png", TINY_PNG, "image/png")},
    )
    assert resp.status_code == 200


async def test_invalid_json_retries_once_then_succeeds(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response("not json at all"),
    )
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(json.dumps(VALID_CRITIC_JSON)),
    )
    resp = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("poster.png", TINY_PNG, "image/png")},
    )
    assert resp.status_code == 200
    assert len(httpx_mock.get_requests()) == 2


async def test_invalid_json_twice_returns_502(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response("still not json"),
    )
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response("still not json"),
    )
    resp = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("poster.png", TINY_PNG, "image/png")},
    )
    assert resp.status_code == 502


async def test_upstream_http_error_returns_502(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    httpx_mock.add_response(url="https://openrouter.ai/api/v1/chat/completions", status_code=429, text="rate limited")
    resp = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("poster.png", TINY_PNG, "image/png")},
    )
    assert resp.status_code == 502


async def test_round_defaults_to_1_and_is_bounded(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    brand = await _create_brand(client)
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(json.dumps(VALID_CRITIC_JSON)),
    )
    resp = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("poster.png", TINY_PNG, "image/png")},
    )
    assert resp.json()["round"] == 1

    resp2 = await client.post(
        f"/v1/brands/{brand['id']}/signal-check",
        files={"image": ("poster.png", TINY_PNG, "image/png")},
        data={"round": "3"},
    )
    assert resp2.status_code == 422
