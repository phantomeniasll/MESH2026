# VEGA — Sensor of Infinite Jest 🌳

[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)
[![HackXplore 2026](https://img.shields.io/badge/HackXplore-2026-orange.svg)](https://hackxplore.de)

> *"To be tree, or not to be tree — that is the question."*

**VEGA** is the backend of [BeTree](../README.md): the API, data model, and water-stress
model that turn urban trees into connected community assets. Built for HackXplore 2026
by team **be tree**.

## What VEGA does

- **Ingests sensor data** from ESP32 mesh nodes (ESP-NOW → WiFi gateway → HTTPS)
- **Models water stress** with a FAO-56 soil-water balance coupled to free Open-Meteo /
  DWD weather — reading **root-zone depth**, so sparse sensors cover every tree
- **Verifies waterings** against a real moisture rise + rainfall cross-check ("Proof of Care")
- **Runs the gamification & reward economy** — points, streaks, levels, redeemable city perks
- **Serves the city dashboard** — health, footfall heatmaps, watering routes

## Architecture

```
┌──────────────┐  ESP-NOW   ┌──────────────┐  HTTPS   ┌────────────────────────┐
│  Sprig node  │──────────▶│ Gateway node │────────▶│  VEGA · FastAPI         │
│ soil·temp·   │  (mesh,    │ ESP-NOW↔WiFi │ /ingest  │                        │
│ shock·mic    │ deep-sleep)└──────────────┘          │  ┌──────────────────┐  │
└──────────────┘                                      │  │ async SQLAlchemy │  │
                                                      │  │   SQLite (→PG)   │  │
   Open-Meteo / DWD ICON-D2 ──────────────────────────▶ │ water_balance.py │  │
   (ET₀, rain, deep soil moisture)                    │  └──────────────────┘  │
                                                      └───────────┬────────────┘
                          ┌─────────────────────────────────────┤
                          ▼                  ▼                   ▼
                  City Dashboard      Citizen PWA          /docs (OpenAPI)
```

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

vega                       # or: uvicorn vega.main:app --reload
#   → http://localhost:8000   ·   interactive docs at /docs

pytest                     # tests
ruff check src/            # lint
mypy src/vega/             # types
```

The app auto-creates the SQLite schema on startup. Use [`seed.py`](src/vega/seed.py) /
[`seed_readings.py`](src/vega/seed_readings.py) to load demo trees and a synthetic
sensor history, or [`scripts/forecast_demo.py`](scripts/forecast_demo.py) to render a
forecast chart.

## API at a glance

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /api/sensors/ingest` | Sensor uplink ingestion (from the gateway node) |
| `GET /api/sensors/tree/{id}/readings` | Recent readings time-series |
| `GET /api/trees` · `GET /api/trees/{id}` | List / fetch trees |
| `GET /api/trees/{id}/forecast` | 7-day moisture forecast (water-balance model) |
| `GET /api/trees/rescue` | Nearest critical trees ("rescue queue") |
| `GET /api/trees/by-nfc/{tag}` | Resolve a tree from an NFC/QR tag |
| `POST /api/citizens/water` | Log a verified watering (awards points) |
| `GET /api/citizens/leaderboard` | Points leaderboard |
| `GET /api/dashboard/overview` · `/map` · `/activity` · `/carbon` | City aggregates |
| `GET /api/city/...` | City-officials views |
| `GET /api/rewards` · `POST /api/rewards/redeem` | Reward catalogue & redemption |

Full, always-current schema at **`/docs`** (Swagger) when the server is running.

## The water-stress model

A capacitive probe only reads the surface; a tree drinks from the **root zone**. So VEGA
runs a small **FAO-56 single-bucket soil-water balance** ([`services/water_balance.py`](src/vega/services/water_balance.py))
driven by **Open-Meteo / DWD ICON-D2** weather ([`services/weather.py`](src/vega/services/weather.py)):

- **Loss** = reference evapotranspiration (ET₀) × crop coefficient (per genus) × stress factor
- **Gain** = effective rainfall (throughfall) + citizen irrigation
- **Anchor** = a real sensor reading where one exists; otherwise the model's own deep-soil
  prior from Open-Meteo (`soil_moisture_3_to_9cm`, `9_to_27cm`)

This is **physics-shaped, calibrates as sensors deploy** — the constants are honest
estimates, not a trained accuracy claim. See [`../PREDICTION_MODEL_PLAN.md`](../PREDICTION_MODEL_PLAN.md)
for the full calibration & scaling design.

## Project structure

```
src/vega/
├── main.py            # FastAPI app + entrypoint
├── config.py          # pydantic-settings
├── database.py        # async SQLAlchemy + SQLite
├── models/            # ORM: tree, reading, watering, user, reward
├── routes/            # sensors, trees, citizens, dashboard, city, map, gamification, rewards
├── services/          # water_balance, weather, points, footfall, lorawan, mqtt
├── schemas/           # Pydantic request/response types
├── seed.py            # demo trees + map snapshot
└── seed_readings.py   # synthetic sensor history
esp32/                 # Wurzelwerk firmware — dual-node ESP-NOW mesh (PlatformIO)
tests/                 # pytest: health, models, routes (city), services (water_balance)
```

## Roadmap

- [x] FastAPI + async SQLite, sensor ingest, tree CRUD
- [x] Citizen watering + points, streaks, levels
- [x] City dashboard (overview, map, activity, carbon)
- [x] Reward economy
- [x] **FAO-56 water-balance + Open-Meteo weather model**
- [ ] Server-side watering verification (anti-gaming P4) — enforce moisture-rise + rain check
- [ ] Calibrate model on real sensor history (replace eyeballed constants)
- [ ] LoRaWAN / TTN uplink path (decoder stub in `services/lorawan.py`)
- [ ] Postgres + PostGIS (spatial "trees within 500 m")
- [ ] ML residual-correction layer (LightGBM)

## Team & License

**be tree** — HackXplore 2026, Karlsruhe. MIT licensed.
