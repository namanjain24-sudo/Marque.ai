"""F2 — Brand Memory."""

import asyncio

import pytest


async def _create(client, **overrides):
    payload = {"name": "Memory Test", "category": "Cafe", "price_level": 2, "personality": ["playful"]}
    payload.update(overrides)
    resp = await client.post("/v1/brands", json=payload)
    assert resp.status_code == 201
    return resp.json()


async def test_list_and_get(client):
    created = await _create(client)
    resp = await client.get("/v1/brands")
    assert resp.status_code == 200
    assert any(b["id"] == created["id"] for b in resp.json())

    resp = await client.get(f"/v1/brands/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Memory Test"


async def test_404_on_unknown_brand(client):
    assert (await client.get("/v1/brands/brand_nope")).status_code == 404
    assert (await client.patch("/v1/brands/brand_nope/memory", json={"city": "x"})).status_code == 404


async def test_patch_updates_only_given_fields(client):
    brand = await _create(client, city="Delhi")
    resp = await client.patch(f"/v1/brands/{brand['id']}/memory", json={"city": "Mumbai"})
    d = resp.json()
    assert d["city"] == "Mumbai"
    assert d["name"] == brand["name"]
    assert d["version"] == brand["version"] + 1


async def test_explicit_null_clears_a_field(client):
    brand = await _create(client, city="Delhi")
    resp = await client.patch(f"/v1/brands/{brand['id']}/memory", json={"city": None})
    assert resp.json()["city"] is None


async def test_noop_patch_does_not_bump_version(client):
    brand = await _create(client)
    v0 = brand["version"]

    resp = await client.patch(f"/v1/brands/{brand['id']}/memory", json={})
    assert resp.json()["version"] == v0

    resp = await client.patch(f"/v1/brands/{brand['id']}/memory", json={"name": brand["name"]})
    assert resp.json()["version"] == v0

    resp = await client.patch(f"/v1/brands/{brand['id']}/memory", json={"name": "Actually Different"})
    assert resp.json()["version"] == v0 + 1


async def test_list_field_patch_replaces_not_appends(client):
    """Documents current behavior (see PROGRESS.md for the open design
    question about whether this should instead be additive)."""
    brand = await _create(client)
    original_dont = brand["dont"]
    assert len(original_dont) == 3

    resp = await client.patch(f"/v1/brands/{brand['id']}/memory", json={"dont": ["neon colours"]})
    assert resp.json()["dont"] == ["neon colours"]  # replaced, not merged with original_dont


async def test_all_profile_fields_are_editable(client):
    brand = await _create(client)
    full_patch = {
        "name": "Renamed", "category": "Bakery", "city": "Chennai", "audience": "students",
        "price_level": 3, "products": [{"name": "Croissant", "price": 120.0, "photo": None}],
        "positioning": {"premium": 10, "modern": 20, "playful": 30, "niche": 40},
        "personality": ["quirky"],
        "palette": {"primary": "#000000", "secondary": "#111111", "accent": "#222222", "light": "#eeeeee", "dark": "#000000"},
        "fonts": {"heading": "Oswald", "body": "Lato"},
        "logo": {"type": "upload", "url": "/u/logo.png"},
        "photo_style": "bright, airy",
        "voice": {"language": "English", "tone": "witty"},
        "meaning": {"black": "edgy"},
        "do": ["x"], "dont": ["y"], "preferences": ["shorter headlines"],
    }
    resp = await client.patch(f"/v1/brands/{brand['id']}/memory", json=full_patch)
    updated = resp.json()
    for key, expected in full_patch.items():
        assert updated[key] == expected, f"{key}: expected {expected!r}, got {updated[key]!r}"

    # independently re-fetch — not just an echo of the request
    refetched = (await client.get(f"/v1/brands/{brand['id']}")).json()
    for key, expected in full_patch.items():
        assert refetched[key] == expected


async def test_concurrent_patches_do_not_lose_updates(client):
    """Regression test for a real lost-update bug found during manual
    testing: concurrent read-modify-write patches without row locking
    silently dropped 3 of 5 concurrent changes. Fixed with
    `with_for_update=True`."""
    brand = await _create(client)
    bid = brand["id"]
    patches = [
        {"city": "CityA"}, {"audience": "AudienceB"}, {"photo_style": "styleC"},
        {"preferences": ["prefD"]}, {"category": "CategoryE"},
    ]
    await asyncio.gather(*(client.patch(f"/v1/brands/{bid}/memory", json=p) for p in patches))

    final = (await client.get(f"/v1/brands/{bid}")).json()
    assert final["city"] == "CityA"
    assert final["audience"] == "AudienceB"
    assert final["photo_style"] == "styleC"
    assert final["preferences"] == ["prefD"]
    assert final["category"] == "CategoryE"
    assert final["version"] == brand["version"] + len(patches)


async def test_concurrent_patches_do_not_cross_contaminate_brands(client):
    a = await _create(client, name="Brand A")
    b = await _create(client, name="Brand B")
    await asyncio.gather(
        client.patch(f"/v1/brands/{a['id']}/memory", json={"dont": ["rule-for-A"]}),
        client.patch(f"/v1/brands/{b['id']}/memory", json={"dont": ["rule-for-B"]}),
    )
    a_final = (await client.get(f"/v1/brands/{a['id']}")).json()
    b_final = (await client.get(f"/v1/brands/{b['id']}")).json()
    assert a_final["dont"] == ["rule-for-A"]
    assert b_final["dont"] == ["rule-for-B"]


async def test_oversized_input_rejected_on_patch_too(client):
    brand = await _create(client)
    resp = await client.patch(f"/v1/brands/{brand['id']}/memory", json={"dont": ["x" * 500]})
    assert resp.status_code == 422


@pytest.mark.parametrize("bad_hex", ["red", "#GGGGGG", "#FFF", "E63946", "#E63946FF"])
async def test_invalid_hex_color_rejected(client, bad_hex):
    brand = await _create(client)
    resp = await client.patch(
        f"/v1/brands/{brand['id']}/memory",
        json={"palette": {"primary": bad_hex, "secondary": "#111111", "accent": "#F1FAEE"}},
    )
    assert resp.status_code == 422


async def test_valid_hex_color_accepted(client):
    brand = await _create(client)
    resp = await client.patch(
        f"/v1/brands/{brand['id']}/memory",
        json={"palette": {"primary": "#AABBCC", "secondary": "#111111", "accent": "#F1FAEE"}},
    )
    assert resp.status_code == 200
    assert resp.json()["palette"]["primary"] == "#AABBCC"


async def test_invalid_logo_type_rejected(client):
    brand = await _create(client)
    resp = await client.patch(f"/v1/brands/{brand['id']}/memory", json={"logo": {"type": "generated-by-ai"}})
    assert resp.status_code == 422


async def test_list_pagination(client):
    for i in range(5):
        await _create(client, name=f"Page Brand {i}")

    resp = await client.get("/v1/brands", params={"limit": 2, "offset": 0})
    assert resp.status_code == 200
    page1 = resp.json()
    assert len(page1) == 2

    resp = await client.get("/v1/brands", params={"limit": 2, "offset": 2})
    page2 = resp.json()
    assert len(page2) == 2
    assert {b["id"] for b in page1}.isdisjoint({b["id"] for b in page2})


async def test_list_limit_bounds_rejected(client):
    assert (await client.get("/v1/brands", params={"limit": 0})).status_code == 422
    assert (await client.get("/v1/brands", params={"limit": 501})).status_code == 422
    assert (await client.get("/v1/brands", params={"offset": -1})).status_code == 422


class TestAppendRule:
    """POST /memory/rules — add one do/dont/preference entry without
    resending the whole list (PATCH /memory replaces the list wholesale)."""

    async def test_appends_without_touching_existing_entries(self, client):
        brand = await _create(client)
        original_dont = brand["dont"]
        resp = await client.post(f"/v1/brands/{brand['id']}/memory/rules", json={"field": "dont", "value": "neon colours"})
        d = resp.json()
        assert d["dont"] == [*original_dont, "neon colours"]
        assert d["version"] == brand["version"] + 1

    async def test_duplicate_value_is_a_noop(self, client):
        brand = await _create(client)
        first = (await client.post(f"/v1/brands/{brand['id']}/memory/rules", json={"field": "dont", "value": "neon colours"})).json()
        second = (await client.post(f"/v1/brands/{brand['id']}/memory/rules", json={"field": "dont", "value": "neon colours"})).json()
        assert first["dont"] == second["dont"]
        assert first["version"] == second["version"]

    async def test_works_for_do_and_preferences_too(self, client):
        brand = await _create(client)
        d = (await client.post(f"/v1/brands/{brand['id']}/memory/rules", json={"field": "do", "value": "warm lighting"})).json()
        assert "warm lighting" in d["do"]
        p = (await client.post(f"/v1/brands/{brand['id']}/memory/rules", json={"field": "preferences", "value": "shorter headlines"})).json()
        assert "shorter headlines" in p["preferences"]

    async def test_unknown_brand_404(self, client):
        resp = await client.post("/v1/brands/brand_nope/memory/rules", json={"field": "dont", "value": "x"})
        assert resp.status_code == 404

    async def test_invalid_field_rejected(self, client):
        brand = await _create(client)
        resp = await client.post(f"/v1/brands/{brand['id']}/memory/rules", json={"field": "personality", "value": "x"})
        assert resp.status_code == 422

    async def test_empty_value_rejected(self, client):
        brand = await _create(client)
        resp = await client.post(f"/v1/brands/{brand['id']}/memory/rules", json={"field": "dont", "value": ""})
        assert resp.status_code == 422

    async def test_max_items_cap_enforced(self, client):
        brand = await _create(client)
        bid = brand["id"]
        # 3 default dont rules already present; fill up to the cap of 20
        for i in range(20 - len(brand["dont"])):
            resp = await client.post(f"/v1/brands/{bid}/memory/rules", json={"field": "dont", "value": f"rule-{i}"})
            assert resp.status_code == 200
        final = (await client.get(f"/v1/brands/{bid}")).json()
        assert len(final["dont"]) == 20

        resp = await client.post(f"/v1/brands/{bid}/memory/rules", json={"field": "dont", "value": "one-too-many"})
        assert resp.status_code == 422

    async def test_concurrent_appends_do_not_lose_entries(self, client):
        brand = await _create(client)
        bid = brand["id"]
        values = [f"concurrent-rule-{i}" for i in range(6)]
        await asyncio.gather(
            *(client.post(f"/v1/brands/{bid}/memory/rules", json={"field": "dont", "value": v}) for v in values)
        )
        final = (await client.get(f"/v1/brands/{bid}")).json()
        for v in values:
            assert v in final["dont"]
        assert len(final["dont"]) == len(brand["dont"]) + len(values)
