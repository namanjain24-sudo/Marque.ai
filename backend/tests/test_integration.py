"""F1 + F2 + F3 exercised together, not in isolation."""


async def test_full_onboarding_to_identity_to_memory_journey(client):
    resp = await client.post("/v1/brands", json={
        "name": "Journey Burger Co", "category": "Restaurant - Burgers", "city": "Delhi",
        "audience": "18-30", "price_level": 2, "personality": ["bold", "playful", "experimental"],
        "products": [{"name": "Truffle Burger", "price": 399}],
    })
    assert resp.status_code == 201
    brand = resp.json()
    bid = brand["id"]

    directions = (await client.get(f"/v1/brands/{bid}/identity")).json()
    assert len(directions) == 2

    chosen = directions[0]
    applied = (await client.post(f"/v1/brands/{bid}/identity/apply", json={"key": chosen["key"]})).json()
    assert applied["palette"] == chosen["palette"]

    patched = (await client.patch(f"/v1/brands/{bid}/memory", json={"dont": ["neon colours", "stock photos"]})).json()
    assert patched["dont"] == ["neon colours", "stock photos"]
    assert patched["palette"] == applied["palette"], "F2 patch must not clobber F3's identity"

    final = (await client.get(f"/v1/brands/{bid}")).json()
    assert final["dont"] == ["neon colours", "stock photos"]
    assert final["palette"] == applied["palette"]
    assert final["name"] == "Journey Burger Co"


async def test_many_brands_created_concurrently_get_distinct_ids(client):
    import asyncio

    resps = await asyncio.gather(
        *(client.post("/v1/brands", json={"name": f"Concurrent {i}", "category": "Cafe"}) for i in range(10))
    )
    assert all(r.status_code == 201 for r in resps)
    ids = [r.json()["id"] for r in resps]
    assert len(set(ids)) == 10


async def test_meaning_dict_is_independent_per_brand(client):
    """Regression test for a real shared-mutable-dict bug found during manual
    testing (profile.meaning aliased the module-level TEMPLATES dict)."""
    a = (await client.post("/v1/brands", json={"name": "A", "category": "Cafe", "personality": ["premium"]})).json()
    b = (await client.post("/v1/brands", json={"name": "B", "category": "Cafe", "personality": ["playful"]})).json()
    assert a["meaning"] is not b["meaning"]

    await client.patch(f"/v1/brands/{a['id']}/memory", json={"meaning": {**a["meaning"], "extra": "only on A"}})
    b_after = (await client.get(f"/v1/brands/{b['id']}")).json()
    assert "extra" not in b_after["meaning"]
