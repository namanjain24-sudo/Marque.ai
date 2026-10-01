import os

# Must happen before `db`/`main` are imported anywhere, since db.py reads
# DATABASE_URL at import time. Point at the same Postgres docker-compose
# exposes on localhost, but a dedicated database so tests never touch dev data.
os.environ.setdefault("TESTING", "1")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/marque_test",
)

import asyncpg
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from db import engine
from models import Base


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_test_database():
    """`marque_test` doesn't exist until we create it — connect to the
    default `postgres` maintenance DB to issue CREATE DATABASE first."""
    url = engine.url.render_as_string(hide_password=False)
    admin_dsn = url.replace("postgresql+asyncpg://", "postgresql://").rsplit("/", 1)[0] + "/postgres"
    db_name = url.rsplit("/", 1)[1]

    conn = await asyncpg.connect(admin_dsn)
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        await conn.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables():
    """Every test starts from an empty database — no order dependence."""
    async with engine.begin() as conn:
        await conn.execute(
            text("TRUNCATE brands, campaigns, assets, products, audits, runs RESTART IDENTITY CASCADE")
        )
    yield


@pytest_asyncio.fixture
async def client():
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
