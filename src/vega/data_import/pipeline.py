"""Orchestration pipeline: fetch → dedup → assign IDs → bulk insert → write map JSON."""

import asyncio
import gzip
import json
import math
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import insert, text

from ..database import engine
from ..models.tree import Tree
from .base import BBox
from .estimate import est_heat, est_liters_per_day, est_moisture, est_planting_year
from .normalize import assign_ids, dedup_and_merge
from .sources.csv_drop import CsvDrop
from .sources.karlsruhe_arcgis import KarlsruheArcGIS
from .sources.osm_overpass import OsmOverpass

BBOX_PRESETS: dict[str, BBox] = {
    "innenstadt": BBox(48.995, 8.38, 49.015, 8.43),
    "karlsruhe": BBox(48.9, 8.3, 49.1, 8.55),
}

CURRENT_YEAR = 2026

MAP_OUT = Path(__file__).parent.parent.parent.parent / "generated" / "trees.map.json.gz"


def _resolve_bbox(bbox_name: str | None, bbox_raw: str | None) -> BBox | None:
    if bbox_name:
        return BBOX_PRESETS.get(bbox_name)
    if bbox_raw:
        parts = [float(x) for x in bbox_raw.split(",")]
        return BBox(parts[0], parts[1], parts[2], parts[3])
    return None


def _build_adapters(sources: str, no_osm: bool) -> list:
    if sources == "karlsruhe":
        return [KarlsruheArcGIS()]
    if sources == "osm":
        return [OsmOverpass()]
    if sources == "csv":
        return [CsvDrop()]
    # all
    adapters: list = [KarlsruheArcGIS()]
    if not no_osm:
        adapters.append(OsmOverpass())
    adapters.append(CsvDrop())
    return adapters


async def run_pipeline(
    sources: str = "all",
    bbox_name: str | None = None,
    bbox_raw: str | None = None,
    limit: int | None = None,
    reset: bool = False,
    no_osm: bool = False,
) -> int:
    bbox = _resolve_bbox(bbox_name, bbox_raw)
    adapters = _build_adapters(sources, no_osm)

    print(f"[pipeline] sources={sources!r}  bbox={bbox}  limit={limit}  reset={reset}")

    # --- Fetch all records (sync adapters, run in thread pool) ---
    def _fetch_all():
        all_records = []
        for adapter in adapters:
            print(f"[pipeline] fetching from {adapter.name} …")
            all_records.extend(adapter.fetch(bbox=bbox, limit=limit))
        return all_records

    loop = asyncio.get_event_loop()
    raw_records = await loop.run_in_executor(None, _fetch_all)
    print(f"[pipeline] raw records: {len(raw_records)}")

    # --- Dedup + assign IDs ---
    merged = dedup_and_merge(raw_records)
    print(f"[pipeline] after dedup: {len(merged)}")
    id_records = assign_ids(merged)
    print(f"[pipeline] assigned {len(id_records)} IDs")

    # --- Build row dicts ---
    now = datetime.now(UTC)
    rows: list[dict] = []
    map_entries: list[dict] = []

    for tree_id, rec in id_records:
        real_py = rec.planting_year
        age_est = real_py is None
        py = real_py if real_py is not None else est_planting_year(tree_id, rec.species_latin)
        age_years = max(1, CURRENT_YEAR - py)

        m = est_moisture(tree_id)
        h = est_heat(tree_id, m)
        lpd = est_liters_per_day(tree_id, age_years)
        status = "thirsty" if m < 30 else "ok"

        name = rec.species_de or rec.species_latin or tree_id
        planting_date = datetime(py, 6, 1) if real_py is not None else None

        rows.append({
            "id": tree_id,
            "name": name,
            "species": rec.species_latin,
            "latitude": rec.lat,
            "longitude": rec.lng,
            "neighborhood": rec.neighborhood,
            "address": None,
            "planting_date": planting_date,
            "planting_year": py,
            "age_estimated": age_est,
            "est_moisture": round(m, 2),
            "est_heat": round(h, 2),
            "liters_per_day": round(lpd, 2),
            "nfc_tag_id": None,
            "device_eui": None,
            "status": status,
            "photo_url": None,
            "notes": None,
            "created_at": now,
            "updated_at": now,
        })

        map_entries.append({
            "id": tree_id,
            "sp": rec.species_latin,
            "nb": rec.neighborhood,
            "lat": round(rec.lat, 5),
            "lng": round(rec.lng, 5),
            "m": round(m, 1),
            "h": round(h, 1),
            "ay": age_years,
            "py": py,
            "lpd": round(lpd, 1),
        })

    # --- DB operations ---
    # PRAGMAs must run outside a transaction (SQLite restriction);
    # we use a raw connection for pragmas, then a separate conn.begin() for DML.
    async with engine.connect() as conn:
        # Apply performance PRAGMAs before any transaction
        await conn.execute(text("PRAGMA journal_mode=MEMORY"))
        await conn.execute(text("PRAGMA synchronous=OFF"))
        await conn.execute(text("PRAGMA temp_store=MEMORY"))

        if reset:
            print("[pipeline] resetting tables …")
            await conn.execute(text("DELETE FROM waterings"))
            await conn.execute(text("DELETE FROM readings"))
            await conn.execute(text("DELETE FROM trees"))
            await conn.commit()
            print("[pipeline] tables cleared, pragmas set")

        batch_size = 5000
        total_inserted = 0
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            await conn.execute(insert(Tree), batch)
            total_inserted += len(batch)
            await conn.commit()
            print(f"[pipeline] inserted {total_inserted}/{len(rows)} trees …")

    print(f"[pipeline] done — {total_inserted} trees in DB")

    # --- Write map JSON ---
    MAP_OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({"v": 1, "trees": map_entries}, separators=(",", ":")).encode()
    with gzip.open(MAP_OUT, "wb") as gz:
        gz.write(payload)
    print(f"[pipeline] map written → {MAP_OUT}  ({len(payload):,} bytes uncompressed)")

    return total_inserted
