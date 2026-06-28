"""Tree CRUD and discovery routes."""

import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.reading import Reading
from ..models.tree import Tree
from ..schemas.tree import TreeCreate, TreeResponse, TreeSummary, TreeUpdate
from ..services.water_balance import (
    MOISTURE_THRESHOLD,
    daily_water_need,
    find_now_index,
    forecast_curve,
    now_cast,
)
from ..services.weather import get_weather

router = APIRouter(prefix="/api/trees", tags=["trees"])

_STATUS_URGENCY = {"critical": 0, "stressed": 1, "unknown": 2, "healthy": 3}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


@router.get("/rescue", response_model=list[TreeSummary])
async def rescue_trees(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    limit: int = Query(5, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Return the nearest critical/stressed trees, with KA-00001/KA-00002 always pinned first."""
    _PINNED_IDS = ["KA-00001", "KA-00002"]

    # Always fetch the two demo trees first regardless of their status
    pinned_result = await db.execute(select(Tree).where(Tree.id.in_(_PINNED_IDS)))
    pinned = {t.id: t for t in pinned_result.scalars().all()}
    pinned_trees = [pinned[k] for k in _PINNED_IDS if k in pinned]

    # Fill remaining slots with nearest critical/stressed trees (excluding pinned)
    remaining_limit = limit - len(pinned_trees)
    result = await db.execute(
        select(Tree).where(
            Tree.status.in_(["critical", "stressed"]),
            Tree.id.not_in(_PINNED_IDS),
        )
    )
    rest = result.scalars().all()

    if not rest and remaining_limit > 0:
        result = await db.execute(select(Tree).where(Tree.id.not_in(_PINNED_IDS)))
        rest = result.scalars().all()

    def sort_key(t: Tree):
        urgency = _STATUS_URGENCY.get(t.status, 99)
        dist = _haversine_km(lat, lng, t.latitude, t.longitude)
        return (urgency, dist)

    trees = pinned_trees + sorted(rest, key=sort_key)[:remaining_limit]

    summaries = []
    for tree in trees:
        latest = await db.execute(
            select(Reading.moisture)
            .where(Reading.tree_id == tree.id)
            .order_by(Reading.recorded_at.desc())
            .limit(1)
        )
        moisture = latest.scalar_one_or_none()
        summaries.append(TreeSummary(
            id=tree.id,
            name=tree.name,
            species=tree.species,
            latitude=tree.latitude,
            longitude=tree.longitude,
            neighborhood=tree.neighborhood,
            address=tree.address,
            status=tree.status,
            device_eui=tree.device_eui,
            latest_moisture=moisture,
        ))
    return summaries


@router.get("", response_model=list[TreeSummary])
async def list_trees(
    neighborhood: str | None = Query(None),
    status: str | None = Query(None),
    has_sensor: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """List all trees, optionally filtered."""
    stmt = select(Tree)
    if neighborhood:
        stmt = stmt.where(Tree.neighborhood == neighborhood)
    if status:
        stmt = stmt.where(Tree.status == status)
    if has_sensor:
        stmt = stmt.where(Tree.device_eui.isnot(None))

    result = await db.execute(stmt)
    trees = result.scalars().all()

    summaries = []
    for tree in trees:
        latest = await db.execute(
            select(Reading.moisture)
            .where(Reading.tree_id == tree.id)
            .order_by(Reading.recorded_at.desc())
            .limit(1)
        )
        moisture = latest.scalar_one_or_none()
        summaries.append(TreeSummary(
            id=tree.id,
            name=tree.name,
            species=tree.species,
            latitude=tree.latitude,
            longitude=tree.longitude,
            neighborhood=tree.neighborhood,
            address=tree.address,
            status=tree.status,
            device_eui=tree.device_eui,
            latest_moisture=moisture,
        ))

    return summaries


@router.get("/{tree_id}", response_model=TreeResponse)
async def get_tree(tree_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single tree by ID."""
    result = await db.execute(select(Tree).where(Tree.id == tree_id))
    tree = result.scalar_one_or_none()
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return TreeResponse.model_validate(tree)


@router.get("/{tree_id}/forecast")
async def tree_forecast(
    tree_id: str,
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    age: int | None = Query(None, ge=0),
    species: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Hybrid soil-water forecast for a tree.

    Anchors on the latest sensor moisture if available (``source="sensor"``),
    otherwise seeds from Open-Meteo's modelled soil moisture (``source="modeled"``),
    then integrates an ET0/precip water balance forward ~7 days. Degrades to
    ``source="unavailable"`` (200, empty curve) if weather can't be fetched, so
    the UI never breaks.

    Most map trees aren't in the DB (only sensored/seeded ones are). For those,
    pass ``lat``/``lng`` (and optionally ``age``) and we return a modelled
    forecast from the coordinates — so the forecast covers *every* tree.
    """
    result = await db.execute(select(Tree).where(Tree.id == tree_id))
    tree = result.scalar_one_or_none()

    # Resolve coordinates, age and sensor anchor — from the DB tree if it exists,
    # otherwise from the query params the map sends for unsensored trees.
    if tree is not None:
        t_lat, t_lng = tree.latitude, tree.longitude
        age_years = (2026 - tree.planting_year) if tree.planting_year else age
        latest = await db.execute(
            select(Reading.moisture)
            .where(Reading.tree_id == tree_id)
            .order_by(Reading.recorded_at.desc())
            .limit(1)
        )
        latest_moisture = latest.scalar_one_or_none()
    elif lat is not None and lng is not None:
        t_lat, t_lng = lat, lng
        age_years = age
        latest_moisture = None
    else:
        raise HTTPException(
            status_code=404,
            detail="Tree not found — pass lat/lng for a modelled forecast.",
        )

    tree_species = tree.species if tree is not None else species

    weather = await get_weather(t_lat, t_lng)
    if weather is None:
        return {
            "tree_id": tree_id,
            "source": "unavailable",
            "now_moisture": latest_moisture,
            "curve": [],
            "dry_in_hours": None,
            "dry_by": None,
            "next_rain_at": None,
            "will_refill": False,
            "threshold": MOISTURE_THRESHOLD,
            "liters_per_day": None,
        }

    now_idx = find_now_index(weather["time"])
    start, source = now_cast(latest_moisture, weather, now_idx)
    fc = forecast_curve(start, weather, now_idx, age_years)
    liters_per_day = daily_water_need(weather, now_idx, age_years, tree_species)

    return {
        "tree_id": tree_id,
        "source": source,
        "now_moisture": round(start, 1),
        "threshold": MOISTURE_THRESHOLD,
        "liters_per_day": liters_per_day,
        **fc,
    }


@router.post("", response_model=TreeResponse, status_code=201)
async def create_tree(payload: TreeCreate, db: AsyncSession = Depends(get_db)):
    """Register a new tree in the system."""
    tree = Tree(**payload.model_dump())
    db.add(tree)
    await db.flush()
    return TreeResponse.model_validate(tree)


@router.get("/by-nfc/{nfc_tag_id}", response_model=TreeResponse)
async def get_tree_by_nfc(nfc_tag_id: str, db: AsyncSession = Depends(get_db)):
    """Look up a tree by its NFC tag ID — used when a citizen taps."""
    result = await db.execute(select(Tree).where(Tree.nfc_tag_id == nfc_tag_id))
    tree = result.scalar_one_or_none()
    if not tree:
        raise HTTPException(status_code=404, detail=f"No tree found for NFC tag: {nfc_tag_id}")
    return TreeResponse.model_validate(tree)


@router.patch("/{tree_id}", response_model=TreeResponse)
async def update_tree(tree_id: str, payload: TreeUpdate, db: AsyncSession = Depends(get_db)):
    """Update tree details."""
    result = await db.execute(select(Tree).where(Tree.id == tree_id))
    tree = result.scalar_one_or_none()
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(tree, key, value)

    await db.flush()
    return TreeResponse.model_validate(tree)
