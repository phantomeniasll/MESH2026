"""Test fixtures and configuration."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from vega.database import Base


@pytest.fixture(scope="session")
def engine():
    """In-memory SQLite engine for tests."""
    return create_async_engine("sqlite+aiosqlite://", echo=False)


@pytest_asyncio.fixture
async def db_session(engine):
    """Fresh database session per test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def override_get_db(db_session):
    """Override the get_db dependency for route testing."""
    async def _override():
        yield db_session
    return _override
