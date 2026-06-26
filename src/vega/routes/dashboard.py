"""City dashboard routes — aggregated views for officials."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.tree import Tree
from ..models.reading import Reading
from ..models.watering import Watering
from ..models.user import User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/overview")
async def city_overview(db: AsyncSession = Depends(get_db)):
    """High-level city tree health overview."""
    total_trees = (await db.execute(select(func.count(Tree.id)))).scalar()
    healthy = (await db.execute(select(func.count(Tree.id)).where(Tree.status == "healthy"))).scalar()
    stressed = (await db.execute(select(func.count(Tree.id)).where(Tree.status == "stressed"))).scalar()
    critical = (await db.execute(select(func.count(Tree.id)).where(Tree.status == "critical"))).scalar()
    total_waterings = (await db.execute(select(func.count(Watering.id)))).scalar()
    total_citizens = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar()

    return {
        "total_trees": total_trees,
        "healthy": healthy,
        "stressed": stressed,
        "critical": critical,
        "total_waterings": total_waterings,
        "total_citizens": total_citizens,
        "health_pct": round(healthy / total_trees * 100, 1) if total_trees else 0,
    }


@router.get("/map")
async def tree_map(db: AsyncSession = Depends(get_db)):
    """GeoJSON-like tree data for map rendering."""
    result = await db.execute(select(Tree))
    trees = result.scalars().all()

    features = []
    for tree in trees:
        latest = await db.execute(
            select(Reading.moisture, Reading.recorded_at)
            .where(Reading.tree_id == tree.id)
            .order_by(Reading.recorded_at.desc())
            .limit(1)
        )
        row = latest.one_or_none()

        features.append({
            "id": tree.id,
            "name": tree.name,
            "species": tree.species,
            "lat": tree.latitude,
            "lng": tree.longitude,
            "status": tree.status,
            "neighborhood": tree.neighborhood,
            "moisture": row.moisture if row else None,
            "last_reading": row.recorded_at.isoformat() if row and row.recorded_at else None,
        })

    return {"features": features, "count": len(features)}


@router.get("/footfall")
async def footfall_heatmap(db: AsyncSession = Depends(get_db)):
    """Footfall data aggregated per tree for heat map."""
    result = await db.execute(select(Tree))
    trees = result.scalars().all()

    data = []
    for tree in trees:
        total_footfall = await db.execute(
            select(func.coalesce(func.sum(Reading.footfall_count), 0))
            .where(Reading.tree_id == tree.id)
        )
        data.append({
            "tree_id": tree.id,
            "tree_name": tree.name,
            "lat": tree.latitude,
            "lng": tree.longitude,
            "total_footfall": total_footfall.scalar(),
        })

    return {"points": data}


@router.get("/carbon")
async def carbon_ledger(db: AsyncSession = Depends(get_db)):
    """Estimated carbon impact — trees watered, liters saved."""
    total_liters = await db.execute(
        select(func.coalesce(func.sum(Watering.estimated_liters), 0))
    )
    liters = total_liters.scalar() or 0

    return {
        "total_liters_carried": liters,
        "estimated_co2_offset_kg": round(liters * 0.001, 2),  # rough: 1L carried = 1g CO2 avoided vs truck
        "total_waterings": (await db.execute(select(func.count(Watering.id)))).scalar(),
    }
