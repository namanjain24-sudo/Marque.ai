"""Shared upload validation + image storage for the public image endpoints
(F4 Signal Check, F8 asset save, F10 audit).

Two cheap pre-checks live here, before any paid vision call:
  - a size cap (PRD Table 21: "max 10 MB"),
  - a magic-byte sniff so only PNG/JPEG/WebP get through (the router's job; the
    full Pillow decode in vision.prepare_image is the authoritative one).

`validate_upload` raises BadUploadError on any failure so each router can map it
to its own 422 with whatever phrasing it already uses.
"""

import os

# PRD Table 21 (security): "Allow only PNG/JPG/WebP/PDF, max 10 MB." PDF isn't
# relevant to a single rendered-asset check, so it's left out.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAGIC_BYTES: dict[bytes, str] = {
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
}


class BadUploadError(Exception):
    """Upload failed a cheap pre-check (too big, empty, or not an image).
    Routers map this to HTTP 422."""


def sniff_mime(data: bytes) -> str | None:
    for magic, mime in MAGIC_BYTES.items():
        if data.startswith(magic):
            return mime
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_upload(data: bytes) -> str:
    """Run the three cheap guards and return the sniffed mime. Raises
    BadUploadError (-> 422) on failure."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise BadUploadError("Image must be 10 MB or smaller")
    if not data:
        raise BadUploadError("Uploaded file is empty")
    mime = sniff_mime(data)
    if mime is None:
        raise BadUploadError("Only PNG, JPEG or WebP images are accepted")
    return mime


# --- Filesystem image storage -------------------------------------------------
# Uploaded images are stored as already-downscaled JPEGs (vision.prepare_image
# output) under MEDIA_ROOT and served by FastAPI's StaticFiles at /media. The
# dir is a Docker named volume in deployment so files survive container rebuilds.

MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "media")
MEDIA_URL_PREFIX = "/media"


def media_dir() -> str:
    os.makedirs(MEDIA_ROOT, exist_ok=True)
    return MEDIA_ROOT


def save_image(jpeg_bytes: bytes, asset_id: str) -> str:
    """Write `{MEDIA_ROOT}/{asset_id}.jpg` and return its public URL."""
    filename = f"{asset_id}.jpg"
    with open(os.path.join(media_dir(), filename), "wb") as fh:
        fh.write(jpeg_bytes)
    return f"{MEDIA_URL_PREFIX}/{filename}"


def delete_image(png_url: str | None) -> None:
    """Best-effort removal of a stored image given its public URL. Never raises."""
    if not png_url or not png_url.startswith(f"{MEDIA_URL_PREFIX}/"):
        return
    filename = png_url[len(MEDIA_URL_PREFIX) + 1 :]
    try:
        os.remove(os.path.join(MEDIA_ROOT, filename))
    except OSError:
        pass
