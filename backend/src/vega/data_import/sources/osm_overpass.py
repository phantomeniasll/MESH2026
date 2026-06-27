import re
from collections.abc import Iterator

import httpx

from ..base import BBox, NormalizedRecord

ENDPOINT = "https://overpass-api.de/api/interpreter"


class OsmOverpass:
    name = "osm"

    def fetch(self, bbox: BBox | None = None, limit: int | None = None) -> Iterator[NormalizedRecord]:
        if bbox:
            area = f"{bbox.min_lat},{bbox.min_lng},{bbox.max_lat},{bbox.max_lng}"
        else:
            # Default: Karlsruhe region
            area = "48.9,8.3,49.1,8.55"
        query = f'[out:json][timeout:180];node["natural"="tree"]({area});out;'
        data = None
        for attempt in range(2):
            try:
                r = httpx.post(ENDPOINT, content=query, timeout=200.0,
                               headers={"Content-Type": "text/plain"})
                r.raise_for_status()
                data = r.json()
                break
            except Exception as e:
                print(f"  [OSM] attempt {attempt+1} failed: {e}")
        if not data:
            return
        elements = data.get("elements", [])
        count = 0
        for el in elements:
            if el.get("type") != "node":
                continue
            tags = el.get("tags", {})
            lat, lng = el.get("lat"), el.get("lon")
            if lat is None or lng is None:
                continue
            # Parse start_date: "2015", "2015-04-01", "ca. 2010" etc.
            py = None
            sd = tags.get("start_date", "")
            m = re.search(r"(19|20)\d{2}", sd)
            if m:
                py = int(m.group())
            yield NormalizedRecord(
                source=self.name,
                lat=lat, lng=lng,
                species_latin=tags.get("species") or tags.get("genus") or None,
                species_de=tags.get("species:de") or None,
                neighborhood=None,
                planting_year=py,
                external_ref=str(el.get("id")),
            )
            count += 1
            if limit and count >= limit:
                break
        print(f"  [OSM] fetched {count} trees")
