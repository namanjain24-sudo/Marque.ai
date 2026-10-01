"""F10 — pure unit tests for the deterministic audit math (no network).
Mirrors test_signal_math.py: proves the formula/counts, not the LLM call."""

from audit import build_report, consistency_score, count_treatments
from schemas import BrandProfile, VisionAuditResponse


def _read(premium=50, modern=50, playful=50, niche=50, font="display_bold", tone="warm", colours=("red",)):
    return VisionAuditResponse(
        detected={"premium": premium, "modern": modern, "playful": playful, "niche": niche},
        font_style=font,
        photo_tone=tone,
        colours=list(colours),
        issue="a note",
    )


def _brand():
    return BrandProfile(name="Burger Lab", category="Restaurant")


def test_identical_images_score_100():
    reads = [_read(), _read(), _read()]
    assert consistency_score(reads) == 100


def test_single_image_scores_100():
    assert consistency_score([_read()]) == 100


def test_one_axis_divergence():
    # one axis spread of 100 -> mean spread across 4 axes = 25 -> 100 - 12.5 -> 88
    reads = [_read(premium=0), _read(premium=100)]
    assert consistency_score(reads) == round(100 - (100 / 4) / 2)


def test_wide_divergence_all_axes():
    # every axis spread 100 -> mean 100 -> 100 - 50 = 50
    reads = [_read(0, 0, 0, 0), _read(100, 100, 100, 100)]
    assert consistency_score(reads) == 50


def test_count_distinct_treatments():
    reads = [
        _read(font="display_bold", tone="warm", colours=("red", "black")),
        _read(font="serif_elegant", tone="cool", colours=("red",)),
    ]
    counts = count_treatments(reads)
    assert counts.font_styles == 2
    assert counts.photo_styles == 2
    assert counts.colour_treatments == 2  # red (deduped), black


def test_colour_dedup_is_case_and_hash_insensitive():
    reads = [_read(colours=("#FF0000", "Red")), _read(colours=("red",))]
    assert count_treatments(reads).colour_treatments == 2  # ff0000, red


def test_report_summary_and_issue_cap():
    reads = [
        _read(0, font="display_bold", tone="warm", colours=("red",)),
        _read(100, font="serif_elegant", tone="cool", colours=("blue",)),
        _read(50, font="clean_sans", tone="dark", colours=("green",)),
    ]
    report = build_report(_brand(), reads)
    assert "font style" in report.summary
    assert len(report.issues) <= 3
    assert report.image_count == 3
    assert 0 <= report.consistency_score <= 100
    # divergent inputs should surface at least one issue
    assert report.issues
