from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Must run before `from db import ...` (and anything else reading
# os.environ at import time) picks up its defaults.
load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from db import SessionLocal, engine
from models import Base
from routers.agent import campaigns_router, router as agent_router
from routers.assets import router as assets_router
from routers.audit import router as audit_router
from routers.brands import router as brands_router
from routers.identity import router as identity_router
from routers.signal import router as signal_router
from seed import seed_all
from uploads import media_dir


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Idempotent full demo seed (brand + products + campaigns + assets + audit +
    # runs). Only writes what's missing, so this is safe on every boot and on a
    # fresh prod DB — the deploy seeds itself with no manual step.
    async with SessionLocal() as session:
        await seed_all(session)

    yield


app = FastAPI(title="Marque.ai", lifespan=lifespan)
app.include_router(brands_router)
app.include_router(identity_router)
app.include_router(signal_router)
app.include_router(assets_router)
app.include_router(audit_router)
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
