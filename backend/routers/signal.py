from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from models import Brand
from schemas import BrandProfile, SignalResult
from vision import VisionCheckError, VisionNotConfiguredError, check_signals

router = APIRouter(prefix="/v1/brands/{brand_id}", tags=["signal"])

# PRD Table 21 (security): "Allow only PNG/JPG/WebP/PDF, max 10 MB." PDF isn't
# relevant to a single rendered-asset check, so it's left out here.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAGIC_BYTES: dict[bytes, str] = {
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
}


def _sniff_mime(data: bytes) -> str | None:
    for magic, mime in MAGIC_BYTES.items():
        if data.startswith(magic):
            return mime
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


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
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail="Image must be 10 MB or smaller")
    if not data:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")

    mime = _sniff_mime(data)
    if mime is None:
        raise HTTPException(status_code=422, detail="Only PNG, JPEG or WebP images are accepted")

    profile = BrandProfile(**brand.profile_json)
    try:
        return await check_signals(profile, data, mime, round_num=round)
    except VisionNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail="Signal Check isn't configured on this deployment") from exc
    except VisionCheckError as exc:
        raise HTTPException(status_code=502, detail=f"Signal Check failed: {exc}") from exc
