from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from brand_dna import propose_do_dont, propose_positioning, propose_tone
from db import get_session
from identity import propose_identity
from models import Brand, new_id
from schemas import BrandCreate, BrandMemoryPatch, BrandProfile, Fonts, Palette, Voice

router = APIRouter(prefix="/v1/brands", tags=["brands"])


@router.post("", response_model=BrandProfile, status_code=201)
async def create_brand(payload: BrandCreate, session: AsyncSession = Depends(get_session)):
    """F1 — Brand Onboarding. Builds the draft Brand Profile: proposes positioning
    sliders, do/dont rules, a starting tone, and a starting palette/fonts (the
    closest-matching identity template) so every field in the draft is filled
    and ready to edit — not just the sliders (PRD 7, F1 acceptance criteria).

    F3's own "pick one of 2 directions and lock it" flow (/identity) can later
    override this starting palette/fonts; this just avoids showing a blank
    draft before the owner gets there.
    """
    do, dont = propose_do_dont(payload.price_level)
    positioning = propose_positioning(payload.personality, payload.price_level)

    profile = BrandProfile(
        id=new_id("brand"),
        positioning=positioning,
        do=do,
        dont=dont,
        voice=Voice(tone=propose_tone(payload.personality)),
        **payload.model_dump(),
    )

    draft_direction = propose_identity(profile.positioning, n=1)[0]
    profile.palette = Palette(**draft_direction["palette"])
    profile.fonts = Fonts(**draft_direction["fonts"])
    profile.meaning = dict(draft_direction["meaning"])

    brand = Brand(id=profile.id, profile_json=profile.model_dump(mode="json"))
    session.add(brand)
    await session.commit()
    return profile


@router.get("", response_model=list[BrandProfile])
async def list_brands(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Brand).order_by(Brand.created_at).limit(limit).offset(offset)
    )
    return [BrandProfile(**b.profile_json) for b in result.scalars().all()]


@router.get("/{brand_id}", response_model=BrandProfile)
async def get_brand(brand_id: str, session: AsyncSession = Depends(get_session)):
    brand = await session.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return BrandProfile(**brand.profile_json)


@router.patch("/{brand_id}/memory", response_model=BrandProfile)
async def update_brand_memory(
    brand_id: str, patch: BrandMemoryPatch, session: AsyncSession = Depends(get_session)
):
    """Row-locked (SELECT ... FOR UPDATE) read-modify-write: concurrent patches
    to the same brand serialize on this row instead of silently losing each
    other's changes. A patch that changes nothing doesn't bump `version`."""
    brand = await session.get(Brand, brand_id, with_for_update=True)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")

    current = BrandProfile(**brand.profile_json)
    # NOT patch.model_dump(): that flattens nested models (Palette, Fonts,
    # Logo, Voice, Positioning) into plain dicts, so model_copy's update
    # would silently store a dict where a typed model belongs — breaks
    # dot-attribute access on `merged` later in this function, and makes
    # `merged == current` compare a dict against a model (always unequal,
    # even for identical values). Pulling the already-validated attributes
    # straight off `patch` keeps them as the real types.
    updates = {field: getattr(patch, field) for field in patch.model_fields_set}
    merged = current.model_copy(update=updates)

    if merged == current:
        return current

    merged.version = current.version + 1
    brand.profile_json = merged.model_dump(mode="json")
    await session.commit()
    return merged
