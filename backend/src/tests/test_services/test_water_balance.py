"""Unit tests for the pure soil-water-balance functions (no network)."""

from vega.services.water_balance import (
    MOISTURE_THRESHOLD,
    age_stress,
    find_now_index,
    forecast_curve,
    now_cast,
)
from vega.services.weather import Weather


def _weather(times, et0, precip, soil_vwc=None) -> Weather:
    n = len(times)
    return {
        "time": times,
        "et0": et0,
        "precip": precip,
        "soil_vwc": soil_vwc if soil_vwc is not None else [0.25] * n,
        "soil_vwc_deep": [0.25] * n,
        "temp": [20.0] * n,
        "rh": [50.0] * n,
    }


def test_find_now_index_picks_slot_at_or_before_now():
    times = ["2026-06-27T20:00", "2026-06-27T21:00", "2026-06-27T22:00"]
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now = datetime(2026, 6, 27, 21, 30, tzinfo=ZoneInfo("Europe/Berlin"))
    assert find_now_index(times, now) == 1


def test_age_stress_young_drains_faster_than_old():
    assert age_stress(2) > age_stress(20) > age_stress(60)


def test_now_cast_prefers_sensor_over_model():
    w = _weather(["2026-06-27T22:00"], [0.0], [0.0], soil_vwc=[0.25])
    val, src = now_cast(41.0, w, 0)
    assert (val, src) == (41.0, "sensor")
    val2, src2 = now_cast(None, w, 0)
    assert src2 == "modeled" and 0 <= val2 <= 100


def test_dry_stretch_declines_and_sets_dry_in_hours():
    # Hot, rainless: high ET0, zero precip → moisture must fall to threshold.
    times = [f"2026-06-27T{h:02d}:00" for h in range(0, 24)]
    w = _weather(times, et0=[0.5] * 24, precip=[0.0] * 24)
    fc = forecast_curve(60.0, w, now_idx=0, age_years=3)
    assert fc["dry_in_hours"] is not None
    assert fc["curve"][-1]["m"] < fc["curve"][0]["m"]
    assert fc["next_rain_at"] is None
    assert fc["will_refill"] is False


def test_rain_refills_and_flags_will_refill():
    times = [f"2026-06-27T{h:02d}:00" for h in range(0, 12)]
    precip = [0.0] * 12
    precip[5] = 5.0  # a wet hour
    w = _weather(times, et0=[0.1] * 12, precip=precip)
    fc = forecast_curve(40.0, w, now_idx=0, age_years=10)
    assert fc["next_rain_at"] == "2026-06-27T05:00"
    assert fc["will_refill"] is True
    # the wet hour (index 5) refills above the prior, still-declining hour
    assert fc["curve"][5]["m"] > fc["curve"][4]["m"]


def test_already_thirsty_reports_zero_hours():
    times = ["2026-06-27T22:00", "2026-06-27T23:00"]
    w = _weather(times, et0=[0.1, 0.1], precip=[0.0, 0.0])
    fc = forecast_curve(MOISTURE_THRESHOLD - 5, w, now_idx=0)
    assert fc["dry_in_hours"] == 0
