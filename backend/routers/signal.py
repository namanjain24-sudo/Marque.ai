from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from models import Brand
from schemas import BrandProfile, SignalResult
from uploads import BadUploadError, validate_upload
from vision import InvalidImageError, VisionCheckError, VisionNotConfiguredError, check_signals

router = APIRouter(prefix="/v1/brands/{brand_id}", tags=["signal"])


@router.post("/signal-check", response_model=SignalResult)
async def signal_check(
    brand_id: str,
    image: UploadFile = File(...),
    round: int = Form(default=1, ge=1, le=2),
    session: AsyncSession = Depends(get_session),
):
    """F4 — check_signals (PRD Table 12): score an uploaded asset against the
    brand's target positioning. Standalone for now — there's no renderer
    (F5) or asset library (F8) yet, so this checks whatever image is handed
    to it rather than a saved asset."""
    brand = await session.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")

    data = await image.read()
    try:
        validate_upload(data)
    except BadUploadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    profile = BrandProfile(**brand.profile_json)
    try:
        return await check_signals(profile, data, round_num=round)
    except VisionNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail="Signal Check isn't configured on this deployment") from exc
    except InvalidImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except VisionCheckError as exc:
        raise HTTPException(status_code=502, detail=f"Signal Check failed: {exc}") from exc
