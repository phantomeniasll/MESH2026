"""LoRaWAN sensor data ingestion routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.tree import Tree
from ..models.reading import Reading
from ..schemas.sensor import SensorReadingCreate, SensorReadingResponse, TreeHealthSummary

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


@router.post("/ingest", response_model=SensorReadingResponse, status_code=201)
async def ingest_reading(payload: SensorReadingCreate, db: AsyncSession = Depends(get_db)):
    """Ingest a sensor reading from a LoRaWAN device uplink."""
    result = await db.execute(
        select(Tree).where(Tree.device_eui == payload.device_eui)
    )
    tree = result.scalar_one_or_none()
    if not tree:
        raise HTTPException(status_code=404, detail=f"No tree registered for device EUI: {payload.device_eui}")

    reading = Reading(
        tree_id=tree.id,
        moisture=payload.moisture,
        temperature=payload.temperature,
        humidity=payload.humidity,
        battery_voltage=payload.battery_voltage,
        footfall_count=payload.footfall_count,
        tilt_angle=payload.tilt_angle,
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

    return SensorReadingResponse.model_validate(reading)


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
        footfall_24h=latest_reading.footfall_count if latest_reading else 0,
        last_reading_at=latest_reading.recorded_at if latest_reading else None,
        battery_voltage=latest_reading.battery_voltage if latest_reading else None,
        status=tree.status,
    )
