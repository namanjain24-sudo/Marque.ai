"""Pure unit tests for asset_gen — no network, no DB, no client fixture.

These import asset_gen and schemas directly to test the deterministic
generation logic, especially the Brand Memory dont-rule guard in _headline.
"""

import sys
import os

# Ensure the backend package root is on sys.path so direct imports work.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from asset_gen import _headline, generate_campaign
from schemas import BrandProfile


def _minimal_brand(**overrides) -> BrandProfile:
    """Construct the smallest valid BrandProfile for unit tests.
    All fields with defaults are omitted; only the required ones are set.
    """
    defaults = {
        "name": "Burger Lab",
        "category": "Cafe",
    }
    defaults.update(overrides)
    return BrandProfile(**defaults)


# ---------------------------------------------------------------------------
# _headline tests
# ---------------------------------------------------------------------------


def test_headline_strips_price():
    """_headline removes the ₹ price phrase so it doesn't repeat the badge."""
    brand = _minimal_brand()
    result = _headline("Launch our truffle burger at ₹399", brand)
    assert "399" not in result
    assert "₹" not in result
    # Should still contain meaningful content from the goal.
    assert len(result) > 0


def test_headline_falls_back_on_dont_word():
    """If a meaningful word (len > 3) from any dont rule appears in the
    generated headline, _headline must return brand.name, not the headline."""
    brand = _minimal_brand(dont=["Never use the word fresh"])
    result = _headline("Our fresh new burger deal", brand)
    assert result == brand.name


def test_headline_no_dont_match_keeps_headline():
    """If the dont rule's words are not present in the headline, the real
    generated headline is returned — not brand.name."""
    brand = _minimal_brand(dont=["Never use green as primary"])
    result = _headline("Launch our truffle burger", brand)
    # "green" is not in the headline, so the real headline is returned.
    assert result != brand.name
    assert "truffle" in result.lower() or "burger" in result.lower() or len(result) > 0
    # Specifically: none of the dont words are present.
    assert "green" not in result.lower()
    assert "primary" not in result.lower()


def test_headline_short_dont_words_ignored():
    """Dont rule words with len <= 3 are skipped by the guard (the `len > 3`
    filter). A rule of only short words must never trigger the fallback."""
    brand = _minimal_brand(dont=["no ad"])
    # "no" (len 2) and "ad" (len 2) are both <= 3, so guard is never triggered.
    result = _headline("Launch our truffle burger", brand)
    assert result != brand.name
    assert "truffle" in result.lower() or "burger" in result.lower()


def test_headline_empty_dont_list_returns_headline():
    """An empty dont list (the default) means the guard never fires."""
    brand = _minimal_brand(dont=[])
    result = _headline("Truffle burger launch", brand)
    assert result != brand.name
    assert "truffle" in result.lower() or "burger" in result.lower()


# ---------------------------------------------------------------------------
# generate_campaign tests
# ---------------------------------------------------------------------------


async def test_generate_campaign_returns_four_assets(monkeypatch):
    """generate_campaign must return a dict with exactly 4 assets covering
    poster, post, story, and whatsapp formats. No AI key -> LLM copy + hero
    image both skip to their deterministic/gradient fallbacks."""
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    brand = _minimal_brand()
    campaign = await generate_campaign(brand, "Launch truffle burger at ₹399", today="2026-10-01")

    assert isinstance(campaign, dict)
    assert len(campaign["assets"]) == 4

    types = [a["type"] for a in campaign["assets"]]
    assert types == ["poster", "post", "story", "whatsapp"]

    # Verify other top-level campaign fields are present.
    assert campaign["id"].startswith("c_")
    assert campaign["status"] == "Draft"
    assert campaign["date"] == "2026-10-01"
    assert campaign["objective"] == "Launch truffle burger at ₹399"

    # Each asset should have the expected shape.
    for asset in campaign["assets"]:
        assert "id" in asset
        assert "slots" in asset
        assert "knobs" in asset
        assert asset["slots"]["logo"] == brand.name
