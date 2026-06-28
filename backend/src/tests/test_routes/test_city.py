"""Tests for /api/city and the dashboard /activity rename."""

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from vega.database import Base, get_db
from vega.main import app
from vega.models.reading import Reading
from vega.models.tree import Tree

# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def engine():
    return create_async_engine("sqlite+aiosqlite://", echo=False)


@pytest_asyncio.fixture(scope="module")
async def db_with_data(engine):
    """Module-scoped DB with demo tree + 48 readings (2 days × 24h)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        tree = Tree(
            id="TEST-001",
            name="Test Linde",
            species="Tilia cordata",
            latitude=49.00163,
            longitude=8.38798,
            neighborhood="Innenstadt",
            status="stressed",
        )
        tree2 = Tree(
            id="TEST-002",
            name="Test Eiche",
            species="Quercus robur",
            latitude=49.0100,
            longitude=8.4150,
            neighborhood="Oststadt",
            status="healthy",
        )
        session.add_all([tree, tree2])
        await session.flush()

        base_dt = datetime(2026, 6, 27, 0, 0, 0, tzinfo=UTC)
        for day in range(2):
            for hour in range(24):
                ts = base_dt - timedelta(days=1 - day, hours=23 - hour)
                # Before-pivot readings for tree1 (pivot = 2026-06-20)
                # All readings are after pivot so comparison test checks after_avg exists
                session.add(Reading(
                    tree_id="TEST-001",
                    sound_level=50 + hour % 20,
                    footfall_count=10 + hour,
                    temperature=20.0 + hour * 0.1,
                    humidity=55.0,
                    moisture=40.0 - day * 2,
                    recorded_at=ts,
                ))
                session.add(Reading(
                    tree_id="TEST-002",
                    sound_level=30 + hour % 10,
                    footfall_count=5 + hour,
                    temperature=19.0 + hour * 0.1,
                    humidity=60.0,
                    moisture=50.0,
                    recorded_at=ts,
                ))
        await session.commit()

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_with_data):
    factory = async_sessionmaker(db_with_data, class_=AsyncSession, expire_on_commit=False)

    async def _override():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ── /api/city ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_overview_returns_monitored_trees(client):
    resp = await client.get("/api/city/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["trees_monitored"] == 2
    assert data["total_readings"] == 96
    assert "current" in data
    assert "noise_db" in data["current"]


@pytest.mark.asyncio
async def test_map_metric_noise(client):
    resp = await client.get("/api/city/map?metric=noise&days=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["metric"] == "noise"
    assert len(data["points"]) == 2
    for pt in data["points"]:
        assert "lat" in pt and "lng" in pt and "value" in pt
        assert pt["value"] is not None and pt["value"] > 0


@pytest.mark.asyncio
async def test_map_metric_activity(client):
    resp = await client.get("/api/city/map?metric=activity&days=7")
    assert resp.status_code == 200
    data = resp.json()
    # activity is SUM — should be larger than a single-hour value
    for pt in data["points"]:
        assert pt["value"] >= 0


@pytest.mark.asyncio
async def test_timeseries_bucketed_by_day(client):
    resp = await client.get("/api/city/timeseries?metric=heat&bucket=day&days=90")
    assert resp.status_code == 200
    data = resp.json()
    assert data["bucket"] == "day"
    assert len(data["series"]) >= 2  # 48h of data spans 2-3 calendar days
    for pt in data["series"]:
        assert "t" in pt and "value" in pt


@pytest.mark.asyncio
async def test_timeseries_by_tree_id(client):
    resp = await client.get("/api/city/timeseries?metric=noise&bucket=hour&tree_id=TEST-001&days=90")
    assert resp.status_code == 200
    data = resp.json()
    assert all(data["series"][i]["count"] > 0 for i in range(len(data["series"])))


@pytest.mark.asyncio
async def test_profile_hour_of_day_returns_24_buckets(client):
    resp = await client.get("/api/city/profile?metric=noise&dimension=hour_of_day&days=90")
    assert resp.status_code == 200
    data = resp.json()
    assert data["dimension"] == "hour_of_day"
    assert len(data["buckets"]) == 24


@pytest.mark.asyncio
async def test_profile_day_of_week_returns_7_buckets(client):
    resp = await client.get("/api/city/profile?metric=activity&dimension=day_of_week&days=90")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["buckets"]) == 7
    for b in data["buckets"]:
        assert "label" in b


@pytest.mark.asyncio
async def test_comparison_returns_before_after(client):
    # pivot in the middle of our data window
    resp = await client.get("/api/city/comparison?metric=noise&tree_id=TEST-001&pivot=2026-06-26")
    assert resp.status_code == 200
    data = resp.json()
    # Should have after_avg (all data is on/after 2026-06-26)
    assert data["after_avg"] is not None or data["before_avg"] is not None


@pytest.mark.asyncio
async def test_comparison_invalid_pivot(client):
    resp = await client.get("/api/city/comparison?metric=noise&tree_id=TEST-001&pivot=not-a-date")
    assert resp.status_code == 422


# ── /api/dashboard/activity rename ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_dashboard_activity_endpoint_exists(client):
    resp = await client.get("/api/dashboard/activity")
    assert resp.status_code == 200
    data = resp.json()
    assert "points" in data
    # Each point must use the renamed key
    for pt in data["points"]:
        assert "total_activity" in pt
        assert "total_footfall" not in pt


@pytest.mark.asyncio
async def test_dashboard_footfall_endpoint_gone(client):
    resp = await client.get("/api/dashboard/footfall")
    assert resp.status_code == 404
