"""F4 — the deterministic half of check_signals: gaps/match/verdict math
(PRD Table 9) and the FixKnobs/SignalResult schemas. No network, no DB —
the vision LLM call itself is covered in test_signal_check.py with the HTTP
layer mocked.
"""

import pytest
from pydantic import ValidationError

from schemas import FixKnobs, Positioning, VisionCriticResponse
from vision import _compute_result


def _critic(**detected) -> VisionCriticResponse:
    base = {"premium": 50, "modern": 50, "playful": 50, "niche": 50}
    base.update(detected)
    return VisionCriticResponse(detected=base, issue="test issue", evidence=["test evidence"], fix={})


def test_exact_match_scores_100_and_passes():
    target = Positioning(premium=70, modern=80, playful=75, niche=55)
    result = _compute_result(_critic(premium=70, modern=80, playful=75, niche=55), target, round_num=1)
    assert result.match == 100
    assert result.verdict == "pass"
    assert result.gaps.premium == result.gaps.modern == result.gaps.playful == result.gaps.niche == 0


def test_prd_worked_example_gaps_and_verdict():
    # PRD 9.4's own worked example: Burger Lab target 70/80/75/55, detected 88/82/40/60.
    # The gaps (18, 2, -35, 5) and verdict match the PRD exactly. The PRD's example
    # also states match=74, but 100 - avg(18,2,35,5) = 100 - 15 = 85 by its own
    # Table 9 formula, not 74 - the example itself has an arithmetic slip. Table 9
    # is the stated rule, so that's what's implemented; this test asserts the
    # value Table 9's formula actually produces.
    target = Positioning(premium=70, modern=80, playful=75, niche=55)
    detected = _critic(premium=88, modern=82, playful=40, niche=60)
    result = _compute_result(detected, target, round_num=1)
    assert result.gaps.premium == 18
    assert result.gaps.modern == 2
    assert result.gaps.playful == -35
    assert result.gaps.niche == 5
    assert result.match == 85
    assert result.verdict == "needs_fix"  # playful's |gap| 35 > 20, regardless of match


def test_match_is_100_minus_average_absolute_gap():
    target = Positioning(premium=50, modern=50, playful=50, niche=50)
    # gaps of 10, 10, 10, 10 -> average 10 -> match 90
    result = _compute_result(_critic(premium=60, modern=60, playful=60, niche=60), target, round_num=1)
    assert result.match == 90


def test_pass_requires_match_80_and_no_single_gap_over_20():
    target = Positioning(premium=50, modern=50, playful=50, niche=50)
    # average gap only 7.5 (match 92) but one axis is off by 30 -> must fail despite high match.
    result = _compute_result(_critic(premium=80, modern=50, playful=50, niche=50), target, round_num=1)
    assert result.match == 92
    assert result.verdict == "needs_fix"
    assert max(abs(g) for g in (result.gaps.premium, result.gaps.modern, result.gaps.playful, result.gaps.niche)) == 30


def test_round_is_carried_through():
    target = Positioning(premium=50, modern=50, playful=50, niche=50)
    result = _compute_result(_critic(), target, round_num=2)
    assert result.round == 2


def test_fix_knobs_reject_unknown_values():
    with pytest.raises(ValidationError):
        FixKnobs(density="extreme")
    with pytest.raises(ValidationError):
        FixKnobs(overlay=0.9)  # PRD 9.3: overlay is 0.0-0.6


def test_fix_knobs_accept_valid_subset():
    knobs = FixKnobs(density="low", overlay=0.35)
    assert knobs.density == "low"
    assert knobs.font_style is None
