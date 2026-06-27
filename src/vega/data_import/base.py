from dataclasses import dataclass
from typing import Iterator, Protocol
from typing import NamedTuple


@dataclass(frozen=True)
class NormalizedRecord:
    source: str           # "karlsruhe_arcgis" | "osm" | "csv:berlin" | ...
    lat: float
    lng: float
    species_latin: str | None
    species_de: str | None
    neighborhood: str | None
    planting_year: int | None   # real year from source, else None
    external_ref: str | None    # lfdbnr, osm node id, etc.


class BBox(NamedTuple):
    min_lat: float
    min_lng: float
    max_lat: float
    max_lng: float


class SourceAdapter(Protocol):
    name: str

    def fetch(self, bbox: "BBox | None", limit: "int | None") -> Iterator[NormalizedRecord]: ...
