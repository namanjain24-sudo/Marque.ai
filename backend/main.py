from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Must run before `from db import ...` (and anything else reading
# os.environ at import time) picks up its defaults.
load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from db import SessionLocal, engine
from models import Base, Brand
from routers.agent import campaigns_router, router as agent_router
from routers.brands import router as brands_router
from routers.identity import router as identity_router
from routers.signal import router as signal_router
from schemas import BrandProfile
from seed import DEMO_BRAND_ID, DEMO_BRAND_PROFILE
from uploads import media_dir


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        existing = await session.get(Brand, DEMO_BRAND_ID)
        if existing is None:
            # Validate through the same schema every other write path uses,
            # so a stale/malformed seed is a loud startup failure instead of
            # a 500 the first time something reads this brand.
            profile = BrandProfile(**DEMO_BRAND_PROFILE)
            session.add(Brand(id=DEMO_BRAND_ID, profile_json=profile.model_dump(mode="json")))
            await session.commit()

    yield


app = FastAPI(title="Marque.ai", lifespan=lifespan)
app.include_router(brands_router)
app.include_router(identity_router)
app.include_router(signal_router)
app.include_router(agent_router)
app.include_router(campaigns_router)

# Serve uploaded images (F8 saved assets, F10 audit inputs). The frontend's
# nginx proxies /media/* here; png_url fields point at this mount.
app.mount("/media", StaticFiles(directory=media_dir()), name="media")


@app.get("/")
def read_root():
    return {"product": "Marque.ai"}


@app.get("/health")
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:
        db_status = f"error: {exc}"
    return {"status": "ok", "db": db_status}
