from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from identity import get_template, propose_identity
from models import Brand
from schemas import BrandProfile, Fonts, IdentityApply, IdentityDirection, Palette

router = APIRouter(prefix="/v1/brands/{brand_id}/identity", tags=["identity"])


async def _get_brand_or_404(brand_id: str, session: AsyncSession, *, for_update: bool = False) -> Brand:
    brand = await session.get(Brand, brand_id, with_for_update=for_update)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


@router.get("", response_model=list[IdentityDirection])
async def get_identity_directions(brand_id: str, session: AsyncSession = Depends(get_session)):
    """F3 — propose 2 identity directions based on the brand's current positioning."""
    brand = await _get_brand_or_404(brand_id, session)
    profile = BrandProfile(**brand.profile_json)
    directions = propose_identity(profile.positioning)
    return [
        IdentityDirection(
            key=d["key"],
            palette=Palette(**d["palette"]),
            fonts=Fonts(**d["fonts"]),
            meaning=d["meaning"],
        )
        for d in directions
    ]


@router.post("/apply", response_model=BrandProfile)
async def apply_identity_direction(
    brand_id: str, payload: IdentityApply, session: AsyncSession = Depends(get_session)
):
    """Lock a proposed direction into Brand Memory ('Save to Brand', PRD 7 F3).

    `payload.fields` implements "lock/regenerate individual parts": omitted,
    this applies the full direction (palette + fonts + meaning); given e.g.
    `["palette"]`, only the palette is taken from the template and the
    brand's current fonts (and meaning) are left as they are. An uploaded
    logo (as opposed to the default wordmark) is never touched here either
    way, per the PRD ("if the user uploads a logo, we use it and only
    suggest colours and fonts").

    Row-locked for the same reason as the memory-patch endpoint: avoids a lost
    update if this races with a concurrent PATCH /memory on the same brand.
    """
    brand = await _get_brand_or_404(brand_id, session, for_update=True)
    template = get_template(payload.key)
    if template is None:
        raise HTTPException(status_code=404, detail=f"Unknown identity direction '{payload.key}'")

    apply_all = payload.fields is None
    fields = set(payload.fields) if payload.fields else set()

    current = BrandProfile(**brand.profile_json)
    updates: dict = {}
    if apply_all or "palette" in fields:
        updates["palette"] = Palette(**template["palette"])
    if apply_all or "fonts" in fields:
        updates["fonts"] = Fonts(**template["fonts"])
    if apply_all:
        updates["meaning"] = dict(template["meaning"])

    merged = current.model_copy(update=updates)
    if merged == current:
        return current

    merged.version = current.version + 1
    brand.profile_json = merged.model_dump(mode="json")
    await session.commit()
    return merged
