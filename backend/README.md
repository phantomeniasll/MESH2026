# VEGA — Sensor of Infinite Jest 🌳

[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![HackXplore 2026](https://img.shields.io/badge/HackXplore-2026-orange.svg)](https://hackxplore.de)

> *"To be tree, or not to be tree — that is the question."*

**Smart tree monitoring with citizen gamification.** Built for HackXplore 2026 by team **be tree**.

## What is VEGA?

VEGA is a platform that turns urban trees into connected community assets:

- **LoRaWAN sensors** measure soil moisture, temperature, and foot traffic
- **NFC tags** let citizens tap-to-water and earn points
- **Gamification** drives engagement: streaks, badges, neighborhood leaderboards
- **City dashboard** gives officials real-time tree health and footfall heat maps
- **Reward economy** lets citizens exchange points for city services

## Architecture

```
┌─────────────┐    LoRaWAN     ┌──────────┐    MQTT     ┌───────────┐
│  ESP32 Box  │──────────────▶│ TTN / TTI │──────────▶│   VEGA    │
│  sensors    │                │ Gateway   │            │  FastAPI  │
│  NFC tag    │                └──────────┘            │  Server   │
└─────────────┘                                         └─────┬─────┘
                                                              │
                      ┌───────────────────────────────────────┤
                      ▼                       ▼               ▼
              ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
              │   SQLite DB  │   │City Dashboard│   │ Citizen App  │
              │   (→PG later)│   │  (officials) │   │   (PWA)      │
              └──────────────┘   └──────────────┘   └──────────────┘
```

## Quick Start

```bash
# Clone and set up
git clone https://github.com/be-tree/vega.git
cd vega

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install
pip install -e ".[dev]"

# Configure
cp .env.example .env
# Edit .env with your settings

# Run
vega
# or: uvicorn vega.main:app --reload

# Test
pytest
```

## API at a Glance

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /api/sensors/ingest` | LoRaWAN data ingestion |
| `GET /api/trees` | List all trees |
| `POST /api/trees` | Register a tree |
| `POST /api/citizens/water` | Log a watering (NFC tap) |
| `GET /api/citizens/leaderboard` | Points leaderboard |
| `GET /api/dashboard/overview` | City-wide tree health |
| `GET /api/dashboard/map` | GeoJSON tree map |
| `GET /api/gamification/points/{id}` | User points & badges |
| `GET /api/gamification/streak/{id}` | User streak status |
| `GET /api/rewards` | Available rewards |
| `POST /api/rewards/redeem` | Redeem points for reward |

## Project Structure

```
src/
├── vega/               # Main package
│   ├── main.py         # FastAPI app + entrypoint
│   ├── config.py       # pydantic-settings
│   ├── database.py     # Async SQLAlchemy + SQLite
│   ├── models/         # ORM: Tree, Reading, Watering, User, Reward
│   ├── routes/         # Endpoints: sensors, trees, citizens, dashboard, gamification, rewards
│   ├── services/       # Business logic: points, MQTT, LoRaWAN decoder, footfall
│   └── schemas/        # Pydantic request/response types
└── tests/              # pytest + httpx
    ├── conftest.py
    ├── test_health.py
    └── test_models/
```

## Roadmap

- [x] FastAPI scaffold with SQLite
- [x] Sensor ingestion endpoint
- [x] Citizen watering + points
- [x] Gamification: points, streaks, badges
- [x] City dashboard overview + map
- [x] Reward economy
- [ ] TTN MQTT live integration
- [ ] Citizen PWA frontend
- [ ] ESP32 firmware (Arduino / MicroPython)
- [ ] Postgres + PostGIS migration
- [ ] Solar + battery zero-infrastructure deployment
- [ ] Digital twin overlay (Cesium/MapLibre)

## Team

**be tree** — HackXplore 2026, Karlsruhe

## License

MIT — see [LICENSE](LICENSE)
