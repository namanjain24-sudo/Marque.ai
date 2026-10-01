"""F5 + P4 — agent orchestrator: campaign generation + persistence.
No network: with no key the intent classifier is heuristic and generation is
pure Python, so these run in CI without a key.

/agent/run now returns an AgentRunOut: { intent, source, trace, reply,
campaign? }. For a generation goal the campaign is nested under `campaign`.
"""

from knobs import ACCENT_RANGE, KNOB_VALUES, OVERLAY_RANGE

EXPECTED_TYPES = ["poster", "post", "story", "whatsapp"]


async def _create_brand(client, **overrides):
    payload = {"name": "Agent Test", "category": "Cafe", "price_level": 2}
    payload.update(overrides)
    resp = await client.post("/v1/brands", json=payload)
    assert resp.status_code == 201
    return resp.json()


async def _run_campaign(client, brand_id, goal):
    """Run a generation goal and return the nested campaign, asserting the
    orchestrator classified it as create_campaign (heuristic path, no key)."""
    resp = await client.post(f"/v1/brands/{brand_id}/agent/run", json={"goal": goal})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["intent"] == "create_campaign"
    assert body["campaign"] is not None
    # The trace is real: at least load + classify + write + render steps.
    assert len(body["trace"]) >= 3
    assert all("label" in s and "ms" in s for s in body["trace"])
    return body["campaign"]


async def test_agent_run_returns_four_assets(client):
    brand = await _create_brand(client)
    campaign = await _run_campaign(client, brand["id"], "Launch our truffle burger at ₹399 this weekend")
    assert [a["type"] for a in campaign["assets"]] == EXPECTED_TYPES
    assert campaign["objective"] == "Launch our truffle burger at ₹399 this weekend"
    assert campaign["status"] == "Draft"


async def test_price_is_extracted_into_slots(client):
    brand = await _create_brand(client)
    campaign = await _run_campaign(client, brand["id"], "Truffle burger at ₹399 this weekend")
    assets = campaign["assets"]
    assert all(a["slots"]["price"] == "₹399" for a in assets)
    assert "399" not in assets[0]["slots"]["headline"]


async def test_goal_without_price_has_null_price(client):
    brand = await _create_brand(client)
    campaign = await _run_campaign(client, brand["id"], "Announce our new Saket outlet opening")
    assert all(a["slots"]["price"] is None for a in campaign["assets"])


async def test_all_knob_values_are_in_vocabulary(client):
    brand = await _create_brand(client)
    campaign = await _run_campaign(client, brand["id"], "Weekend combo offer ₹299")
    for asset in campaign["assets"]:
        k = asset["knobs"]
        assert k["density"] in KNOB_VALUES["density"]
        assert k["font_style"] in KNOB_VALUES["font_style"]
        assert k["photo_tone"] in KNOB_VALUES["photo_tone"]
        assert k["layout_variant"] in KNOB_VALUES["layout_variant"]
        assert ACCENT_RANGE[0] <= k["accent_usage"] <= ACCENT_RANGE[1]
        assert OVERLAY_RANGE[0] <= k["overlay"] <= OVERLAY_RANGE[1]


async def test_logo_slot_is_the_brand_name(client):
    brand = await _create_brand(client, name="Burger Lab")
    campaign = await _run_campaign(client, brand["id"], "New menu launch")
    assert all(a["slots"]["logo"] == "Burger Lab" for a in campaign["assets"])


async def test_assets_have_no_signal_until_checked(client):
    brand = await _create_brand(client)
    campaign = await _run_campaign(client, brand["id"], "New menu launch ₹199")
    for asset in campaign["assets"]:
        assert asset["signal_match"] is None
        assert asset["signal_verdict"] is None


async def test_agent_run_404_for_unknown_brand(client):
    resp = await client.post("/v1/brands/brand_nope/agent/run", json={"goal": "anything ₹100"})
    assert resp.status_code == 404


async def test_empty_goal_is_rejected(client):
    brand = await _create_brand(client)
    resp = await client.post(f"/v1/brands/{brand['id']}/agent/run", json={"goal": "   "})
    assert resp.status_code == 422


async def test_campaign_is_persisted_and_listable(client):
    brand = await _create_brand(client)
    campaign = await _run_campaign(client, brand["id"], "Diwali combo 20% off ₹299")
    campaign_id = campaign["id"]

    listing = await client.get(f"/v1/brands/{brand['id']}/campaigns")
    assert listing.status_code == 200
    assert campaign_id in [c["id"] for c in listing.json()]

    detail = await client.get(f"/v1/campaigns/{campaign_id}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["id"] == campaign_id
    assert [a["type"] for a in body["assets"]] == EXPECTED_TYPES
    assert body["assets"][0]["slots"]["logo"] == brand["name"]


async def test_get_unknown_campaign_404(client):
    resp = await client.get("/v1/campaigns/c_nope")
    assert resp.status_code == 404


# --- P4: intent routing (heuristic path, no key) ---


async def test_brand_question_intent_answers_without_campaign(client):
    brand = await _create_brand(client, name="Chai Point")
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "what is our brand tone?"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["intent"] == "brand_question"
    assert body["campaign"] is None
    assert body["reply"]  # a non-empty answer


async def test_update_memory_intent_appends_a_rule(client):
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "never use neon colours"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["intent"] == "update_memory"
    assert body["memory_field"] == "dont"
    assert "neon" in body["memory_value"].lower()
    # The rule is actually persisted to brand memory.
    brand_after = (await client.get(f"/v1/brands/{brand['id']}")).json()
    assert any("neon" in r.lower() for r in brand_after["dont"])
