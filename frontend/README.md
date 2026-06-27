# 🌳 BeTree — Citizen App (Frontend)

Mobile-first **PWA** that lets anyone find a thirsty street tree, water it, and earn
sensor-verified city rewards. Part of the [BeTree](../README.md) project · HackXplore 2026.

Built with **Next.js 16 · React 19 · TypeScript · Tailwind 4 · MapLibre GL**.

---

## What it does

| Surface | What the user sees |
|---------|--------------------|
| **Map** | Full-screen MapLibre map of **126k** real Karlsruhe trees, coloured by thirst. Overlay toggle: soil-moisture vs urban-heat. "Locate me" + nearest-rescue routing. |
| **Tree detail** | Species, age, last watered, a 7-day **moisture forecast strip**, and a soil-water visualization. |
| **Scan & Verify** | QR scan / NFC tap to start a watering session. A live moisture chart climbs as the **real sensor** reports — cross the threshold → confetti. Rain or a fake tap → rejected, with a reason. |
| **Rewards** | Spend earned credits on seed packets, museum entry, transit day-passes, priority Bürgeramt slots. |
| **Impact** | Personal + citywide stats: trees watered, litres delivered, CO₂ proxy, streaks. |
| **City** | Officials' dashboard — health overview, heatmaps, watering routes (`/city`). |

State lives in a small **Zustand** store ([`src/store/useBetreeStore.ts`](src/store/useBetreeStore.ts));
data comes from the FastAPI backend via typed clients in [`src/lib/api`](src/lib/api).

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Point it at a backend:

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000   # defaults to this if unset
```

```bash
npm run build && npm run start   # production
npm run lint                     # eslint
```

## Project structure

```
src/
├── app/                 # Next.js app router
│   ├── (tabs)/          # citizen tabs: map · rewards · impact · profile
│   └── city/            # city officials' dashboard
├── components/          # map · scan · tree · city · rewards · nav · ui
├── lib/
│   ├── api/             # typed fetch clients (trees, sensors, city, rewards…)
│   ├── routing/         # nearest-tree routing helpers
│   ├── heatmap.ts       # overlay heatmap generation
│   └── constants.ts     # thresholds, demo config, Karlsruhe geo
└── store/               # Zustand global store
```

## Key dependencies

`maplibre-gl` + `react-map-gl` (vector map) · `@turf/turf` (geospatial) ·
`@yudiel/react-qr-scanner` + `qrcode` (scan/verify) · `motion` (animation) ·
`zustand` (state) · `vaul` + `sonner` (sheets & toasts) · `next-themes` (dark mode).

See the [root README](../README.md) for the full product story and architecture.
