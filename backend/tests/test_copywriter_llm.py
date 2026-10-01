"""P2 — Real LLM copywriter (SPEC Phase 2), exercised through the P4 orchestrator.

Zero-credit: every test either leaves the key unset (regex fallback) or mocks the
OpenRouter calls with pytest-httpx. The facts-rule tests are the trust/safety
point — the price in the slots comes ONLY from the goal, never from the model,
even when the model tries to smuggle one in.

Note on call ordering: with a key set, /agent/run makes TWO LLM calls for a
generation goal — first the intent classifier, then the copywriter. Each test
that sets a key mocks the intent response first (via `_mock_intent_create`), then
the copy response(s). `_create_brand` unsets the key during onboarding so no DNA
call interferes.
"""

import json

# Valid creative core the LLM would return (WORDS only — no price/number).
VALID_COPY_JSON = {
    "headline": "Truffle, meet your match",
    "subline": "Hand-smashed patties, house truffle mayo",
    "core_message": "Our new truffle burger lands this week, made for bold palates.",
}

_INTENT_CREATE = {"intent": "create_campaign", "memory_field": None, "memory_value": None}


def _openrouter_response(content: str) -> dict:
    return {"choices": [{"message": {"content": content}}]}


def _mock_intent_create(httpx_mock):
    """First LLM call in /agent/run is intent classification — return create_campaign."""
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(json.dumps(_INTENT_CREATE)),
    )


def _mock_copy(httpx_mock, payload):
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        json=_openrouter_response(payload if isinstance(payload, str) else json.dumps(payload)),
    )


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


async def _run(client, brand_id, goal):
    resp = await client.post(f"/v1/brands/{brand_id}/agent/run", json={"goal": goal})
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- Heuristic fallback (no key): regex copy, no network ---

async def test_no_key_uses_regex_copy(client, monkeypatch, httpx_mock):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    brand = await _create_brand(client)
    body = await _run(client, brand["id"], "Diwali offer 20% off on combos ₹299")
    assert len(httpx_mock.get_requests()) == 0  # no LLM calls at all
    assert body["intent"] == "create_campaign"
    assert body["campaign"]["assets"][0]["slots"]["price"] == "₹299"


# --- LLM happy path: model copy lands in every asset's slots ---

async def test_llm_copy_lands_in_slots(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    _mock_intent_create(httpx_mock)
    _mock_copy(httpx_mock, VALID_COPY_JSON)
    brand = await _create_brand(client)
    body = await _run(client, brand["id"], "Launch our new truffle burger this week")
    c = body["campaign"]
    assert c["name"] == VALID_COPY_JSON["headline"]
    for asset in c["assets"]:
        assert asset["slots"]["headline"] == VALID_COPY_JSON["headline"]
    # Two calls: intent + one copy call for the whole campaign (not per asset).
    assert len(httpx_mock.get_requests()) == 2


# --- Facts rule: price comes ONLY from the goal, never from the model ---

async def test_facts_rule_price_only_from_goal(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    _mock_intent_create(httpx_mock)
    sneaky = {
        "headline": "Grab it for just ₹99 today",
        "subline": "Lowest ever ₹99 deal",
        "core_message": "Only ₹99 this week!",
    }
    _mock_copy(httpx_mock, sneaky)
    brand = await _create_brand(client)
    body = await _run(client, brand["id"], "Truffle burger combo ₹299")
    # The price slot is the goal's ₹299, not the model's ₹99.
    assert body["campaign"]["assets"][0]["slots"]["price"] == "₹299"


async def test_facts_rule_no_price_in_goal_means_null_price(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    _mock_intent_create(httpx_mock)
    invented = {"headline": "Big launch", "subline": "From ₹149", "core_message": "Deal from ₹149"}
    _mock_copy(httpx_mock, invented)
    brand = await _create_brand(client)
    body = await _run(client, brand["id"], "Launch our new truffle burger")  # no price
    # No figure in the goal -> the price badge is null (never the invented ₹149).
    assert body["campaign"]["assets"][0]["slots"]["price"] is None


# --- Reliability: retry once on bad JSON, then succeed ---

async def test_bad_json_retry_then_succeed(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    _mock_intent_create(httpx_mock)
    _mock_copy(httpx_mock, "not json")
    _mock_copy(httpx_mock, VALID_COPY_JSON)
    brand = await _create_brand(client)
    body = await _run(client, brand["id"], "Launch our new truffle burger")
    assert body["campaign"]["name"] == VALID_COPY_JSON["headline"]
    # intent + copy(bad) + copy(retry) = 3 calls.
    assert len(httpx_mock.get_requests()) == 3


# --- Fallback: bad JSON twice / 5xx -> regex copy, campaign still 201 ---

async def test_bad_json_twice_falls_back(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    _mock_intent_create(httpx_mock)
    _mock_copy(httpx_mock, "junk")
    _mock_copy(httpx_mock, "junk")
    brand = await _create_brand(client)
    body = await _run(client, brand["id"], "Launch our new truffle burger")
    # Regex headline, not the model's (which never parsed).
    assert body["campaign"]["name"] != VALID_COPY_JSON["headline"]


async def test_upstream_5xx_falls_back(client, monkeypatch, httpx_mock):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    _mock_intent_create(httpx_mock)
    httpx_mock.add_response(
        url="https://openrouter.ai/api/v1/chat/completions",
        status_code=500,
        text="boom",
    )
    brand = await _create_brand(client)
    body = await _run(client, brand["id"], "Launch our new truffle burger")
    assert body["campaign"] is not None  # campaign survives an OpenRouter outage
