"""F10 — Brand Audit endpoints (PRD Section 7 F10, Section 10 'POST /v1/audit').

Scoped per-brand (like F4) so the audit can compare uploads against that brand's
memory. Persists each run to the `audits` table so there's a history.
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from audit import run_audit
from db import get_session
from models import Audit, Brand
from schemas import AuditRecord, AuditReport, BrandProfile
from uploads import BadUploadError, validate_upload
from vision import InvalidImageError, VisionCheckError, VisionNotConfiguredError

router = APIRouter(prefix="/v1/brands/{brand_id}", tags=["audit"])

MIN_IMAGES = 2
MAX_IMAGES = 5


async def _get_brand_or_404(brand_id: str, session: AsyncSession) -> Brand:
    brand = await session.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


@router.post("/audit", response_model=AuditReport)
async def run_brand_audit(
    brand_id: str,
    images: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_session),
):
    """F10 — audit 2-5 existing images for consistency against each other and
    Brand Memory. Returns a consistency score, treatment counts, and top issues."""
    brand = await _get_brand_or_404(brand_id, session)

    if not (MIN_IMAGES <= len(images) <= MAX_IMAGES):
        raise HTTPException(status_code=422, detail=f"Upload between {MIN_IMAGES} and {MAX_IMAGES} images")

    datas: list[bytes] = []
    for img in images:
        data = await img.read()
        try:
            validate_upload(data)
        except BadUploadError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        datas.append(data)

    profile = BrandProfile(**brand.profile_json)
    try:
        report = await run_audit(profile, datas)
    except VisionNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail="Brand Audit isn't configured on this deployment") from exc
    except InvalidImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except VisionCheckError as exc:
        raise HTTPException(status_code=502, detail=f"Brand Audit failed: {exc}") from exc

    record = Audit(
        brand_id=brand_id,
        images_json={"count": len(datas)},
        scores_json={"consistency_score": report.consistency_score, "counts": report.counts.model_dump()},
        issues_json={"issues": [i.model_dump() for i in report.issues], "alerts": report.alerts},
    )
    session.add(record)
    await session.commit()
    return report


@router.get("/audits", response_model=list[AuditRecord])
async def list_audits(
    brand_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """Audit history for a brand, newest first."""
    await _get_brand_or_404(brand_id, session)
    result = await session.execute(
        select(Audit)
        .where(Audit.brand_id == brand_id)
        .order_by(Audit.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    records = []
    for a in result.scalars().all():
        scores = a.scores_json or {}
        issues = a.issues_json or {}
        counts = scores.get("counts", {"font_styles": 0, "colour_treatments": 0, "photo_styles": 0})
        summary = (
            f"{counts.get('font_styles', 0)} font styles, "
            f"{counts.get('colour_treatments', 0)} colour treatments"
        )
        records.append(
            AuditRecord(
                id=a.id,
                brand_id=a.brand_id,
                created_at=a.created_at,
                report=AuditReport(
                    consistency_score=scores.get("consistency_score", 0),
                    summary=summary,
                    counts=counts,
                    issues=issues.get("issues", []),
                    alerts=issues.get("alerts", []),
                    image_count=(a.images_json or {}).get("count", MIN_IMAGES),
                ),
            )
        )
    return records
