"""Open-Meteo weather client.

Fetches hourly weather for a location and returns the variables the
soil-water-balance model needs: FAO-56 reference evapotranspiration (ET0),
precipitation, and modelled soil moisture (a free physics prior for trees
without a sensor).

Free, no API key, German coverage via the DWD ICON-D2 model. We deliberately
fetch per coarse location (rounded lat/lng) and cache, so repeated tree taps in
the same neighbourhood don't re-hit the API.
"""

from __future__ import annotations

import time
from typing import TypedDict

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Hourly variables requested from Open-Meteo (order doesn't matter).
_HOURLY_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "et0_fao_evapotranspiration",
    "soil_moisture_3_to_9cm",
    "soil_moisture_9_to_27cm",
    "shortwave_radiation",
]

_FORECAST_DAYS = 7
_PAST_DAYS = 2
_CACHE_TTL_SEC = 30 * 60  # 30 min — soil is slow; weather updates hourly at most
_TIMEOUT_SEC = 8.0

# Volumetric water content (m³/m³) → 0–100% display scale.
# Rough soil envelope: ~0.10 (wilting) to ~0.40 (field capacity) for loam.
_VWC_WILT = 0.10
_VWC_FC = 0.40


class Weather(TypedDict):
    """Parallel hourly arrays. Index 0 = earliest (``_PAST_DAYS`` ago)."""

    time: list[str]  # ISO8601 local (Europe/Berlin)
    et0: list[float | None]  # mm — FAO-56 reference ET
    precip: list[float | None]  # mm
    soil_vwc: list[float | None]  # m³/m³, 3–9 cm (root zone of young trees)
    soil_vwc_deep: list[float | None]  # m³/m³, 9–27 cm
    temp: list[float | None]  # °C
    rh: list[float | None]  # %


# (lat_r, lng_r) -> (fetched_monotonic, Weather)
_cache: dict[tuple[float, float], tuple[float, Weather]] = {}


def vwc_to_pct(vwc: float | None) -> float | None:
    """Map volumetric soil moisture (m³/m³) onto the 0–100 scale used elsewhere."""
    if vwc is None:
        return None
    pct = (vwc - _VWC_WILT) / (_VWC_FC - _VWC_WILT) * 100.0
    return max(0.0, min(100.0, pct))


async def get_weather(lat: float, lng: float) -> Weather | None:
    """Fetch hourly weather for ``(lat, lng)``.

    Returns ``None`` on any network/parse error so callers can fall back
    gracefully (the forecast endpoint degrades to ``source="unavailable"``).
    """
    key = (round(lat, 2), round(lng, 2))
    now = time.monotonic()

    cached = _cache.get(key)
    if cached is not None and (now - cached[0]) < _CACHE_TTL_SEC:
        return cached[1]

    params: dict[str, str | float | int] = {
        "latitude": lat,
        "longitude": lng,
        "hourly": ",".join(_HOURLY_VARS),
        "forecast_days": _FORECAST_DAYS,
        "past_days": _PAST_DAYS,
        "timezone": "Europe/Berlin",
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SEC) as client:
            resp = await client.get(OPEN_METEO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        h = data["hourly"]
        weather: Weather = {
            "time": h["time"],
            "et0": h["et0_fao_evapotranspiration"],
            "precip": h["precipitation"],
            "soil_vwc": h["soil_moisture_3_to_9cm"],
            "soil_vwc_deep": h["soil_moisture_9_to_27cm"],
            "temp": h["temperature_2m"],
            "rh": h["relative_humidity_2m"],
        }
    except (httpx.HTTPError, KeyError, ValueError) as exc:  # noqa: BLE001 — degrade gracefully
        print(f"[weather] fetch failed for {key}: {exc!r}")
        return None

    _cache[key] = (now, weather)
    return weather
