from collections.abc import Iterator

import httpx

from ..base import BBox, NormalizedRecord

BASE_URL = (
    "https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Baumkataster"
    "/FeatureServer/2/query"
)
FIELDS = "lfdbnr,artdeut,artlat,baumart_allgemein,baumgruppe,stadtteil"
PAGE = 1000


class KarlsruheArcGIS:
    name = "karlsruhe_arcgis"

    def fetch(self, bbox: BBox | None = None, limit: int | None = None) -> Iterator[NormalizedRecord]:
        offset = 0
        fetched = 0
        while True:
            params: dict[str, str | int] = {
                "where": "stadtteil IS NOT NULL",
                "outFields": FIELDS,
                "returnGeometry": "true",
                "f": "geojson",
                "resultOffset": offset,
                "resultRecordCount": PAGE,
            }
            if bbox:
                params["geometry"] = f"{bbox.min_lng},{bbox.min_lat},{bbox.max_lng},{bbox.max_lat}"
                params["geometryType"] = "esriGeometryEnvelope"
                params["spatialRel"] = "esriSpatialRelIntersects"
                params["inSR"] = "4326"
            try:
                r = httpx.get(BASE_URL, params=params, timeout=60.0)
                r.raise_for_status()
                data = r.json()
            except Exception as e:
                print(f"  [KarlsruheArcGIS] page error at offset {offset}: {e}")
                break

            features = data.get("features", [])
            for feat in features:
                props = feat.get("properties") or feat.get("attributes") or {}
                geom = feat.get("geometry", {})
                coords = geom.get("coordinates")
                if not coords or len(coords) < 2:
                    continue
                lng, lat = coords[0], coords[1]
                yield NormalizedRecord(
                    source=self.name,
                    lat=lat, lng=lng,
                    species_latin=props.get("artlat") or None,
                    species_de=props.get("artdeut") or None,
                    neighborhood=props.get("stadtteil") or None,
                    planting_year=None,
                    external_ref=str(props.get("lfdbnr", "")) or None,
                )
                fetched += 1
                if limit and fetched >= limit:
                    return

            if len(features) < PAGE:
                break  # short page = last page
            if len(features) == 0:
                break
            offset += len(features)
        print(f"  [KarlsruheArcGIS] fetched {fetched} trees")
