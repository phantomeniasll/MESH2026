"""LoRaWAN sensor data ingestion routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_api_key
from ..database import get_db
from ..models.reading import Reading
from ..models.tree import Tree
from ..schemas.sensor import (
    SensorReadingCreate,
    SensorReadingResponse,
    TreeHealthSummary,
)

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


@router.post("/ingest", response_model=SensorReadingResponse, status_code=201)
async def ingest_reading(
    payload: SensorReadingCreate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(require_api_key),
):
    """Ingest a sensor reading from a LoRaWAN device uplink."""

    # ── Print incoming reading for visibility ──
    print(f"\n{'='*60}")
    print(f"📡 INGEST  device={payload.device_eui}")
    print(f"   moisture={payload.moisture}%  temp={payload.temperature}°C  "
          f"humidity={payload.humidity}%")
    print(f"   footfall={payload.footfall_count}  battery={payload.battery_voltage}V  "
          f"rssi={payload.rssi}dB")
    print(f"   raw: {payload.model_dump_json()}")
    print(f"{'='*60}\n")

    result = await db.execute(
        select(Tree).where(Tree.device_eui == payload.device_eui)
    )
    tree = result.scalar_one_or_none()
    if not tree:
        # Auto-register unknown devices at Steamworks Karlsruhe
        tree = Tree(
            name=f"Auto: {payload.device_eui}",
            device_eui=payload.device_eui,
            latitude=49.0015270,
            longitude=8.3879422,
            neighborhood="Südweststadt",
            address="Roonstraße 23a, 76137 Karlsruhe",
            notes="Auto-registered from unknown device — HackXplore 2026",
        )
        db.add(tree)
        await db.flush()
        print(f"🆕 Auto-registered tree '{tree.name}'  id={tree.id[:8]}…")

    reading = Reading(
        tree_id=tree.id,
        moisture=payload.moisture,
        temperature=payload.temperature,
        humidity=payload.humidity,
        battery_voltage=payload.battery_voltage,
        footfall_count=payload.footfall_count,
        tilt_angle=payload.tilt_angle,
        sound_level=payload.sound_level,
        rssi=payload.rssi,
        snr=payload.snr,
        raw_payload=payload.raw_payload,
    )
    db.add(reading)
    await db.flush()

    # Update tree status based on moisture
    if payload.moisture is not None:
        if payload.moisture < 15:
            tree.status = "critical"
        elif payload.moisture < 25:
            tree.status = "stressed"
        else:
            tree.status = "healthy"

    print(f"✅ Stored as reading {reading.id[:8]}…  tree={tree.name}  "
          f"status={tree.status}")

    return SensorReadingResponse.model_validate(reading)


@router.get("/tree/{tree_id}/readings")
async def tree_readings(
    tree_id: str,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent *limit* readings for a tree (time series).

    Query params:
    - ``limit`` (default 100): max readings to return, newest first.
    """
    result = await db.execute(
        select(Reading)
        .where(Reading.tree_id == tree_id)
        .order_by(Reading.recorded_at.desc())
        .limit(max(1, min(limit, 1000)))
    )
    readings = result.scalars().all()
    return [
        SensorReadingResponse.model_validate(r) for r in readings
    ]


@router.get("/tree/{tree_id}/health", response_model=TreeHealthSummary)
async def tree_health(tree_id: str, db: AsyncSession = Depends(get_db)):
    """Get health summary for a specific tree."""
    result = await db.execute(select(Tree).where(Tree.id == tree_id))
    tree = result.scalar_one_or_none()
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")

    latest = await db.execute(
        select(Reading)
        .where(Reading.tree_id == tree_id)
        .order_by(Reading.recorded_at.desc())
        .limit(1)
    )
    latest_reading = latest.scalar_one_or_none()

    return TreeHealthSummary(
        tree_id=tree.id,
        tree_name=tree.name,
        current_moisture=latest_reading.moisture if latest_reading else None,
        moisture_trend="stable",
        footfall_24h=latest_reading.footfall_count
        if latest_reading and latest_reading.footfall_count is not None
        else 0,
        last_reading_at=latest_reading.recorded_at if latest_reading else None,
        battery_voltage=latest_reading.battery_voltage if latest_reading else None,
        status=tree.status,
    )
