"""Map data endpoints — compact tree snapshot and live sensor overlay."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.reading import Reading
from ..models.tree import Tree

router = APIRouter(prefix="/api/map", tags=["map"])

_TREES_GZ = (
    Path(__file__).parent.parent.parent.parent
    / "generated"
    / "trees.map.json.gz"
)


@router.get("/trees")
async def map_trees(db: AsyncSession = Depends(get_db)):
    """Serve pre-computed gzipped map snapshot, or fall back to a live DB query."""
    if _TREES_GZ.exists():
        return FileResponse(
            str(_TREES_GZ),
            media_type="application/json",
            headers={
                "Content-Encoding": "gzip",
                "Cache-Control": "no-cache",
            },
        )

    # Fallback: build compact payload directly from the DB (single SELECT, no subqueries).
    result = await db.execute(select(Tree))
    trees = result.scalars().all()

    payload = {
        "v": 1,
        "trees": [
            {
                "id": t.id,
                "sp": t.species,
                "nb": t.neighborhood,
                "lat": round(t.latitude, 5),
                "lng": round(t.longitude, 5),
                "m": round(t.est_moisture or 30, 1),
                "h": round(t.est_heat or 50, 1),
                "ay": 2026 - (t.planting_year or 2016),
                "py": t.planting_year or 2016,
                "lpd": round(t.liters_per_day or 15, 1),
            }
            for t in trees
        ],
    }
    return JSONResponse(payload)


@router.get("/live")
async def map_live(db: AsyncSession = Depends(get_db)):
    """Trees with a sensor reading in the last 24 hours (one row per tree, latest reading)."""
    cutoff = datetime.now(UTC) - timedelta(hours=24)

    # Subquery: latest recorded_at per tree within the 24 h window.
    latest_subq = (
        select(Reading.tree_id, func.max(Reading.recorded_at).label("max_at"))
        .where(Reading.recorded_at > cutoff)
        .group_by(Reading.tree_id)
        .subquery()
    )

    stmt = (
        select(Tree.id, Reading.moisture, Tree.status)
        .join(Reading, Reading.tree_id == Tree.id)
        .join(
            latest_subq,
            (latest_subq.c.tree_id == Reading.tree_id)
            & (latest_subq.c.max_at == Reading.recorded_at),
        )
        .order_by(Reading.recorded_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    return JSONResponse(
        [{"id": row.id, "moisture": row.moisture, "status": row.status} for row in rows]
    )
