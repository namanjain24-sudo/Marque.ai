"""F8 (light) — asset library, built 'save-on-check'.

The only way an asset gets into the library today is by saving an uploaded image
after a Signal Check: we re-run check_signals so the saved asset always carries a
real match score, store the (downscaled) JPEG on disk, and record an Asset row.
The uploaded photo itself is the preview (png_url) - unlike a future rendered
asset, which would carry slots/knobs for the CSS mockup instead.
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from models import Asset, Brand, new_id
from schemas import AssetTypeT, BrandProfile, LibraryAsset
from uploads import BadUploadError, delete_image, save_image, validate_upload
from vision import (
    InvalidImageError,
    VisionCheckError,
    VisionNotConfiguredError,
    check_signals,
    prepare_image,
)

router = APIRouter(prefix="/v1/brands/{brand_id}/assets", tags=["assets"])

VALID_TYPES = {"poster", "post", "story", "whatsapp", "other"}


async def _get_brand_or_404(brand_id: str, session: AsyncSession) -> Brand:
    brand = await session.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


def _to_library_asset(asset: Asset) -> LibraryAsset:
    """Build the API shape from an Asset row, pulling the score out of the
    stored signal result (asset.signal_json is a SignalResult dump)."""
    layout = asset.layout_json or {}
    signal = asset.signal_json or {}
    return LibraryAsset(
        id=asset.id,
        brand_id=asset.brand_id,
        source=layout.get("source", "upload"),
        type=asset.type,
        label=layout.get("label") or "",
        png_url=asset.png_url,
        signal_match=signal.get("match"),
        signal_verdict=signal.get("verdict"),
        created_at=asset.created_at,
    )


@router.post("", response_model=LibraryAsset, status_code=201)
async def save_asset(
    brand_id: str,
    image: UploadFile = File(...),
    type: str = Form(default="other"),
    label: str | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Save an uploaded image to the library. Re-runs Signal Check so the asset
    has a real score, stores the downscaled JPEG, records the row."""
    brand = await _get_brand_or_404(brand_id, session)

    asset_type = type if type in VALID_TYPES else "other"

    data = await image.read()
    try:
        validate_upload(data)
    except BadUploadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    profile = BrandProfile(**brand.profile_json)
    try:
        # prepare_image once: reuse the same bytes for both the vision call and
        # the on-disk write so the scored image is identical to the stored one.
        jpeg_bytes, jpeg_mime = prepare_image(data)
        result = await check_signals(profile, jpeg_bytes, round_num=1, _skip_prepare=True)
    except VisionNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail="Signal Check isn't configured on this deployment") from exc
    except InvalidImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except VisionCheckError as exc:
        raise HTTPException(status_code=502, detail=f"Signal Check failed: {exc}") from exc

    # Commit the DB row first; only write the file if the commit succeeds.
    # This prevents orphaned files on disk when the transaction rolls back.
    asset_id = new_id("a")
    # Derive the URL deterministically (same logic as save_image) without
    # touching the filesystem yet.
    from uploads import MEDIA_URL_PREFIX
    png_url = f"{MEDIA_URL_PREFIX}/{asset_id}.jpg"
    asset = Asset(
        id=asset_id,
        brand_id=brand_id,
        type=asset_type,
        png_url=png_url,
        signal_json=result.model_dump(mode="json"),
        layout_json={"source": "upload", "label": label or ""},
    )
    session.add(asset)
    await session.commit()
    # DB row is durable — now safe to write the file.
    save_image(jpeg_bytes, asset_id)
    return _to_library_asset(asset)


@router.get("", response_model=list[LibraryAsset])
async def list_assets(
    brand_id: str,
    type: AssetTypeT | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """List a brand's saved assets, newest first, optionally filtered by type."""
    await _get_brand_or_404(brand_id, session)
    stmt = select(Asset).where(Asset.brand_id == brand_id)
    if type is not None:
        stmt = stmt.where(Asset.type == type)
    stmt = stmt.order_by(Asset.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return [_to_library_asset(a) for a in result.scalars().all()]


@router.get("/{asset_id}", response_model=LibraryAsset)
async def get_asset(brand_id: str, asset_id: str, session: AsyncSession = Depends(get_session)):
    asset = await session.get(Asset, asset_id)
    if asset is None or asset.brand_id != brand_id:
        raise HTTPException(status_code=404, detail="Asset not found")
    return _to_library_asset(asset)


@router.delete("/{asset_id}", status_code=204)
async def delete_asset(brand_id: str, asset_id: str, session: AsyncSession = Depends(get_session)):
    # Row-locked read (SELECT … FOR UPDATE) so concurrent deletes on the same
    # asset serialize rather than both reading the row and both trying to delete.
    asset = await session.get(Asset, asset_id, with_for_update=True)
    if asset is None or asset.brand_id != brand_id:
        raise HTTPException(status_code=404, detail="Asset not found")
    png_url = asset.png_url
    await session.delete(asset)
    await session.commit()
    # File removal is best-effort and happens after the DB commit so a crash
    # here leaves an orphaned file (acceptable) rather than a dangling row.
    delete_image(png_url)
