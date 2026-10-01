import os

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/marque",
)

if os.environ.get("TESTING"):
    # pytest-asyncio runs each test in its own event loop; a pooled asyncpg
    # connection created in one loop breaks when reused in another. NullPool
    # opens a fresh connection per use instead of pooling, which avoids that.
    engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
else:
    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session():
    async with SessionLocal() as session:
        yield session
