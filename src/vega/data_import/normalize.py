import math
from collections.abc import Iterable

from .base import NormalizedRecord


def _grid_key(lat: float, lng: float, cell_m: float = 3.0) -> tuple:
    """Bucket lat/lng into ~cell_m meter grid cells."""
    lat_step = cell_m / 111_320
    lng_step = cell_m / (111_320 * math.cos(math.radians(lat)))
    return (round(lat / lat_step), round(lng / lng_step))


def dedup_and_merge(records: Iterable[NormalizedRecord]) -> list[NormalizedRecord]:
    """Deduplicate across sources; prefer records that carry real planting_year."""
    seen: dict[tuple, NormalizedRecord] = {}
    for r in records:
        k = _grid_key(r.lat, r.lng)
        if k not in seen:
            seen[k] = r
        else:
            existing = seen[k]
            # Merge: prefer real planting_year, then prefer karlsruhe species/neighborhood
            better_year = (r.planting_year is not None and existing.planting_year is None)
            better_species = (r.species_latin and not existing.species_latin and "karlsruhe" in r.source)
            if better_year or better_species:
                seen[k] = NormalizedRecord(
                    source=existing.source,
                    lat=existing.lat, lng=existing.lng,
                    species_latin=r.species_latin if better_species else existing.species_latin,
                    species_de=r.species_de if better_species else existing.species_de,
                    neighborhood=existing.neighborhood or r.neighborhood,
                    planting_year=r.planting_year if better_year else existing.planting_year,
                    external_ref=existing.external_ref,
                )
    return list(seen.values())


def assign_ids(records: list[NormalizedRecord], city_prefix: str = "KA") -> list[tuple[str, NormalizedRecord]]:
    """Sort deterministically and assign KA-##### ids."""
    # Multi-city: Karlsruhe → KA, Berlin → B, Frankfurt → F etc.
    # The city_prefix arg covers extension; for now everything is KA.
    sorted_recs = sorted(records, key=lambda r: (round(r.lat, 6), round(r.lng, 6), r.species_latin or ""))
    return [(f"{city_prefix}-{i+1:05d}", r) for i, r in enumerate(sorted_recs)]
