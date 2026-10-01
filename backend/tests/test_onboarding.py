"""F1 — Brand Onboarding + Brand DNA."""

import time

import pytest


async def test_onboarding_is_fast(client):
    t0 = time.monotonic()
    resp = await client.post("/v1/brands", json={"name": "Timing", "category": "Cafe"})
    assert time.monotonic() - t0 < 30  # PRD acceptance: under 30s
    assert resp.status_code == 201


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "Burger Lab Clone", "category": "Restaurant", "price_level": 2, "personality": ["bold", "playful", "experimental"]},
        {"name": "Spice Route", "category": "North Indian", "price_level": 3, "personality": ["premium", "classic", "formal"]},
        {"name": "Budget Thali", "category": "Thali", "price_level": 1, "personality": ["affordable", "simple"]},
        {"name": "No Personality", "category": "Bakery", "price_level": 2, "personality": []},
        {"name": "Unknown Words", "category": "Bar", "price_level": 2, "personality": ["zzz-unknown"]},
        {"name": "Minimal", "category": "Juice Bar"},
    ],
)
async def test_draft_profile_has_no_blank_fields(client, payload):
    """PRD F1 acceptance: 'at least colours, tone, 4 slider values and 3
    do/dont rules are filled' — regardless of what the owner provided."""
    resp = await client.post("/v1/brands", json=payload)
    assert resp.status_code == 201
    d = resp.json()
    assert d["palette"] is not None
    assert d["fonts"] is not None
    assert d["voice"]["tone"]
    assert set(d["positioning"]) == {"premium", "modern", "playful", "niche"}
    assert all(0 <= v <= 100 for v in d["positioning"].values())
    assert len(d["do"]) == 3
    assert len(d["dont"]) == 3
    assert d["version"] == 1


@pytest.mark.parametrize(
    "payload,expected_status",
    [
        ({"category": "Cafe"}, 422),  # missing name
        ({"name": "X"}, 422),  # missing category
        ({"name": "", "category": "Cafe"}, 422),  # empty name
        ({"name": "   ", "category": "Cafe"}, 422),  # whitespace-only name
        ({"name": "A" * 300, "category": "Cafe"}, 422),  # oversized name
        ({"name": "X", "category": "Cafe", "price_level": 0}, 422),
        ({"name": "X", "category": "Cafe", "price_level": 4}, 422),
        ({"name": "X", "category": "Cafe", "products": [{"name": ""}]}, 422),
        ({"name": "X", "category": "Cafe", "products": [{"name": "c", "price": -1}]}, 422),
        ({"name": "X", "category": "Cafe", "personality": ["p"] * 21}, 422),
        ({"name": "X", "category": "Cafe"}, 201),
        ({"name": "X", "category": "Cafe", "personality": ["p"] * 20}, 201),  # boundary
    ],
)
async def test_validation(client, payload, expected_status):
    resp = await client.post("/v1/brands", json=payload)
    assert resp.status_code == expected_status


async def test_whitespace_is_stripped(client):
    resp = await client.post("/v1/brands", json={"name": "  Burger Lab  ", "category": "  Cafe  "})
    d = resp.json()
    assert d["name"] == "Burger Lab"
    assert d["category"] == "Cafe"


async def test_sql_injection_like_input_is_inert(client):
    resp = await client.post("/v1/brands", json={"name": "Robert'); DROP TABLE brands;--", "category": "Cafe"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "Robert'); DROP TABLE brands;--"
    # table must still be queryable
    assert (await client.get("/v1/brands")).status_code == 200


async def test_unicode_and_emoji_round_trip(client):
    resp = await client.post("/v1/brands", json={"name": "चाय वाला ☕️🔥", "category": "Cafe"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "चाय वाला ☕️🔥"
