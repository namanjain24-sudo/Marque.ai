"""P2 — Real LLM copywriter (SPEC Phase 2).

Zero-credit: every test either leaves the key unset (regex fallback) or mocks the
OpenRouter call with pytest-httpx. The facts-rule tests are the trust/safety
point judges care about — the price in the slots comes ONLY from the goal, never
from the model, even when the model tries to smuggle one in.
"""

import json

import pytest

# Valid creative core the LLM would return (WORDS only — no price/number).
VALID_COPY_JSON = {
    "headline": "Truffle, meet your match",
    "subline": "Hand-smashed patties, house truffle mayo",
    "core_message": "Our new truffle burger lands this week, made for bold palates.",
}


def _openrouter_response(content: str) -> dict:
    return {"choices": [{"message": {"content": content}}]}


async def _create_brand(client, **overrides):
    # Force heuristic DNA at onboarding (setup) regardless of a test-set key.
    import os

    payload = {"name": "Burger Lab", "category": "Restaurant - Burgers", "price_level": 2}
    payload.update(overrides)
    saved = os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        resp = await client.post("/v1/brands", json=payload)
    finally:
        if saved is not None:
            os.environ["OPENROUTER_API_KEY"] = saved
    assert resp.status_code == 201
    return resp.json()


# --- Heuristic fallback (no key): regex copy, no network ---

async def test_no_key_uses_regex_copy(client, monkeypatch, httpx_mock):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Diwali offer 20% off on combos ₹299"},
    )
    assert resp.status_code == 201
    assert len(httpx_mock.get_requests()) == 0
    d = resp.json()
    # Regex headline path still works; price extracted from the goal.
    assert d["assets"][0]["slots"]["price"] == "₹299"


# --- LLM happy path: model copy lands in every asset's slots ---

async def test_llm_copy_lands_in_slots(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(json.dumps(VALID_COPY_JSON)),
    )
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Launch our new truffle burger this week"},
    )
    assert resp.status_code == 201
    d = resp.json()
    assert d["name"] == VALID_COPY_JSON["headline"]
    for asset in d["assets"]:
        assert asset["slots"]["headline"] == VALID_COPY_JSON["headline"]
    # Exactly one LLM call for the whole campaign (not one per asset).
    assert len(httpx_mock.get_requests()) == 1


# --- Facts rule: price comes ONLY from the goal, never from the model ---

async def test_facts_rule_price_only_from_goal(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    # The model tries to smuggle a different price into its copy.
    sneaky = {
        "headline": "Grab it for just ₹99 today",
        "subline": "Lowest ever ₹99 deal",
        "core_message": "Only ₹99 this week!",
    }
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(json.dumps(sneaky)),
    )
    brand = await _create_brand(client)
    # The owner's goal says ₹299 — that is the ONLY figure allowed in the badge.
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Truffle burger combo ₹299"},
    )
    assert resp.status_code == 201
    d = resp.json()
    # The price slot is the goal's ₹299, not the model's ₹99.
    assert d["assets"][0]["slots"]["price"] == "₹299"


async def test_facts_rule_no_price_in_goal_means_null_price(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    # Model invents a price though the goal has none.
    invented = {"headline": "Big launch", "subline": "From ₹149", "core_message": "Deal from ₹149"}
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(json.dumps(invented)),
    )
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Launch our new truffle burger"},  # no price
    )
    assert resp.status_code == 201
    # No figure in the goal -> the price badge is null (never the invented ₹149).
    assert resp.json()["assets"][0]["slots"]["price"] is None


# --- Reliability: retry once on bad JSON, then succeed ---

async def test_bad_json_retry_then_succeed(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response("not json"),
    )
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(json.dumps(VALID_COPY_JSON)),
    )
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Launch our new truffle burger"},
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == VALID_COPY_JSON["headline"]
    assert len(httpx_mock.get_requests()) == 2


# --- Fallback: bad JSON twice / 5xx -> regex copy, campaign still 201 ---

async def test_bad_json_twice_falls_back(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    for _ in range(2):
        httpx_mock.add_response(
            url="https://openrouter.ai/api/v1/chat/completions",
            json=_openrouter_response("junk"),
        )
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Launch our new truffle burger"},
    )
    assert resp.status_code == 201
    # Regex headline, not the model's (which never parsed).
    assert resp.json()["name"] != VALID_COPY_JSON["headline"]


async def test_upstream_5xx_falls_back(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        status_code=500,
        text="boom",
    )
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Launch our new truffle burger"},
    )
    assert resp.status_code == 201  # campaign survives an OpenRouter outage
