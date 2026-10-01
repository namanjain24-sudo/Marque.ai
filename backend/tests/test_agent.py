"""F5 (light) — deterministic asset generation + campaign persistence.
No network: generation is pure Python, so these run in CI without a key.
"""

from knobs import ACCENT_RANGE, KNOB_VALUES, OVERLAY_RANGE

EXPECTED_TYPES = ["poster", "post", "story", "whatsapp"]


async def _create_brand(client, **overrides):
    payload = {"name": "Agent Test", "category": "Cafe", "price_level": 2}
    payload.update(overrides)
    resp = await client.post("/v1/brands", json=payload)
    assert resp.status_code == 201
    return resp.json()


async def test_agent_run_returns_four_assets(client):
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Launch our truffle burger at ₹399 this weekend"},
    )
    assert resp.status_code == 201
    campaign = resp.json()
    assert [a["type"] for a in campaign["assets"]] == EXPECTED_TYPES
    assert campaign["objective"] == "Launch our truffle burger at ₹399 this weekend"
    assert campaign["status"] == "Draft"


async def test_price_is_extracted_into_slots(client):
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Truffle burger at ₹399 this weekend"},
    )
    assets = resp.json()["assets"]
    # Every asset carries the ₹399 price badge.
    assert all(a["slots"]["price"] == "₹399" for a in assets)
    # Headline should not still contain the raw price phrase.
    assert "399" not in assets[0]["slots"]["headline"]


async def test_goal_without_price_has_null_price(client):
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Announce our new Saket outlet opening"},
    )
    assets = resp.json()["assets"]
    assert all(a["slots"]["price"] is None for a in assets)


async def test_all_knob_values_are_in_vocabulary(client):
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Weekend combo offer ₹299"},
    )
    for asset in resp.json()["assets"]:
        k = asset["knobs"]
        assert k["density"] in KNOB_VALUES["density"]
        assert k["font_style"] in KNOB_VALUES["font_style"]
        assert k["photo_tone"] in KNOB_VALUES["photo_tone"]
        assert k["layout_variant"] in KNOB_VALUES["layout_variant"]
        assert ACCENT_RANGE[0] <= k["accent_usage"] <= ACCENT_RANGE[1]
        assert OVERLAY_RANGE[0] <= k["overlay"] <= OVERLAY_RANGE[1]


async def test_logo_slot_is_the_brand_name(client):
    brand = await _create_brand(client, name="Burger Lab")
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "New menu launch"},
    )
    assert all(a["slots"]["logo"] == "Burger Lab" for a in resp.json()["assets"])


async def test_assets_have_no_signal_until_checked(client):
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "New menu launch ₹199"},
    )
    for asset in resp.json()["assets"]:
        assert asset["signal_match"] is None
        assert asset["signal_verdict"] is None


async def test_agent_run_404_for_unknown_brand(client):
    resp = await client.post(
        "/v1/brands/brand_nope/agent/run",
        json={"goal": "anything ₹100"},
    )
    assert resp.status_code == 404


async def test_empty_goal_is_rejected(client):
    brand = await _create_brand(client)
    resp = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "   "},
    )
    assert resp.status_code == 422


async def test_campaign_is_persisted_and_listable(client):
    brand = await _create_brand(client)
    run = await client.post(
        f"/v1/brands/{brand['id']}/agent/run",
        json={"goal": "Diwali combo 20% off ₹299"},
    )
    campaign_id = run.json()["id"]

    # Shows up in the brand's campaign list.
    listing = await client.get(f"/v1/brands/{brand['id']}/campaigns")
    assert listing.status_code == 200
    assert campaign_id in [c["id"] for c in listing.json()]

    # Readable individually, with the same 4 assets round-tripped.
    detail = await client.get(f"/v1/campaigns/{campaign_id}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["id"] == campaign_id
    assert [a["type"] for a in body["assets"]] == EXPECTED_TYPES
    assert body["assets"][0]["slots"]["logo"] == brand["name"]


async def test_get_unknown_campaign_404(client):
    resp = await client.get("/v1/campaigns/c_nope")
    assert resp.status_code == 404
