"""City Operations dashboard routes — aggregated sensor data for department use cases.

All endpoints are single GROUP-BY queries (no per-tree N+1).
Metric→column map:
  noise     → sound_level   (AVG, 0-100 → dB via db = 40 + level*0.45)
  activity  → footfall_count (SUM)   [user-facing term for footfall_count]
  heat      → temperature   (AVG, °C)
  moisture  → moisture      (AVG, %)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Integer, and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.reading import Reading
from ..models.tree import Tree

router = APIRouter(prefix="/api/city", tags=["city"])

MetricName = Literal["noise", "activity", "heat", "moisture"]
BucketName = Literal["hour", "day"]
DimensionName = Literal["hour_of_day", "day_of_week"]

_METRIC_COL: dict[str, str] = {
    "noise": "sound_level",
    "activity": "footfall_count",
    "heat": "temperature",
    "moisture": "moisture",
}
_SUM_METRICS = {"activity"}


def _to_db(level: float | None) -> float | None:
    """Map sound_level 0-100 to approximate dB (40 dB floor at 0, 85 dB at 100)."""
    if level is None:
        return None
    return round(40.0 + level * 0.45, 1)


async def _anchor(db: AsyncSession) -> datetime:
    """Return MAX(recorded_at) across all readings — clock-independent current window."""
    result = await db.execute(select(func.max(Reading.recorded_at)))
    val = result.scalar_one_or_none()
    return val or datetime.now(UTC)


async def _window_filter(db: AsyncSession, days: int):
    anchor = await _anchor(db)
    return anchor - timedelta(days=days)


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/overview")
async def city_overview(db: AsyncSession = Depends(get_db)):
    """Headline KPIs for the city operations dashboard."""
    anchor = await _anchor(db)
    window_24h = anchor - timedelta(hours=24)
    window_7d = anchor - timedelta(days=7)

    # Trees with any reading
    monitored_result = await db.execute(
        select(func.count(func.distinct(Reading.tree_id)))
    )
    trees_monitored = monitored_result.scalar() or 0

    # Active sensors in last 24h
    active_result = await db.execute(
        select(func.count(func.distinct(Reading.tree_id)))
        .where(Reading.recorded_at >= window_24h)
    )
    active_sensors_24h = active_result.scalar() or 0

    total_result = await db.execute(select(func.count(Reading.id)))
    total_readings = total_result.scalar() or 0

    # Neighborhoods covered
    nb_result = await db.execute(
        select(func.count(func.distinct(Tree.neighborhood)))
        .join(Reading, Reading.tree_id == Tree.id)
    )
    neighborhoods_covered = nb_result.scalar() or 0

    # Health summary from tree status
    healthy = (await db.execute(select(func.count(Tree.id)).where(Tree.status == "healthy"))).scalar() or 0
    stressed = (await db.execute(select(func.count(Tree.id)).where(Tree.status == "stressed"))).scalar() or 0
    critical = (await db.execute(select(func.count(Tree.id)).where(Tree.status == "critical"))).scalar() or 0
    total_trees = healthy + stressed + critical

    # Current averages (last 7 days across all monitored trees)
    curr = await db.execute(
        select(
            func.avg(Reading.sound_level).label("noise"),
            func.avg(Reading.temperature).label("heat"),
            func.avg(Reading.moisture).label("moisture"),
            func.sum(Reading.footfall_count).label("activity"),
        ).where(Reading.recorded_at >= window_7d)
    )
    row = curr.mappings().one()

    return {
        "trees_monitored": trees_monitored,
        "active_sensors_24h": active_sensors_24h,
        "total_readings": total_readings,
        "neighborhoods_covered": neighborhoods_covered,
        "health_pct": round(healthy / total_trees * 100, 1) if total_trees else 0,
        "status_counts": {"healthy": healthy, "stressed": stressed, "critical": critical},
        "current": {
            "noise_level": round(row["noise"] or 0, 1),
            "noise_db": _to_db(row["noise"]),
            "activity_total_7d": int(row["activity"] or 0),
            "heat_avg_c": round(row["heat"] or 0, 1),
            "moisture_avg_pct": round(row["moisture"] or 0, 1),
        },
        "anchor": anchor.isoformat(),
    }


# ── Map heatmap data ──────────────────────────────────────────────────────────

@router.get("/map")
async def city_map(
    metric: MetricName = Query("noise"),
    days: int = Query(7, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Per-tree aggregated value for IDW heatmap rendering."""
    since = await _window_filter(db, days)
    col = _METRIC_COL[metric]

    if metric in _SUM_METRICS:
        agg = func.coalesce(func.sum(getattr(Reading, col)), 0)  # type: ignore[assignment]
    else:
        agg = func.avg(getattr(Reading, col))  # type: ignore[assignment]

    result = await db.execute(
        select(
            Tree.id.label("tree_id"),
            Tree.name,
            Tree.latitude,
            Tree.longitude,
            Tree.neighborhood,
            agg.label("value"),
        )
        .join(Tree, Reading.tree_id == Tree.id)
        .where(Reading.recorded_at >= since)
        .group_by(Tree.id, Tree.name, Tree.latitude, Tree.longitude, Tree.neighborhood)
    )
    rows = result.all()

    points = []
    for r in rows:
        raw_val = float(r.value) if r.value is not None else 0.0
        display_val = _to_db(raw_val) if metric == "noise" else round(raw_val, 1)
        points.append({
            "tree_id": r.tree_id,
            "name": r.name,
            "lat": r.latitude,
            "lng": r.longitude,
            "neighborhood": r.neighborhood,
            "value": display_val,
        })

    return {"metric": metric, "days": days, "points": points}


# ── Time series ───────────────────────────────────────────────────────────────

@router.get("/timeseries")
async def city_timeseries(
    metric: MetricName = Query("noise"),
    bucket: BucketName = Query("day"),
    tree_id: str | None = Query(None),
    neighborhood: str | None = Query(None),
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Time-bucketed aggregated sensor data for line/area charts."""
    since = await _window_filter(db, days)
    col = _METRIC_COL[metric]

    fmt = "%Y-%m-%d" if bucket == "day" else "%Y-%m-%dT%H:00:00"
    bucket_expr = func.strftime(fmt, Reading.recorded_at)

    if metric in _SUM_METRICS:
        value_expr = func.coalesce(func.sum(getattr(Reading, col)), 0)  # type: ignore[assignment]
        min_expr = func.min(getattr(Reading, col))
        max_expr = func.max(getattr(Reading, col))
    else:
        value_expr = func.avg(getattr(Reading, col))  # type: ignore[assignment]
        min_expr = func.min(getattr(Reading, col))
        max_expr = func.max(getattr(Reading, col))

    filters = [Reading.recorded_at >= since]
    if tree_id:
        filters.append(Reading.tree_id == tree_id)
    if neighborhood:
        filters.append(
            Reading.tree_id.in_(
                select(Tree.id).where(Tree.neighborhood == neighborhood)
            )
        )

    result = await db.execute(
        select(
            bucket_expr.label("ts"),
            value_expr.label("val"),
            min_expr.label("min_val"),
            max_expr.label("max_val"),
            func.count(Reading.id).label("cnt"),
        )
        .where(and_(*filters))
        .group_by(bucket_expr)
        .order_by(bucket_expr)
    )
    rows = result.mappings().all()

    def _fmt(v: float | None) -> float | None:
        if v is None:
            return None
        return _to_db(v) if metric == "noise" else round(v, 1)

    series = [
        {
            "t": r["ts"],
            "value": _fmt(float(r["val"])) if r["val"] is not None else None,
            "min": _fmt(float(r["min_val"])) if r["min_val"] is not None else None,
            "max": _fmt(float(r["max_val"])) if r["max_val"] is not None else None,
            "count": r["cnt"],
        }
        for r in rows
    ]

    # Drop the trailing in-progress bucket: the anchor's current day/hour is
    # partial (and polluted by the live sensor's zero-valued fields), so it dips
    # to ~0 and misleads the chart. The last bucket always contains the anchor.
    if len(series) > 1:
        series = series[:-1]

    return {"metric": metric, "bucket": bucket, "days": days, "series": series}


# ── Diurnal / weekday profile ────────────────────────────────────────────────

@router.get("/profile")
async def city_profile(
    metric: MetricName = Query("noise"),
    dimension: DimensionName = Query("hour_of_day"),
    tree_id: str | None = Query(None),
    neighborhood: str | None = Query(None),
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Average by hour-of-day (0-23) or day-of-week (0=Mon, 6=Sun). Powers rush-hour and weekday/weekend charts."""
    since = await _window_filter(db, days)
    col = _METRIC_COL[metric]

    if dimension == "hour_of_day":
        # Strip to date-only first so SQLite handles any timezone suffix in the stored value
        dim_expr = func.cast(func.strftime("%H", func.strftime("%Y-%m-%d %H:%M:%S", Reading.recorded_at)), Integer)  # type: ignore[assignment]
        n_buckets = 24
        labels = [f"{h:02d}:00" for h in range(24)]
    else:
        # SQLite strftime %w = 0 (Sun)..6 (Sat) → remap to 0=Mon..6=Sun
        # Nest strftime to strip timezone suffix before weekday extraction (older SQLite compat)
        date_str = func.strftime("%Y-%m-%d", Reading.recorded_at)
        raw_dow = func.cast(func.strftime("%w", date_str), Integer)
        dim_expr = (raw_dow + 6) % 7  # type: ignore[assignment]
        n_buckets = 7
        labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    value_expr = func.avg(getattr(Reading, col))

    filters = [Reading.recorded_at >= since]
    if tree_id:
        filters.append(Reading.tree_id == tree_id)
    if neighborhood:
        filters.append(
            Reading.tree_id.in_(select(Tree.id).where(Tree.neighborhood == neighborhood))
        )

    result = await db.execute(
        select(dim_expr.label("dim_bucket"), value_expr.label("val"), func.count(Reading.id).label("cnt"))
        .where(and_(*filters))
        .group_by(dim_expr)
        .order_by(dim_expr)
    )
    rows = {r["dim_bucket"]: r for r in result.mappings().all()}

    def _fmt(v: float | None) -> float | None:
        if v is None:
            return None
        return _to_db(v) if metric == "noise" else round(v, 1)

    buckets = [
        {
            "bucket": i,
            "label": labels[i],
            "value": _fmt(float(rows[i]["val"])) if i in rows and rows[i]["val"] is not None else None,
            "count": rows[i]["cnt"] if i in rows else 0,
        }
        for i in range(n_buckets)
    ]

    return {"metric": metric, "dimension": dimension, "days": days, "buckets": buckets}


# ── Before / after comparison ─────────────────────────────────────────────────

@router.get("/comparison")
async def city_comparison(
    metric: MetricName = Query("noise"),
    tree_id: str | None = Query(None),
    neighborhood: str | None = Query(None),
    pivot: str = Query(..., description="ISO date string for the intervention date, e.g. 2026-05-15"),
    days: int = Query(90, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Before/after an intervention date — powers Tempo-30 and pedestrianization narratives."""
    try:
        pivot_dt = datetime.fromisoformat(pivot).replace(tzinfo=UTC)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="pivot must be an ISO date string, e.g. 2026-05-15") from exc

    anchor = await _anchor(db)
    window_start = anchor - timedelta(days=days)
    col = _METRIC_COL[metric]

    filters = [Reading.recorded_at >= window_start]
    if tree_id:
        filters.append(Reading.tree_id == tree_id)
    if neighborhood:
        filters.append(
            Reading.tree_id.in_(select(Tree.id).where(Tree.neighborhood == neighborhood))
        )

    # Single query with CASE split on pivot date
    result = await db.execute(
        select(
            func.avg(
                case((Reading.recorded_at < pivot_dt, getattr(Reading, col)), else_=None)
            ).label("before_avg"),
            func.avg(
                case((Reading.recorded_at >= pivot_dt, getattr(Reading, col)), else_=None)
            ).label("after_avg"),
        ).where(and_(*filters))
    )
    row = result.mappings().one()

    before_avg = float(row["before_avg"]) if row["before_avg"] is not None else None
    after_avg = float(row["after_avg"]) if row["after_avg"] is not None else None

    def _fmt(v: float | None) -> float | None:
        if v is None:
            return None
        return _to_db(v) if metric == "noise" else round(v, 1)

    delta = None
    delta_pct = None
    if before_avg is not None and after_avg is not None and before_avg != 0:
        delta = round(_fmt(after_avg) - _fmt(before_avg), 2)  # type: ignore[operator]
        delta_pct = round((after_avg - before_avg) / abs(before_avg) * 100, 1)

    return {
        "metric": metric,
        "pivot": pivot,
        "tree_id": tree_id,
        "neighborhood": neighborhood,
        "before_avg": _fmt(before_avg),
        "after_avg": _fmt(after_avg),
        "delta": delta,
        "delta_pct": delta_pct,
    }


# ── Timelapse frames ──────────────────────────────────────────────────────────

@router.get("/map/frames")
async def city_map_frames(
    metric: MetricName = Query("heat"),
    window_days: int = Query(3, ge=1, le=14),
    total_days: int = Query(90, ge=14, le=365),
    db: AsyncSession = Depends(get_db),
):
    """All time-windowed map aggregates in one call for timelapse precomputation.

    Returns daily per-tree aggregates grouped into window_days-wide frames.
    One SQL query covers all frames; Python does the windowing.
    """
    from collections import defaultdict  # noqa: PLC0415

    anchor = await _anchor(db)
    start = anchor - timedelta(days=total_days)
    col = _METRIC_COL[metric]
    n_frames = total_days // window_days
    start_str = start.strftime("%Y-%m-%d")

    if metric in _SUM_METRICS:
        agg_fn = func.coalesce(func.sum(getattr(Reading, col)), 0)  # type: ignore[assignment]
    else:
        agg_fn = func.coalesce(func.avg(getattr(Reading, col)), 0)  # type: ignore[assignment]

    stmt = (
        select(
            func.strftime("%Y-%m-%d", Reading.recorded_at).label("day"),
            Reading.tree_id,
            Tree.name.label("tree_name"),
            Tree.latitude,
            Tree.longitude,
            Tree.neighborhood,
            agg_fn.label("val"),
        )
        .join(Tree, Tree.id == Reading.tree_id)
        .where(Reading.recorded_at >= start)
        .group_by(func.strftime("%Y-%m-%d", Reading.recorded_at), Reading.tree_id)
        .order_by(func.strftime("%Y-%m-%d", Reading.recorded_at), Reading.tree_id)
    )
    rows = (await db.execute(stmt)).mappings().all()

    def _day_delta(day_str: str) -> int:
        s = datetime.strptime(start_str, "%Y-%m-%d")
        d = datetime.strptime(str(day_str), "%Y-%m-%d")
        return (d - s).days

    frame_vals: dict[int, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    frame_meta: dict[int, dict[str, dict]] = defaultdict(dict)

    for r in rows:
        delta = _day_delta(r["day"])
        fidx = delta // window_days
        if fidx < 0 or fidx >= n_frames:
            continue
        tid = r["tree_id"]
        frame_vals[fidx][tid].append(float(r["val"] or 0))
        if tid not in frame_meta[fidx]:
            frame_meta[fidx][tid] = {
                "name": r["tree_name"],
                "lat": r["latitude"],
                "lng": r["longitude"],
                "neighborhood": r["neighborhood"],
            }

    frames = []
    for i in range(n_frames):
        f_start = (start + timedelta(days=i * window_days)).strftime("%Y-%m-%d")
        f_end = (start + timedelta(days=min((i + 1) * window_days, total_days) - 1)).strftime("%Y-%m-%d")

        points = []
        for tid, meta in frame_meta.get(i, {}).items():
            vals = frame_vals[i][tid]
            if not vals:
                continue
            raw = sum(vals) if metric in _SUM_METRICS else sum(vals) / len(vals)
            val = _to_db(raw) if metric == "noise" else round(raw, 1)
            points.append({
                "tree_id": tid,
                "name": meta["name"],
                "lat": meta["lat"],
                "lng": meta["lng"],
                "neighborhood": meta["neighborhood"],
                "value": val,
            })

        frames.append({"idx": i, "start": f_start, "end": f_end, "points": points})

    return {
        "metric": metric,
        "window_days": window_days,
        "total_days": total_days,
        "n_frames": n_frames,
        "frames": frames,
    }
