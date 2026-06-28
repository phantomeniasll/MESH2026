"""Regenerate generated/trees.map.json.gz with weather-based moisture + liters.

Replaces the per-tree hash moisture (`est_moisture`) with a smooth, real field:
samples Open-Meteo soil moisture / ET0 / precipitation at a ~30-point grid over
the Karlsruhe metro, IDW-interpolates per tree, and writes the result. A few
drought-prone species are exaggerated thirstier so the map shows meaningful
dark-orange standouts rather than random multicoloured blobs.

Marker colour scale (MapView): m=20 dark-orange, 40 amber, 60 yellow-green, 100 green.

Run:  cd backend && PYTHONPATH=src .venv/bin/python scripts/regen_snapshot.py
"""

from __future__ import annotations

import asyncio
import gzip
import hashlib
import json
from pathlib import Path

from vega.services.water_balance import find_now_index, water_need_from_totals
from vega.services.weather import get_weather, vwc_to_pct

SNAPSHOT = Path(__file__).resolve().parent.parent / "generated" / "trees.map.json.gz"

GRID_COLS, GRID_ROWS = 6, 5  # ~30 weather sample points

# Display tuning (against the MapView colour interpolation).
DISPLAY_BASE_OFFSET = 46.0  # local soil % → base ~58 (slightly oranger overall)
LOCAL_JITTER = 14.0  # ± per-tree deterministic variation for local texture (±7)
YOUNG_AGE = 5
YOUNG_PENALTY = 12.0
# Drought-prone / shallow-rooted genera (each <2% of the inventory → a sprinkle).
DROUGHT_GENERA = {"Betula", "Prunus", "Sorbus", "Aesculus", "Salix", "Crataegus"}
DROUGHT_PENALTY = 14.0
EXAGGERATE_FRACTION = 0.45  # share of drought-prone trees pushed to dark orange
EXAGGERATE_PENALTY = 26.0
EXAGGERATE_FLOOR = 20.0  # keep exaggerated trees in dark-orange, not full red


def stable_h(s: str) -> float:
    """Deterministic [0,1) hash, stable across runs (unlike builtin hash)."""
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def genus(species: str | None) -> str:
    parts = species.split() if species else []
    return parts[0] if parts else ""


async def main() -> None:
    data = json.loads(gzip.decompress(SNAPSHOT.read_bytes()))
    trees = data["trees"]
    print(f"Loaded {len(trees)} trees.")

    # Back up the original once.
    bak = SNAPSHOT.with_suffix(".gz.bak")
    if not bak.exists():
        bak.write_bytes(SNAPSHOT.read_bytes())
        print(f"Backed up original → {bak.name}")

    lats = [t["lat"] for t in trees]
    lngs = [t["lng"] for t in trees]
    lat0, lat1 = min(lats), max(lats)
    lng0, lng1 = min(lngs), max(lngs)

    # ── Build grid + fetch weather at each sample point ──
    grid = [
        (
            lat0 + ((r + 0.5) / GRID_ROWS) * (lat1 - lat0),
            lng0 + ((c + 0.5) / GRID_COLS) * (lng1 - lng0),
        )
        for r in range(GRID_ROWS)
        for c in range(GRID_COLS)
    ]

    samples: list[tuple[float, float, float, float, float]] = []
    for plat, plng in grid:
        w = await get_weather(plat, plng)
        if w is None:
            continue
        ni = find_now_index(w["time"])
        soil_pct = vwc_to_pct(w["soil_vwc"][ni])
        soil_pct = 22.0 if soil_pct is None else soil_pct
        end = min(len(w["et0"]), ni + 24)
        et0_24h = sum((w["et0"][i] or 0.0) for i in range(ni, end))
        rain_24h = sum((w["precip"][i] or 0.0) for i in range(ni, end))
        samples.append((plat, plng, soil_pct, et0_24h, rain_24h))
        print(f"  {plat:.3f},{plng:.3f}  soil={soil_pct:4.1f}%  et0={et0_24h:4.1f}  rain={rain_24h:4.1f}")

    if not samples:
        print("No weather samples (no internet?) — aborting, snapshot unchanged.")
        return
    print(f"{len(samples)} weather samples collected.")

    def idw(lat: float, lng: float) -> tuple[float, float, float]:
        ns = ne = nr = denom = 0.0
        for plat, plng, soil, et0, rain in samples:
            d2 = (lat - plat) ** 2 + (lng - plng) ** 2
            if d2 < 1e-12:
                return soil, et0, rain
            wgt = 1.0 / d2
            ns += wgt * soil
            ne += wgt * et0
            nr += wgt * rain
            denom += wgt
        return ns / denom, ne / denom, nr / denom

    young = drought = dark = 0
    for t in trees:
        soil_pct, et0_24h, rain_24h = idw(t["lat"], t["lng"])
        # Small deterministic per-tree jitter for local texture (not random blobs).
        jitter = (stable_h(t["id"] + "j") - 0.5) * LOCAL_JITTER
        m = DISPLAY_BASE_OFFSET + soil_pct + jitter
        if (t.get("ay") or 0) <= YOUNG_AGE:
            m -= YOUNG_PENALTY
            young += 1
        floor = 8.0
        if genus(t.get("sp")) in DROUGHT_GENERA:
            m -= DROUGHT_PENALTY
            drought += 1
            if stable_h(t["id"]) < EXAGGERATE_FRACTION:
                m -= EXAGGERATE_PENALTY
                floor = EXAGGERATE_FLOOR  # stay dark-orange, not full red
                dark += 1
        t["m"] = round(max(floor, min(95.0, m)), 1)
        t["lpd"] = water_need_from_totals(et0_24h, rain_24h, t.get("ay"), t.get("sp"))
        # Heat (°C-realistic): hotter where drier, plus local jitter. Kept in a
        # believable ~23-40 °C band — the colour scale normalises min→max, so the
        # overlay still spans green→red without extreme outliers flattening it.
        heat_jit = (stable_h(t["id"] + "h") - 0.5) * 6.0  # ±3
        t["h"] = round(max(22.0, min(41.0, 31.0 - (t["m"] - 50.0) * 0.2 + heat_jit)), 1)

    # ── Report colour-band distribution ──
    bands = {"red <20": 0, "dark-orange 20-30": 0, "amber 30-45": 0, "yellow-green 45-60": 0, "green >=60": 0}
    for t in trees:
        m = t["m"]
        if m < 20:
            bands["red <20"] += 1
        elif m < 30:
            bands["dark-orange 20-30"] += 1
        elif m < 45:
            bands["amber 30-45"] += 1
        elif m < 60:
            bands["yellow-green 45-60"] += 1
        else:
            bands["green >=60"] += 1
    n = len(trees)
    print("\nmoisture colour bands:")
    for k, v in bands.items():
        print(f"  {k:20} {v:7} ({100 * v / n:4.1f}%)")
    print(f"young={young}  drought-species={drought}  exaggerated-dark={dark}")

    SNAPSHOT.write_bytes(gzip.compress(json.dumps(data, separators=(",", ":")).encode()))
    print(f"\nWrote {SNAPSHOT}  ({SNAPSHOT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    asyncio.run(main())
