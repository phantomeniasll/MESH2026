"""CLI entry point for the VEGA data import pipeline.

Usage:
    vega-import [options]
    python -m vega.data_import.cli [options]
"""

import argparse
import asyncio

from .pipeline import run_pipeline


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="vega-import",
        description="Import tree data from Karlsruhe ArcGIS, OSM, and CSV drop files into VEGA.",
    )
    parser.add_argument(
        "--sources",
        choices=["karlsruhe", "osm", "csv", "all"],
        default="all",
        help="Which sources to fetch from (default: all)",
    )
    parser.add_argument(
        "--bbox",
        default=None,
        help=(
            "Bounding box preset ('innenstadt', 'karlsruhe') or raw "
            "'minlat,minlng,maxlat,maxlng'. Default: None = full extent."
        ),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Per-source record cap (useful for testing)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        default=False,
        help="Wipe trees/readings/waterings tables before inserting",
    )
    parser.add_argument(
        "--no-osm",
        action="store_true",
        default=False,
        help="Skip OSM even when sources=all",
    )
    return parser.parse_args(argv)


def _resolve_bbox_args(bbox_arg: str | None) -> tuple[str | None, str | None]:
    """Split --bbox into (preset_name, raw_string)."""
    if bbox_arg is None:
        return None, None
    if bbox_arg in ("innenstadt", "karlsruhe"):
        return bbox_arg, None
    # Assume raw "minlat,minlng,maxlat,maxlng"
    return None, bbox_arg


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    bbox_name, bbox_raw = _resolve_bbox_args(args.bbox)

    print("[vega-import] starting …")
    count = asyncio.run(
        run_pipeline(
            sources=args.sources,
            bbox_name=bbox_name,
            bbox_raw=bbox_raw,
            limit=args.limit,
            reset=args.reset,
            no_osm=args.no_osm,
        )
    )
    print(f"[vega-import] complete — {count} trees imported.")


if __name__ == "__main__":
    main()
