"""Soil-water-balance forecast (hybrid model).

A deliberately small single-bucket balance driven by Open-Meteo's FAO-56
reference evapotranspiration (loss) and precipitation (gain). Anchored to a real
sensor reading where one exists, otherwise seeded from Open-Meteo's modelled
soil moisture.

Pure functions — no I/O, no DB — so they're trivially unit-testable and reused
by both the API endpoint and the standalone pitch-chart script.

NOTE: the loss/gain constants are physics-shaped but eyeballed, not trained.
Present as "physics-based estimate, calibrates as sensors deploy" — never quote
an accuracy figure.
"""

from __future__ import annotations

from datetime import datetime
from typing import TypedDict
from zoneinfo import ZoneInfo

from .weather import Weather, vwc_to_pct

_TZ = ZoneInfo("Europe/Berlin")

# Default moisture below which a tree is "thirsty" — matches the frontend
# map colouring (deriveStatus: moisture < 30).
MOISTURE_THRESHOLD = 30.0

# Balance tuning. ET0 is mm/h (~0.0–0.4 hot afternoon, ~4–5 mm summed/day);
# precip is mm/h. Constants chosen so a hot rainless day drops a mid-moisture
# tree a few %/day and a few mm of rain visibly refills it.
_K_LOSS = 4.0
_K_GAIN = 6.0
_RAIN_HOUR_MM = 1.0  # an hour counts as "rain" above this

# Establishment-phase stress: young trees have shallow roots and dry faster.
_YOUNG_AGE = 5
_YOUNG_STRESS = 1.5
_OLD_AGE = 40
_OLD_STRESS = 0.8

# ── Daily water-need model (ET0 × Kc × canopy area − effective rain) ──
# 1 mm of water over 1 m² of canopy footprint == 1 litre.
_KC_DEFAULT = 0.75  # FAO-56 crop coefficient, generic broadleaf
_KC_BY_GENUS = {
    "Tilia": 0.85,
    "Acer": 0.80,
    "Platanus": 0.90,
    "Quercus": 0.75,
    "Fraxinus": 0.80,
    "Betula": 0.70,
    "Prunus": 0.70,
    "Sorbus": 0.70,
}
_THROUGHFALL = 0.8  # fraction of rainfall that reaches the root zone
_CANOPY_MIN_M2 = 2.0
_CANOPY_MAX_M2 = 20.0
_CANOPY_PER_YEAR_M2 = 1.2  # crown footprint growth per year, until capped


def _kc_for(species: str | None) -> float:
    parts = species.split() if species else []
    if not parts:
        return _KC_DEFAULT
    return _KC_BY_GENUS.get(parts[0], _KC_DEFAULT)


def _canopy_area_m2(age_years: int | None) -> float:
    age = 8 if age_years is None else age_years
    return max(_CANOPY_MIN_M2, min(_CANOPY_MAX_M2, _CANOPY_PER_YEAR_M2 * age))


def daily_water_need(
    weather: Weather,
    now_idx: int,
    age_years: int | None,
    species: str | None,
) -> float:
    """Estimated supplemental water (litres/day) from local weather.

    need = max(0, ET0_24h × Kc(species) − rain_24h × throughfall) × canopy_area

    Falls toward 0 when meaningful rain is forecast — a tree the sky is about to
    water doesn't need a citizen to. Differs between neighbours for real reasons
    (species, age/canopy, sun/heat baked into ET0), not a hash.
    """
    et0 = weather["et0"]
    precip = weather["precip"]
    end = min(len(et0), now_idx + 24)
    et0_24h = sum((et0[i] or 0.0) for i in range(now_idx, end))
    rain_24h = sum((precip[i] or 0.0) for i in range(now_idx, end))
    return water_need_from_totals(et0_24h, rain_24h, age_years, species)


def water_need_from_totals(
    et0_24h: float,
    rain_24h: float,
    age_years: int | None,
    species: str | None,
) -> float:
    """Daily water need (litres) from pre-summed 24 h ET0 + rainfall totals.

    Same model as :func:`daily_water_need` but takes scalar totals, so the
    snapshot regen can reuse it with IDW-interpolated weather per tree.
    """
    etc_mm = et0_24h * _kc_for(species)
    net_mm = max(0.0, etc_mm - rain_24h * _THROUGHFALL)
    return round(net_mm * _canopy_area_m2(age_years), 1)


class CurvePoint(TypedDict):
    t: str  # ISO8601 local
    m: float  # 0–100


class Forecast(TypedDict):
    curve: list[CurvePoint]
    dry_in_hours: int | None  # hours until moisture first hits threshold (0 if already)
    dry_by: str | None  # ISO timestamp of that crossing
    next_rain_at: str | None  # ISO of next hour with meaningful rain
    will_refill: bool  # meaningful rain coming within the horizon


def age_stress(age_years: int | None) -> float:
    """Multiplier on water loss from tree age (young = drains faster)."""
    if age_years is None:
        return 1.0
    if age_years <= _YOUNG_AGE:
        return _YOUNG_STRESS
    if age_years >= _OLD_AGE:
        return _OLD_STRESS
    return 1.0


def find_now_index(times: list[str], now: datetime | None = None) -> int:
    """Index of the hourly slot at/just before ``now`` (weather includes past days)."""
    if now is None:
        now = datetime.now(_TZ)
    now_key = now.strftime("%Y-%m-%dT%H:00")
    idx = 0
    for i, t in enumerate(times):
        if t <= now_key:
            idx = i
        else:
            break
    return idx


def now_cast(
    latest_moisture: float | None,
    weather: Weather,
    now_idx: int,
) -> tuple[float, str]:
    """Current moisture estimate + its source.

    Sensor reading wins; otherwise fall back to modelled soil moisture.
    """
    if latest_moisture is not None:
        return max(0.0, min(100.0, latest_moisture)), "sensor"
    seeded = vwc_to_pct(weather["soil_vwc"][now_idx])
    if seeded is not None:
        return seeded, "modeled"
    return 30.0, "modeled"  # last-resort neutral default


def forecast_curve(
    start_moisture: float,
    weather: Weather,
    now_idx: int,
    age_years: int | None = None,
    threshold: float = MOISTURE_THRESHOLD,
) -> Forecast:
    """Integrate the bucket forward from ``now_idx`` to the end of the horizon."""
    stress = age_stress(age_years)
    times = weather["time"]
    et0 = weather["et0"]
    precip = weather["precip"]

    curve: list[CurvePoint] = [{"t": times[now_idx], "m": round(start_moisture, 1)}]
    dry_in_hours: int | None = 0 if start_moisture <= threshold else None
    dry_by: str | None = times[now_idx] if dry_in_hours == 0 else None
    next_rain_at: str | None = None
    upcoming_rain_mm = 0.0

    m = start_moisture
    n = len(times)
    for step, i in enumerate(range(now_idx + 1, n), start=1):
        e = et0[i] or 0.0
        p = precip[i] or 0.0
        if p >= _RAIN_HOUR_MM:
            upcoming_rain_mm += p
            if next_rain_at is None:
                next_rain_at = times[i]
        m = m - _K_LOSS * e * stress + _K_GAIN * p
        m = max(0.0, min(100.0, m))
        curve.append({"t": times[i], "m": round(m, 1)})
        if dry_in_hours is None and m <= threshold:
            dry_in_hours = step
            dry_by = times[i]

    will_refill = next_rain_at is not None and upcoming_rain_mm >= 3.0

    return {
        "curve": curve,
        "dry_in_hours": dry_in_hours,
        "dry_by": dry_by,
        "next_rain_at": next_rain_at,
        "will_refill": will_refill,
    }
