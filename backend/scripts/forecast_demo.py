"""Standalone pitch-chart generator (fallback if the live UI isn't ready).

Pulls real Karlsruhe weather from Open-Meteo, runs the same water-balance model
the API uses, prints the headline numbers, and writes a dependency-free SVG
moisture-dry-down + rain-refill chart for a slide.

Usage:
    python scripts/forecast_demo.py [--lat 49.0069 --lng 8.4037] [--start 55] [--age 3]
    python scripts/forecast_demo.py --out forecast.svg

Requires only what the backend already depends on (httpx). No matplotlib.
"""

from __future__ import annotations

import argparse
import asyncio

from vega.services.water_balance import (
    MOISTURE_THRESHOLD,
    find_now_index,
    forecast_curve,
)
from vega.services.weather import get_weather

KARLSRUHE = (49.0069, 8.4037)


def render_svg(curve, precip, threshold, out_path: str) -> None:
    w, h, pad = 900, 320, 40
    iw, ih = w - 2 * pad, h - 2 * pad
    n = len(curve)
    xs = max(1, n - 1)

    def x(i: int) -> float:
        return pad + (i / xs) * iw

    def y(m: float) -> float:
        return pad + (1 - m / 100) * ih

    moist_pts = " ".join(f"{x(i):.1f},{y(p['m']):.1f}" for i, p in enumerate(curve))
    ty = y(threshold)

    pmax = max([*precip, 1.0])
    bars = "".join(
        f'<rect x="{x(i) - 2:.1f}" y="{pad + ih - (p / pmax) * ih * 0.35:.1f}" '
        f'width="4" height="{(p / pmax) * ih * 0.35:.1f}" fill="#7CC4F0" opacity="0.8"/>'
        for i, p in enumerate(precip)
        if p > 0
    )

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <rect width="{w}" height="{h}" fill="white"/>
  <text x="{pad}" y="24" font-family="sans-serif" font-size="16" font-weight="700" fill="#1B5732">
    BeTree — 7-day soil-moisture forecast (Karlsruhe, live Open-Meteo / DWD ICON-D2)</text>
  {bars}
  <line x1="{pad}" y1="{ty:.1f}" x2="{w - pad}" y2="{ty:.1f}" stroke="#2E9E63" stroke-width="1.5" stroke-dasharray="6 4"/>
  <text x="{w - pad}" y="{ty - 6:.1f}" text-anchor="end" font-family="sans-serif" font-size="11" fill="#2E9E63">thirsty threshold ({threshold:.0f}%)</text>
  <polyline points="{moist_pts}" fill="none" stroke="#1B5732" stroke-width="2.5" stroke-linejoin="round"/>
  <text x="{pad}" y="{h - 10}" font-family="sans-serif" font-size="11" fill="#666">blue bars = forecast rainfall · green line = predicted root-zone moisture</text>
</svg>"""
    with open(out_path, "w") as f:
        f.write(svg)


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, default=KARLSRUHE[0])
    ap.add_argument("--lng", type=float, default=KARLSRUHE[1])
    ap.add_argument("--start", type=float, default=55.0, help="starting moisture %%")
    ap.add_argument("--age", type=int, default=3, help="tree age in years")
    ap.add_argument("--out", default="forecast.svg")
    args = ap.parse_args()

    weather = await get_weather(args.lat, args.lng)
    if weather is None:
        print("Weather fetch failed (no internet?). Cannot generate demo.")
        return

    now_idx = find_now_index(weather["time"])
    fc = forecast_curve(args.start, weather, now_idx, age_years=args.age)
    curve = fc["curve"]
    precip = [weather["precip"][i] or 0.0 for i in range(now_idx, now_idx + len(curve))]

    print(f"Start moisture : {args.start:.0f}%   (age {args.age} yr)")
    print(f"Dry by         : {fc['dry_by']}  (in {fc['dry_in_hours']} h)")
    print(f"Next rain      : {fc['next_rain_at']}")
    print(f"Will refill    : {fc['will_refill']}")
    print(f"Min moisture   : {min(p['m'] for p in curve):.1f}%")

    render_svg(curve, precip, MOISTURE_THRESHOLD, args.out)
    print(f"\nChart written  : {args.out}")


if __name__ == "__main__":
    asyncio.run(main())
