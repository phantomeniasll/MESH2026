import csv
import pathlib
from ..base import NormalizedRecord, BBox
from typing import Iterator

DROP_DIR = pathlib.Path(__file__).parent.parent.parent.parent.parent / "data" / "drop"

# Column map: {filename_prefix: {field: col_name, ...}}
SCHEMAS = {
    "ioer": {
        "lat": "lat", "lng": "lon", "species_latin": "species", "species_de": "name_de",
        "planting_year": "pflanzjahr", "neighborhood": "stadtteil",
    },
    "berlin": {
        "lat": "lat", "lng": "lon", "species_latin": "art_dtsch", "species_de": "art_dtsch",
        "planting_year": "pflanzjahr", "neighborhood": "bezirk",
    },
    "frankfurt": {
        "lat": "geoCoordinate.latitude", "lng": "geoCoordinate.longitude",
        "species_latin": "art", "species_de": "deutscherName",
        "planting_year": "pflanzjahr", "neighborhood": "stadtgebiet",
    },
}


class CsvDrop:
    name = "csv_drop"

    def fetch(self, bbox: BBox | None = None, limit: int | None = None) -> Iterator[NormalizedRecord]:
        if not DROP_DIR.exists():
            return
        count = 0
        for path in DROP_DIR.glob("*.csv"):
            schema_key = next((k for k in SCHEMAS if path.name.startswith(k + "_")), None)
            if schema_key is None:
                print(f"  [CSV] skipping {path.name} (no schema match)")
                continue
            cols = SCHEMAS[schema_key]
            source_name = f"csv:{schema_key}"
            with open(path, newline="", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        lat = float(row[cols["lat"]])
                        lng = float(row[cols["lng"]])
                    except (KeyError, ValueError):
                        continue
                    py_raw = row.get(cols.get("planting_year", ""), "").strip()
                    py = int(py_raw) if py_raw.isdigit() else None
                    yield NormalizedRecord(
                        source=source_name,
                        lat=lat, lng=lng,
                        species_latin=row.get(cols.get("species_latin", "")) or None,
                        species_de=row.get(cols.get("species_de", "")) or None,
                        neighborhood=row.get(cols.get("neighborhood", "")) or None,
                        planting_year=py,
                        external_ref=None,
                    )
                    count += 1
                    if limit and count >= limit:
                        return
