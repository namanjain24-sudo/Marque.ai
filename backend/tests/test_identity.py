"""F3 — Brand Identity (light)."""

import asyncio

import pytest


async def _create(client, **overrides):
    payload = {"name": "Identity Test", "category": "Cafe"}
    payload.update(overrides)
    resp = await client.post("/v1/brands", json=payload)
    assert resp.status_code == 201
    return resp.json()


async def test_proposes_two_distinct_complete_directions(client):
    brand = await _create(client, price_level=3, personality=["premium", "classic", "formal"])
    resp = await client.get(f"/v1/brands/{brand['id']}/identity")
    assert resp.status_code == 200
    dirs = resp.json()
    assert len(dirs) == 2
    assert dirs[0]["key"] != dirs[1]["key"]
    for d in dirs:
        assert set(d["palette"]) == {"primary", "secondary", "accent", "light", "dark"}
        assert set(d["fonts"]) == {"heading", "body"}
        assert d["meaning"]


async def test_proposal_is_deterministic(client):
    brand = await _create(client, price_level=3, personality=["premium"])
    first = (await client.get(f"/v1/brands/{brand['id']}/identity")).json()
    second = (await client.get(f"/v1/brands/{brand['id']}/identity")).json()
    assert [d["key"] for d in first] == [d["key"] for d in second]


async def test_404s(client):
    brand = await _create(client)
    assert (await client.get("/v1/brands/brand_nope/identity")).status_code == 404
    assert (await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "fake"})).status_code == 404
    assert (await client.post("/v1/brands/brand_nope/identity/apply", json={"key": "bold_premium"})).status_code == 404
    assert (await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={})).status_code == 422


async def test_apply_sets_exact_palette_and_fonts_and_bumps_version(client):
    brand = await _create(client)
    resp = await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "earthy_niche"})
    d = resp.json()
    assert d["palette"]["primary"] == "#6B4226"
    assert d["fonts"] == {"heading": "Fraunces", "body": "Work Sans"}
    assert d["version"] == brand["version"] + 1


async def test_switching_direction_fully_replaces_no_mixing(client):
    brand = await _create(client)
    await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "earthy_niche"})
    resp = await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "bold_premium"})
    d = resp.json()
    assert d["palette"] == {"primary": "#E63946", "secondary": "#111111", "accent": "#F1FAEE", "light": "#FFFFFF", "dark": "#0B0B0B"}


async def test_apply_does_not_touch_unrelated_fields(client):
    brand = await _create(client)
    resp = await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "bold_premium"})
    d = resp.json()
    assert d["name"] == brand["name"]
    assert d["do"] == brand["do"]
    assert d["dont"] == brand["dont"]
    assert d["positioning"] == brand["positioning"]


async def test_uploaded_logo_is_preserved_through_apply(client):
    brand = await _create(client)
    await client.patch(f"/v1/brands/{brand['id']}/memory", json={"logo": {"type": "upload", "url": "/u/mine.png"}})
    resp = await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "bold_premium"})
    assert resp.json()["logo"] == {"type": "upload", "url": "/u/mine.png"}


@pytest.mark.parametrize("key", ["bold_premium", "elegant_classic", "playful_bright", "modern_minimal", "earthy_niche"])
async def test_every_template_applies_cleanly(client, key):
    brand = await _create(client)
    resp = await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": key})
    assert resp.status_code == 200
    assert resp.json()["palette"] is not None


async def test_reapplying_same_direction_is_a_noop(client):
    brand = await _create(client)
    first = (await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "bold_premium"})).json()
    second = (await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "bold_premium"})).json()
    assert first["version"] == second["version"]


class TestPartialApply:
    """PRD F3: 'user can lock/regenerate individual parts (colours, fonts)'."""

    async def test_palette_only_leaves_fonts_and_meaning_untouched(self, client):
        brand = await _create(client)
        baseline = (await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "elegant_classic"})).json()

        resp = await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "playful_bright", "fields": ["palette"]})
        d = resp.json()
        assert d["palette"]["primary"] == "#FF6B35"
        assert d["fonts"] == baseline["fonts"]
        assert d["meaning"] == baseline["meaning"]

    async def test_fonts_only_leaves_palette_and_meaning_untouched(self, client):
        brand = await _create(client)
        baseline = (await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "elegant_classic"})).json()

        resp = await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "modern_minimal", "fields": ["fonts"]})
        d = resp.json()
        assert d["fonts"]["heading"] == "Space Grotesk"
        assert d["palette"] == baseline["palette"]
        assert d["meaning"] == baseline["meaning"]

    async def test_empty_fields_list_rejected(self, client):
        brand = await _create(client)
        resp = await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "bold_premium", "fields": []})
        assert resp.status_code == 422

    async def test_invalid_field_name_rejected(self, client):
        brand = await _create(client)
        resp = await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "bold_premium", "fields": ["logo"]})
        assert resp.status_code == 422

    async def test_uploaded_logo_preserved_through_partial_apply(self, client):
        brand = await _create(client)
        await client.patch(f"/v1/brands/{brand['id']}/memory", json={"logo": {"type": "upload", "url": "/u/x.png"}})
        resp = await client.post(f"/v1/brands/{brand['id']}/identity/apply", json={"key": "bold_premium", "fields": ["palette"]})
        assert resp.json()["logo"] == {"type": "upload", "url": "/u/x.png"}


async def test_mixed_concurrent_apply_and_patch_lose_nothing(client):
    """Same lost-update bug class as F2, same fix (row lock). Fires identity
    applies and memory patches at the same brand simultaneously."""
    brand = await _create(client)
    bid = brand["id"]
    tasks = [
        client.post(f"/v1/brands/{bid}/identity/apply", json={"key": "bold_premium"}),
        client.patch(f"/v1/brands/{bid}/memory", json={"city": "CityX"}),
        client.patch(f"/v1/brands/{bid}/memory", json={"audience": "AudienceY"}),
        client.post(f"/v1/brands/{bid}/identity/apply", json={"key": "playful_bright"}),
        client.patch(f"/v1/brands/{bid}/memory", json={"photo_style": "styleZ"}),
    ]
    await asyncio.gather(*tasks)

    final = (await client.get(f"/v1/brands/{bid}")).json()
    assert final["city"] == "CityX"
    assert final["audience"] == "AudienceY"
    assert final["photo_style"] == "styleZ"
    assert final["palette"]["primary"] in ("#E63946", "#FF6B35")
