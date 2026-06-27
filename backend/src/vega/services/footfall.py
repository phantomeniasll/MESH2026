"""Footfall analysis — accelerometer-based pedestrian counting.

In production, this runs on the sensor box ESP32.
The server-side service aggregates and visualizes the data.
"""

import math


def detect_steps(accel_x: list[float], accel_y: list[float], accel_z: list[float],
                 threshold: float = 0.2, min_interval_ms: int = 300) -> int:
    """Count footsteps from accelerometer data using magnitude threshold crossing.

    Simple peak detection on the acceleration magnitude vector.
    """
    if not accel_x:
        return 0

    steps = 0
    last_step_idx = -min_interval_ms  # allow first detection immediately

    for i in range(1, len(accel_x)):
        # Magnitude of acceleration vector
        mag = math.sqrt(accel_x[i]**2 + accel_y[i]**2 + accel_z[i]**2)
        prev_mag = math.sqrt(accel_x[i-1]**2 + accel_y[i-1]**2 + accel_z[i-1]**2)

        # Detect threshold crossing (positive slope)
        if prev_mag < threshold <= mag and (i - last_step_idx) >= min_interval_ms:
            steps += 1
            last_step_idx = i

    return steps


def calculate_footfall_trend(
    hourly_counts: dict[int, int],  # hour (0-23) -> count
) -> dict:
    """Analyze footfall patterns across hours of the day."""
    if not hourly_counts:
        return {"peak_hour": None, "total": 0, "busy_hours": []}

    total = sum(hourly_counts.values())
    peak_hour = max(hourly_counts, key=hourly_counts.get)  # type: ignore[arg-type]
    avg = total / 24 if total > 0 else 0
    busy_hours = [h for h, c in hourly_counts.items() if c > avg * 1.5]

    return {
        "peak_hour": peak_hour,
        "total": total,
        "avg_per_hour": round(avg, 1),
        "busy_hours": sorted(busy_hours),
    }


def estimate_daily_footfall(footfall_count: int, minutes_since_last: int) -> float:
    """Project daily footfall from a partial reading."""
    if minutes_since_last <= 0:
        return 0.0
    return (footfall_count / minutes_since_last) * 1440  # minutes in a day
