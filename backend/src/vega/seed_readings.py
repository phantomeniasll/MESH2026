"""Seed the database with realistic synthetic sensor readings for city dashboard demo.

Generates ~90 days of hourly readings across the curated demo trees, with:
  - Rush-hour noise peaks (8am, 17-18h); Tempo-30 step-down on KA-00004 after 2026-05-15
  - Pedestrian activity peaks (midday/evening); pedestrianization step-up on KA-00001 after 2026-05-15
  - Heat-island: KA-00003 (Südstadt, low canopy) runs +4°C vs KA-00002 (Schlossgarten, high canopy)
  - Heatwave window: June 2026 (days -27 to -14 from reference), afternoons peaking 38-41°C
  - Moisture slow decay + bumps on watering days

REFERENCE date = 2026-06-27 (fixed, matches StreakHeatmap demo anchor).
All randomness seeded deterministically — identical output on every run.

Usage:
    python -m vega.seed_readings            # skip if readings exist
    python -m vega.seed_readings --reset    # drop all readings first, then reseed
    python -m vega.seed_readings --days 90 --step-hours 1
"""

from __future__ import annotations

import argparse
import asyncio
import math
import random
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, select

from vega.database import async_session, init_db
from vega.models.reading import Reading
from vega.models.tree import Tree

# ── Fixed reference anchor ─────────────────────────────────────
REFERENCE = datetime(2026, 6, 27, 0, 0, 0, tzinfo=UTC)

# ── Intervention dates (baked into data so /comparison returns real deltas) ──
PEDESTRIANIZATION_DATE = datetime(2026, 5, 15, tzinfo=UTC)  # KA-00001 activity step-up
TEMPO30_DATE = datetime(2026, 5, 15, tzinfo=UTC)             # KA-00004 noise step-down

# Heatwave: afternoons spike to 38-41°C during this window
HEATWAVE_START = datetime(2026, 5, 31, tzinfo=UTC)
HEATWAVE_END = datetime(2026, 6, 13, tzinfo=UTC)

# ── Tree profiles (overrides default pattern) ──────────────────
# Each key matches a KA-##### demo tree id from seed.py DEMO_TREES.
# Fields: noise_base, activity_base, heat_offset, canopy (0-1), role
PROFILES: dict[str, dict] = {
    "KA-00001": {
        "role": "pedestrian_zone",   # high activity, pedestrianization step-up
        "noise_base": 62,            # dB equiv: 40+62*0.45 = 67.9 dB
        "activity_base": 40,         # ~3200/day pre-intervention (/hr avg)
        "heat_offset": 1.5,
        "canopy": 0.4,
    },
    "KA-00002": {
        "role": "park",              # leafy park, cool, low noise
        "noise_base": 28,
        "activity_base": 15,
        "heat_offset": -1.5,         # cooler than city average
        "canopy": 0.85,
    },
    "KA-00003": {
        "role": "heat_island",       # low canopy, hot Südstadt street
        "noise_base": 55,
        "activity_base": 20,
        "heat_offset": 4.5,          # the star of the heat section
        "canopy": 0.15,
    },
    "KA-00004": {
        "role": "traffic_street",    # high noise, Tempo-30 step-down
        "noise_base": 80,            # loud before intervention
        "activity_base": 10,
        "heat_offset": 2.0,
        "canopy": 0.2,
    },
    "KA-00005": {
        "role": "residential",
        "noise_base": 38,
        "activity_base": 18,
        "heat_offset": 0.5,
        "canopy": 0.6,
    },
    "KA-00006": {
        "role": "mixed",
        "noise_base": 50,
        "activity_base": 25,
        "heat_offset": 1.0,
        "canopy": 0.45,
    },
    "KA-00007": {
        "role": "residential",
        "noise_base": 35,
        "activity_base": 12,
        "heat_offset": 0.0,
        "canopy": 0.5,
    },
    "KA-00008": {
        "role": "residential",
        "noise_base": 42,
        "activity_base": 14,
        "heat_offset": 0.5,
        "canopy": 0.55,
    },
}

# ── Additional city-wide sensor nodes (broad geographic coverage) ────────────
# Upserted into the trees table when --reset is used, giving the IDW heatmap
# enough geographic density to look good city-wide.
EXTRA_TREES = [
    # (id, name, lat, lng, neighborhood, species, role, noise_base, activity_base, heat_offset)
    ("KA-SYN-01", "Durlach-Kastanie",       49.0014, 8.4695, "Durlach",                 "Castanea sativa",        "mixed",          55, 25,  1.5),
    ("KA-SYN-02", "Grötzingen-Eiche",       48.9988, 8.5092, "Grötzingen",              "Quercus robur",          "residential",    32,  8, -1.0),
    ("KA-SYN-03", "Rüppurr-Ahorn",          48.9745, 8.3914, "Rüppurr",                 "Acer platanoides",       "residential",    36, 10,  0.0),
    ("KA-SYN-04", "Neureut-Linde",          49.0542, 8.3786, "Neureut",                 "Tilia cordata",          "residential",    30,  8, -1.5),
    ("KA-SYN-05", "Hagsfeld-Platane",       49.0138, 8.4434, "Hagsfeld",                "Platanus x acerifolia",  "residential",    42, 15,  0.5),
    ("KA-SYN-06", "Waldstadt-Birke",        49.0215, 8.4312, "Waldstadt",               "Betula pendula",         "park",           22, 14, -2.5),
    ("KA-SYN-07", "Knielingen-Esche",       49.0312, 8.3298, "Knielingen",              "Fraxinus excelsior",     "traffic_street", 72,  8,  3.5),
    ("KA-SYN-08", "Daxlanden-Pappel",       48.9875, 8.3192, "Daxlanden",               "Populus nigra",          "traffic_street", 65, 10,  3.0),
    ("KA-SYN-09", "Stupferich-Eiche",       48.9648, 8.4781, "Stupferich",              "Quercus petraea",        "park",           20,  4, -3.0),
    ("KA-SYN-10", "Wettersbach-Linde",      48.9568, 8.4428, "Wettersbach",             "Tilia platyphyllos",     "residential",    28,  6, -2.0),
    ("KA-SYN-11", "Palmbach-Buche",         48.9509, 8.4151, "Palmbach",                "Fagus sylvatica",        "park",           18,  3, -3.5),
    ("KA-SYN-12", "Weststadt-Platane",      49.0052, 8.3654, "Weststadt",               "Platanus x acerifolia",  "mixed",          52, 22,  2.0),
    ("KA-SYN-13", "Nordwest-Ahorn",         49.0412, 8.3592, "Nordweststadt",           "Acer pseudoplatanus",    "residential",    34, 12,  0.0),
    ("KA-SYN-14", "Oststadt-Platane",       49.0152, 8.4089, "Oststadt",                "Platanus x acerifolia",  "traffic_street", 62, 18,  2.5),
    ("KA-SYN-15", "Rintheim-Esche",         49.0075, 8.4512, "Rintheim",                "Fraxinus excelsior",     "residential",    44, 16,  1.0),
    ("KA-SYN-16", "Oberreut-Linde",         48.9895, 8.3612, "Oberreut",                "Tilia cordata",          "residential",    38, 12,  1.5),
    ("KA-SYN-17", "Beiertheim-Kastanie",    48.9968, 8.3768, "Beiertheim",              "Aesculus hippocastanum", "mixed",          48, 20,  1.0),
    ("KA-SYN-18", "Weiherfeld-Birke",       48.9835, 8.3521, "Weiherfeld-Dammerstock",  "Betula pendula",         "park",           28, 10, -1.5),
    ("KA-SYN-19", "Durlach-Rosskastanie",   49.0048, 8.4398, "Durlach",                 "Aesculus hippocastanum", "mixed",          50, 22,  1.5),
    ("KA-SYN-20", "Grünwettersbach-Eiche",  48.9478, 8.4598, "Grünwettersbach",         "Quercus robur",          "park",           18,  2, -4.0),
]


def _diurnal_noise(hour: int) -> float:
    """Rush-hour peaks at 8am and 17-18h, quiet ~3am. Returns 0-1 multiplier."""
    # Two Gaussian peaks + overnight floor
    am_peak = math.exp(-0.5 * ((hour - 8) / 1.5) ** 2)
    pm_peak = math.exp(-0.5 * ((hour - 17.5) / 2.0) ** 2)
    night = 0.18 * math.exp(-0.5 * ((hour - 3) / 2.5) ** 2)
    combined = max(am_peak, pm_peak) * 0.8 + night
    return max(0.15, min(1.0, combined))


def _diurnal_activity(hour: int) -> float:
    """Pedestrian activity: midday peak + evening peak, low overnight. Returns 0-1."""
    midday = math.exp(-0.5 * ((hour - 13) / 2.5) ** 2)
    evening = 0.7 * math.exp(-0.5 * ((hour - 18) / 2.0) ** 2)
    morning = 0.4 * math.exp(-0.5 * ((hour - 8.5) / 1.5) ** 2)
    floor = 0.03
    return max(floor, min(1.0, midday * 0.9 + evening + morning))


def _diurnal_temp(hour: int, base: float) -> float:
    """Temperature: min at 5am, peak at 15h. Amplitude ~8°C."""
    phase = (hour - 5) / 24 * 2 * math.pi
    return base + 4.0 * math.sin(phase)


# Amplify per-neighbourhood heat-island contrast (heat_offset is only ±4).
HEAT_OFFSET_GAIN = 1.9


def _moisture_params(profile: dict) -> tuple[float, float, float]:
    """Per-tree moisture regime (mean, cap, floor) so neighbourhoods differ.

    Leafy / cool trees stay wet; low-canopy hot streets run dry. Gives the city
    moisture map real spatial spread instead of a uniform ~67% everywhere.
    """
    canopy = profile.get("canopy", 0.5)
    heat_off = profile.get("heat_offset", 0.0)
    mean = 52.0 + (canopy - 0.5) * 46.0 - heat_off * 3.4
    mean = max(20.0, min(82.0, mean))
    return mean, min(94.0, mean + 15.0), max(6.0, mean - 15.0)


def _make_reading_for(
    tree_id: str,
    profile: dict,
    ts: datetime,
    moisture_state: list[float],  # mutable [current_moisture]
    rng: random.Random,
) -> Reading:
    hour = ts.hour
    weekday = ts.weekday()  # 0=Mon, 6=Sun
    is_weekend = weekday >= 5
    is_after_intervention = ts >= PEDESTRIANIZATION_DATE

    role = profile["role"]
    noise_base = profile["noise_base"]
    act_base = profile["activity_base"]
    heat_off = profile["heat_offset"]

    # ── Noise (sound_level 0-100) ──────────────────────────────
    noise_mult = _diurnal_noise(hour)
    if is_weekend and role == "traffic_street":
        noise_mult *= 0.72          # less traffic on weekends
    # Tempo-30 step-down for KA-00004 after intervention date
    if role == "traffic_street" and is_after_intervention:
        noise_base = round(noise_base * 0.78)  # ~-14 dB equiv
    noise = noise_base * noise_mult + rng.gauss(0, 2.5)
    sound_level = int(max(3, min(100, round(noise))))

    # ── Activity (footfall_count per hour) ────────────────────
    act_mult = _diurnal_activity(hour)
    if is_weekend and role in ("pedestrian_zone", "park", "mixed"):
        act_mult *= 1.4             # more weekend leisure traffic
    elif is_weekend:
        act_mult *= 0.8
    # Pedestrianization step-up for KA-00001 after intervention date
    if role == "pedestrian_zone" and is_after_intervention:
        act_base = round(act_base * 1.37)  # 3200→8700/day
    raw_act = act_base * act_mult * (1 + rng.gauss(0, 0.15))
    footfall_count = int(max(0, round(raw_act)))

    # ── Temperature (°C) ─────────────────────────────────────
    # Seasonal baseline for Karlsruhe June: ~22°C mean
    season_base = 22.0
    temp_base = season_base + heat_off * HEAT_OFFSET_GAIN
    temperature = _diurnal_temp(hour, temp_base) + rng.gauss(0, 0.8)
    # Heatwave spike on afternoons during heatwave window
    if HEATWAVE_START <= ts <= HEATWAVE_END and 12 <= hour <= 19:
        heatwave_mult = math.exp(-0.5 * ((hour - 15) / 3.0) ** 2)
        temperature += 8.0 * heatwave_mult * (1 + heat_off / 10)
    temperature = round(max(-5.0, min(55.0, temperature)), 1)

    # ── Humidity ─────────────────────────────────────────────
    # Inverse of temperature roughly
    humidity_base = 55.0 - heat_off * 2
    humidity = humidity_base + rng.gauss(0, 5.0) - (temperature - season_base) * 0.8
    humidity = round(max(10.0, min(100.0, humidity)), 1)

    # ── Moisture (slow decay + bumps around a per-tree mean) ──
    m_mean, m_cap, m_floor = _moisture_params(profile)
    # Hotter/low-canopy trees dry a little faster.
    moisture_state[0] -= rng.uniform(0.1, 0.4) * (1.0 + max(0.0, heat_off) * 0.06)
    if moisture_state[0] < m_floor:
        moisture_state[0] = m_floor
    # Simulate rain/watering: random bump ~5% of daytime hours, capped per tree
    if rng.random() < 0.05 and hour in range(5, 22):
        moisture_state[0] = min(m_cap, moisture_state[0] + rng.uniform(15, 30))
    moisture = round(max(5.0, min(95.0, moisture_state[0] + rng.gauss(0, 0.5))), 1)

    # ── Misc ─────────────────────────────────────────────────
    battery_voltage = round(rng.uniform(3.5, 4.1), 2)
    tilt_angle = round(abs(rng.gauss(0, 0.3)), 2)
    rssi = int(rng.uniform(-95, -55))
    snr = round(rng.uniform(4.0, 12.0), 1)

    return Reading(
        id=str(uuid.uuid4()),
        tree_id=tree_id,
        sound_level=sound_level,
        footfall_count=footfall_count,
        temperature=temperature,
        humidity=humidity,
        moisture=moisture,
        battery_voltage=battery_voltage,
        tilt_angle=tilt_angle,
        rssi=rssi,
        snr=snr,
        recorded_at=ts,
        created_at=ts,
    )


def make_readings(
    tree_ids: list[str],
    days: int = 90,
    step_hours: int = 1,
) -> list[Reading]:
    """Generate synthetic readings. Fully deterministic."""
    master_rng = random.Random(42)
    readings: list[Reading] = []

    for tree_id in tree_ids:
        profile = PROFILES.get(tree_id, {
            "role": "residential",
            "noise_base": 40,
            "activity_base": 15,
            "heat_offset": 0.0,
            "canopy": 0.5,
        })
        # Per-tree deterministic seed
        tree_seed = master_rng.randint(0, 2**32 - 1)
        rng = random.Random(tree_seed)

        moisture_state = [_moisture_params(profile)[0]]  # start at per-tree mean
        start = REFERENCE - timedelta(days=days)

        hours = days * 24 // step_hours
        for i in range(hours):
            ts = start + timedelta(hours=i * step_hours)
            r = _make_reading_for(tree_id, profile, ts, moisture_state, rng)
            readings.append(r)

    return readings


async def seed_readings(reset: bool = False, days: int = 90, step_hours: int = 1) -> None:
    """Insert synthetic readings into the DB."""
    await init_db()

    async with async_session() as session:
        if reset:
            await session.execute(delete(Reading))
            await session.execute(
                delete(Tree).where(Tree.id.like("KA-SYN-%"))  # type: ignore[arg-type]
            )
            await session.commit()
            print("  Deleted all existing readings and synthetic sensor nodes.")

        # Skip readings if they already exist (idempotent)
        existing = (await session.execute(select(Reading).limit(1))).scalar_one_or_none()
        if existing and not reset:
            print("  Readings already exist. Use --reset to regenerate.")
            return

        # Upsert extra city-wide sensor trees (skip if already present)
        for row in EXTRA_TREES:
            tid, name, lat, lng, nbhd, species, _role, _nb, _ab, _ho = row
            exists = (await session.execute(select(Tree.id).where(Tree.id == tid))).scalar_one_or_none()
            if not exists:
                session.add(Tree(
                    id=tid, name=name, latitude=lat, longitude=lng,
                    neighborhood=nbhd, species=species, status="healthy",
                ))
        await session.flush()

        # Build PROFILES entries for extra trees
        for row in EXTRA_TREES:
            tid, _name, _lat, _lng, _nbhd, _species, role, nb, ab, ho = row
            if tid not in PROFILES:
                PROFILES[tid] = {
                    "role": role, "noise_base": nb, "activity_base": ab,
                    "heat_offset": ho, "canopy": 0.5,
                }

        # Collect all tree ids with profiles that exist in DB
        curated_ids = list(PROFILES.keys())
        result = await session.execute(select(Tree.id).where(Tree.id.in_(curated_ids)))
        tree_ids = [row[0] for row in result.all()]
        if not tree_ids:
            print("  No demo trees found — run `python -m vega.seed` first.")
            return

        print(f"  Generating readings for {len(tree_ids)} trees × {days} days × {24 // step_hours} readings/day…")
        readings = make_readings(tree_ids, days=days, step_hours=step_hours)
        print(f"  Inserting {len(readings):,} readings in batches…")

        chunk = 500
        for i in range(0, len(readings), chunk):
            session.add_all(readings[i : i + chunk])
            await session.flush()

        await session.commit()
        print(f"  Done. {len(readings):,} readings seeded across {len(tree_ids)} trees.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed synthetic sensor readings for city dashboard demo.")
    parser.add_argument("--reset", action="store_true", help="Delete existing readings before seeding")
    parser.add_argument("--days", type=int, default=90, help="Days of history to generate (default: 90)")
    parser.add_argument("--step-hours", type=int, default=1, help="Reading interval in hours (default: 1)")
    args = parser.parse_args()

    asyncio.run(seed_readings(reset=args.reset, days=args.days, step_hours=args.step_hours))


if __name__ == "__main__":
    main()
