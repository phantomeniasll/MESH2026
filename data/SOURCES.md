# BeTree / VEGA — Tree Data Sources

All tree data loaded into the VEGA database is aggregated from the sources below.
Fields marked **estimated** are computed deterministically from the tree ID (stable, reproducible).

## Sources

### 1. Karlsruhe Baumkataster (Official)
- **URL:** https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Baumkataster/FeatureServer/2
- **Portal:** https://transparenz.karlsruhe.de/dataset/fachplane-baumkataster  
- **License:** Datenlizenz Deutschland Namensnennung 2.0 (dl-de/by-2.0)
- **Format:** GeoJSON (paged ArcGIS FeatureServer)
- **Coverage:** ~88,634 municipal trees in Karlsruhe
- **Real fields:** `species_latin` (artlat), `species_de` (artdeut), `neighborhood` (stadtteil), lat/lng
- **Estimated fields:** `planting_year` (age), `moisture`, `heat` — source has none of these

### 2. OpenStreetMap Overpass API
- **URL:** https://overpass-api.de/api/interpreter (`natural=tree` nodes)
- **License:** Open Database License (ODbL) — © OpenStreetMap contributors
- **Coverage:** Germany-wide (used for Karlsruhe enrichment + broader Germany bonus trees)
- **Real fields:** lat/lng, `species_latin` (species/genus tag), `planting_year` (start_date tag, where present)
- **Estimated fields:** `planting_year` where `start_date` absent, `moisture`, `heat`

### 3. IOER FDZ — Harmonized Tree Cadastre Germany 2024 (optional, manual drop)
- **DOI:** 10.71830/UCWQG0  
- **URL:** https://data.fdz.ioer.de/dataset.xhtml?persistentId=doi:10.71830/UCWQG0
- **License:** Creative Commons Attribution 4.0 (CC BY 4.0)
- **Access:** Access-gated (requires registration). Drop CSV files into `backend/data/drop/ioer_*.csv`.
- **Coverage:** 20 German cities including Karlsruhe, with planting year, species, height, crown diameter
- **Real fields:** all fields including `planting_year` (Pflanzjahr)
- **Format:** CSV per city, named `ioer_<city>.csv`

### 4. Berlin Straßenbäume / Frankfurt Baumkataster (optional, manual drop)
- **Berlin:** https://daten.berlin.de/datensaetze/baumbestand-berlin-wfs (WFS/CSV)
- **Frankfurt:** City open data portal  
- **License:** CC BY 4.0
- **Access:** Freely downloadable. Drop into `backend/data/drop/berlin_*.csv` or `frankfurt_*.csv`.
- **Real fields:** planting year (`pflanzjahr`), species, neighborhood
- **Estimated fields:** `moisture`, `heat`

## Estimation methodology

For trees without a real planting year, `planting_year` is estimated deterministically:
- Seeded by `hash(tree_id)`, band 1980–2018, nudged by species growth rate
- `age_estimated = true` is stored on the DB row to distinguish real vs. estimated ages

Moisture and heat for all unsensored trees are always deterministic estimates:
- `moisture = 5 + hash(id) * 60` → range [5, 65]
- `heat = (100 - moisture) * 0.6 + hash(id) * 40` → range [0, 100]
- Formula mirrors the original 300-tree mock so the visual distribution is preserved

Real sensor readings always override estimated values for sensored trees.

## Attribution requirements

When displaying data derived from these sources, attribute as follows:
- Karlsruhe data: "Baumkataster Stadt Karlsruhe, dl-de/by-2.0"
- OSM data: "© OpenStreetMap contributors, ODbL"
- IOER data (if used): "Harmonized tree cadastre dataset, IOER FDZ, CC BY 4.0"
