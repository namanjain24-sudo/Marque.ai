"""F10 — Brand Audit (PRD Section 7 F10).

Runs each uploaded image through the vision critic (analyse_asset) concurrently,
then derives everything the PRD asks for IN CODE from those per-image reads:
a 0-100 consistency score, distinct-treatment counts ("N font styles, M colour
treatments"), and the top-3 issues each with a suggested fix. As in F4, the model
is only trusted for perception - never for the arithmetic.
"""

import asyncio

from schemas import (
    AuditCounts,
    AuditIssue,
    AuditReport,
    BrandProfile,
    VisionAuditResponse,
)
from vision import analyse_asset

AXES = ("premium", "modern", "playful", "niche")

# A single-axis spread this wide across the images is called out as an issue.
AXIS_SPREAD_THRESHOLD = 25
# An image this far off the brand on its worst axis trips a per-image alert.
IMAGE_GAP_ALERT = 30


def _axis_values(reads: list[VisionAuditResponse], axis: str) -> list[int]:
    return [getattr(r.detected, axis) for r in reads]


def consistency_score(reads: list[VisionAuditResponse]) -> int:
    """100 = every image lands in the same place on every axis; lower = the
    images disagree. Mean per-axis spread (max-min), halved so a full 100-point
    spread on one axis costs 50, then subtracted from 100. Our formula - the PRD
    gives the 0-100 range but no formula (documented in PROGRESS.md)."""
    if len(reads) < 2:
        return 100
    spreads = [max(vals) - min(vals) for axis in AXES if (vals := _axis_values(reads, axis))]
    mean_spread = sum(spreads) / len(spreads)
    return max(0, min(100, round(100 - mean_spread / 2)))


def _normalise_colour(c: str) -> str:
    return c.strip().lower().lstrip("#")


def count_treatments(reads: list[VisionAuditResponse]) -> AuditCounts:
    fonts = {r.font_style for r in reads}
    tones = {r.photo_tone for r in reads}
    colours = {_normalise_colour(c) for r in reads for c in r.colours}
    return AuditCounts(
        font_styles=len(fonts),
        colour_treatments=len(colours),
        photo_styles=len(tones),
    )


def _build_issues(profile: BrandProfile, reads: list[VisionAuditResponse], counts: AuditCounts) -> list[AuditIssue]:
    """Rank candidate issues deterministically and return the top 3, each with a
    concrete suggested fix drawn from the images' own majority style."""
    candidates: list[tuple[int, AuditIssue]] = []

    # 1. Font inconsistency across images.
    if counts.font_styles > 1:
        majority = max({r.font_style for r in reads}, key=lambda f: sum(x.font_style == f for x in reads))
        candidates.append(
            (
                100 + counts.font_styles,
                AuditIssue(
                    text=f"Inconsistent headline font — {counts.font_styles} different styles across {len(reads)} images.",
                    suggested_fix=f"Standardise on one font style (most common here: {majority}).",
                ),
            )
        )

    # 2. Colour-treatment sprawl.
    if counts.colour_treatments > len(reads):
        candidates.append(
            (
                90 + counts.colour_treatments,
                AuditIssue(
                    text=f"Colour palette varies: {counts.colour_treatments} distinct treatments across {len(reads)} images.",
                    suggested_fix="Pull every image back to the brand palette (primary + accent only).",
                ),
            )
        )

    # 3. Photo-tone inconsistency.
    if counts.photo_styles > 1:
        majority = max({r.photo_tone for r in reads}, key=lambda t: sum(x.photo_tone == t for x in reads))
        candidates.append(
            (
                80 + counts.photo_styles,
                AuditIssue(
                    text=f"Photography style is mixed — {counts.photo_styles} different photo tones.",
                    suggested_fix=f"Grade all photos to one tone (most common here: {majority}).",
                ),
            )
        )

    # 4. Per-axis divergence vs each other.
    for axis in AXES:
        vals = _axis_values(reads, axis)
        spread = max(vals) - min(vals)
        if spread >= AXIS_SPREAD_THRESHOLD:
            candidates.append(
                (
                    spread,
                    AuditIssue(
                        text=f"Images disagree on how '{axis}' they read (spread of {spread} points).",
                        suggested_fix=f"Align the outliers toward the brand target of {getattr(profile.positioning, axis)}.",
                    ),
                )
            )

    candidates.sort(key=lambda c: c[0], reverse=True)
    return [issue for _, issue in candidates[:3]]


def _build_alerts(profile: BrandProfile, reads: list[VisionAuditResponse]) -> list[str]:
    alerts: list[str] = []
    for i, r in enumerate(reads, start=1):
        worst = max(AXES, key=lambda a: abs(getattr(r.detected, a) - getattr(profile.positioning, a)))
        gap = getattr(r.detected, worst) - getattr(profile.positioning, worst)
        if abs(gap) >= IMAGE_GAP_ALERT:
            alerts.append(f"Image {i} reads off-brand on '{worst}' (gap {gap:+d}).")
    return alerts


def build_report(profile: BrandProfile, reads: list[VisionAuditResponse]) -> AuditReport:
    counts = count_treatments(reads)
    score = consistency_score(reads)
    summary = (
        f"{counts.font_styles} font style{'s' if counts.font_styles != 1 else ''}, "
        f"{counts.colour_treatments} colour treatment{'s' if counts.colour_treatments != 1 else ''}"
    )
    return AuditReport(
        consistency_score=score,
        summary=summary,
        counts=counts,
        issues=_build_issues(profile, reads, counts),
        alerts=_build_alerts(profile, reads),
        image_count=len(reads),
    )


async def run_audit(profile: BrandProfile, images: list[bytes]) -> AuditReport:
    """Analyse every image concurrently, then build the report deterministically."""
    reads = await asyncio.gather(*(analyse_asset(profile, img) for img in images))
    return build_report(profile, list(reads))
