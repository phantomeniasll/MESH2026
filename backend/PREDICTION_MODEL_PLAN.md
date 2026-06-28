# BeTree / VEGA — Tree Water-Stress Prediction Model
### Full technical plan: from sensors + weather to per-tree forecasts

**Author:** Team Be Tree · **Date:** 2026-06-27
**Status:** Design — not yet implemented
**Scope:** Replace the naïve `moisture < 15 → critical` rule in `routes/sensors.py` with a real, weather-coupled predictive model that (a) now-casts moisture for *every* tree (sensored and unsensored), (b) forecasts days-to-critical, and (c) hardens the watering-verification logic against gaming.

---

## 0. Why this exists — the gap today

| Layer | What exists now | What's missing |
|-------|-----------------|----------------|
| Status | `routes/sensors.py`: `<15 critical, <25 stressed, else healthy` on the *latest raw reading* | No trend, no forecast, no weather. A tree that dries in 6 h still reads "healthy" until it's already critical. |
| Unsensored trees | `est_moisture`/`est_heat` = deterministic hash of tree id (`data/SOURCES.md`) | A *fake* number for ~88k trees. No physical basis. This is the single biggest credibility gap in the whole pitch. |
| Weather | None — no API, no key, no table | The entire "model covers every tree from a few hundred calibration nodes" claim has no engine behind it. |
| Verification | Frontend-only sim (`src/components/scan/VerifyView.tsx`): moisture-rise + citywide-rain block | Not enforced server-side; trivially spoofable by hitting `/api/sensors/ingest` or `/api/citizens/water`. |

**The thesis we must make real:** a few hundred sensored trees *ground-truth* a physical soil-water-balance model driven by free weather data; that calibrated model then predicts water stress for every tree in the cadastre. This is the "scales like software, sells like infrastructure" line — this document is how we earn it.

---

## 1. What "prediction" means here — four concrete targets

We are not building one model. We are building a **physical core + a thin learned correction layer** that serves four prediction products:

| # | Target | Horizon | Consumer | Output |
|---|--------|---------|----------|--------|
| **P1** | **Now-cast moisture** for unsensored trees | t = now | Citizen map color, city map | `moisture_pct ∈ [0,100]`, `confidence` |
| **P2** | **Moisture forecast** (sensored + unsensored) | +6h … +7d | "Tree will be dry Thursday" alerts | hourly `moisture_pct` curve + band |
| **P3** | **Days-to-critical** / **water-need** | derived from P2 | Watering route optimizer, push alerts | `hours_until_critical`, `liters_to_refill` |
| **P4** | **Watering verification** (anti-gaming) | event | Credit award decision | `verified: bool`, `reason`, `confidence` |

P1–P3 share one engine (Section 3–5). P4 is separate (Section 7).

---

## 2. Data inventory — exactly what we feed the model

### 2.1 Internal (already in `vega.db`)

**`trees`** (`models/tree.py`) — static per-tree context (features that don't change hourly):
- `species` (→ crop coefficient, rooting depth, drought tolerance class)
- `latitude`, `longitude` (→ which weather grid cell; sun exposure)
- `planting_year` + `age_estimated` (→ root volume, establishment-phase flag: age ≤ 5 = high risk)
- `neighborhood` (→ heat-island grouping, spatial smoothing)
- `liters_per_day` (existing crude demand estimate — use as a prior)
- `est_moisture`, `est_heat` (current fake values — **the thing we replace**)
- `device_eui` (NULL ⇒ unsensored ⇒ P1/P2 inferred, not measured)

**`readings`** (`models/reading.py`) — the ground-truth time series (1,749 rows on KA-00001 today; scales with deployment):
- `moisture` (0–100 VWC) — **the label** for calibration
- `temperature`, `humidity` — local microclimate (differs from grid weather → this *is* the heat-island signal)
- `footfall_count`, `tilt_angle`, `sound_level` — secondary (footfall = soil compaction proxy; tilt = storm; not core to water model but logged)
- `battery_voltage`, `rssi`, `snr` — health/QC (drop readings from a browning-out node)
- `recorded_at` — index for resampling

**`waterings`** (`models/watering.py`) — known water inputs:
- `estimated_liters`, `created_at`, `tree_id` — these are **known step-inputs** to the water balance. A verified watering is a +moisture impulse; the model must account for it so it doesn't mistake a watering for rain (and vice-versa).

### 2.2 External — weather (the missing half)

**Recommendation: [Open-Meteo](https://open-meteo.com)** — free, no API key, hourly, and crucially for Germany it wraps the **DWD ICON-D2** model (2 km grid over DE). It returns *exactly* the variables a soil-water-balance needs, including ones we'd otherwise have to compute ourselves:

| Open-Meteo variable | Use in model |
|----------------------|--------------|
| `et0_fao_evapotranspiration` | **Reference ET₀** (FAO-56) — the demand term. This is the single most important external input. |
| `precipitation`, `rain`, `showers` | Water input (+) and the **anti-gaming rain cross-check** for P4 |
| `temperature_2m`, `relative_humidity_2m` | Compare against on-tree DHT11 → heat-island delta per tree |
| `shortwave_radiation`, `cloud_cover` | Sun exposure → south-facing trees dry faster |
| `wind_speed_10m` | Evaporative demand |
| `soil_moisture_0_1cm … 27_81cm`, `soil_temperature_*` | **Free physics prior** for unsensored trees + a sanity anchor for the balance model |

- **Endpoints:** Forecast API (`/v1/forecast`, +16 d) for P2/P3; Historical/ERA5 (`/v1/archive`) for *training* the calibration layer on past dry-downs.
- **Caching:** Karlsruhe is one metro. Fetch **per neighborhood centroid** (or a coarse ~5 km grid), not per tree — ~5–15 grid points covers the whole city. One scheduled fetch/hour. Store in a new `weather_readings` table keyed by `(grid_cell, recorded_at)`.
- **Fallback:** DWD Open Data (OpenData CDC) directly if Open-Meteo rate-limits; same variables, more plumbing.

---

## 3. The core engine — a soil-water-balance model (white box)

Don't start with deep learning. Start with the **FAO-56 dual-source soil water balance**, the standard agronomic model. It's interpretable, needs almost no training data, and gives the city a defensible number. ML only *corrects* its residuals (Section 5).

### 3.1 State

Per tree, track **root-zone available water** `W(t)` in mm (or normalized 0–1), bounded by `[0, TAW]`:

```
TAW = (θ_fc − θ_wp) × Zr        # Total Available Water
  θ_fc  field capacity (soil-type dependent; default loam)
  θ_wp  wilting point
  Zr    rooting depth  ← f(species, age)   young tree = shallow = small TAW = dries fast
```

### 3.2 Update (hourly water balance)

```
W(t+1) = clamp( W(t) + P_eff(t) + I(t) − ETc(t) − DP(t),  0, TAW )

  P_eff  effective precipitation        ← Open-Meteo precipitation × canopy-throughfall factor
  I      irrigation (citizen watering)  ← waterings.estimated_liters / root-area  (KNOWN input)
  ETc    crop evapotranspiration        = ET0 × Kc × Ks
            ET0  ← Open-Meteo et0_fao_evapotranspiration
            Kc   crop coefficient       ← f(species, canopy size/age)
            Ks   water-stress coefficient = f(W/TAW)   (closes stomata when dry)
  DP     deep percolation               ← overflow above field capacity
```

### 3.3 Map state → the moisture % the sensor reads

The sensor reports surface-ish VWC, not root-zone mm. Learn a simple monotonic transfer `moisture_pct = g(W/TAW)` per soil class, fit on sensored trees (Section 5). This is what makes the physical state comparable to `readings.moisture`.

### 3.4 Why this is the right backbone

- **Generalizes with zero per-tree history.** Drive it with weather + species + age + soil → instant P1 for all 88k trees. No fake hashes.
- **Naturally consumes known waterings** as `I(t)` — solves the "is that rise rain or a citizen?" ambiguity.
- **Forecastable.** Feed the +16 d weather forecast → integrate forward → P2/P3 fall out directly (`hours_until W crosses W_crit`).
- **Defensible to a city.** "FAO-56, the UN agronomic standard, calibrated to your soil" beats "a neural net said so."

---

## 4. Calibration — how sensors ground-truth the model (the actual moat)

This is the step that turns "a few hundred nodes" into "every tree." Two nested fits:

1. **Global / per-soil-class parameters** (`θ_fc`, `θ_wp`, transfer `g`, throughfall, Kc curves): fit *once* by minimizing error between modeled `moisture_pct` and **measured `readings.moisture`** across *all* sensored trees, over historical weather (ERA5 archive). Classic parameter estimation (least-squares / `scipy.optimize`, or Bayesian for uncertainty).

2. **Per-tree bias/offset** for sensored trees: a tree in a paved pit dries faster than the species average. Learn a per-tree `(Kc_mult, Zr_mult)` or a residual offset. Unsensored trees inherit the **neighborhood-median** correction (spatial transfer) — this is exactly the "calibration nodes ground-truth the neighbors" mechanism.

**Confidence propagation:** distance (in feature + geographic space) from the nearest calibration sensor → `confidence` on P1/P2. The map can show solid color for sensored/near, hatched for far-extrapolated. Honest uncertainty is a *selling point* to a municipality.

---

## 5. The learned correction layer (grey box) — optional but high-value

Physics gets ~80%. A small model mops up the structured residual (heat-island effects, compaction from `footfall_count`, microclimate the grid misses).

- **Model:** gradient-boosted trees (LightGBM/XGBoost) or a small MLP predicting **residual = measured − physical** moisture, *not* moisture directly. Keeps the physical model in charge; the learner can't hallucinate without data.
- **Features:** physical-model state `W/TAW`; weather (ET₀, precip, radiation, wind, RH, temp); on-tree minus grid temp/RH delta; species (target-encoded), age, neighborhood; `footfall_count` rolling sum; hour-of-day, day-of-year (seasonality); recent moisture lags & rolling slope (for sensored trees).
- **Why residual-learning:** safe cold-start (residual→0 ⇒ falls back to pure physics for unsensored trees) and far better extrapolation than an end-to-end black box trained on 8 trees.

### 5.1 Sequence option (later)
Once readings are dense, an LSTM/Temporal-Fusion-Transformer over the multivariate series can do P2 directly. **Not for the hackathon** — too little data (1,749 rows, 1 tree). Keep it on the roadmap slide.

---

## 6. Prediction outputs — formal definitions

```
P1  now_moisture(tree)      = g(W_now/TAW) + residual_model(features_now)        [+ confidence]
P2  forecast_moisture(tree) = integrate balance over Open-Meteo +Nh forecast    [hourly + band]
P3  hours_to_critical(tree) = argmin_t { forecast_moisture(t) ≤ M_crit }
    liters_to_refill(tree)  = (TAW − W_now) × root_area / efficiency
P4  see Section 7
```
Thresholds: keep `M_crit`/`M_stress` configurable (start at the current 15/25 from `routes/sensors.py`, then re-tune against observed wilting/recovery).

---

## 7. Watering verification model (P4) — anti-gaming, server-side

Today this lives only in the frontend sim. **Move it server-side** so credits can't be minted by calling the API directly.

**Signal:** a real watering = sustained root-zone moisture *rise* shortly after the NFC/QR tap, beyond what weather explains.

```
verified =  Δmoisture ≥ MIN_RISE                              # sustained, not a single spike
        AND rise sustained over ≥ MIN_WINDOW (e.g. 2–3 readings)
        AND NOT raining_in_grid_cell(tree, tap_time ± window) # rain cross-check (Open-Meteo)
        AND rise > physical_model_expected_rise               # exceeds what ET0/weather predicts
        AND tap geo/time-plausible (one tree, rate-limited per user)
```

- For **unsensored** trees (no moisture stream): fall back to honor-system credit but flag `unverified` and weight points lower — the model still cross-checks rain and rate-limits.
- Persist verdict + `reason` on the `waterings` row (add `verified: bool`, `verify_confidence`, `verify_reason` columns). Mirrors `src/lib/constants.ts` (`MOISTURE_THRESHOLD`, `VERIFY_WINDOW_MS`) so frontend sim and backend truth agree.

---

## 8. System architecture — where this lives in `vega`

```
backend/src/vega/
  services/
    weather.py        NEW  Open-Meteo client + weather_readings cache (per grid cell)
    water_balance.py  NEW  FAO-56 state + hourly integrate(); pure functions, unit-tested
    calibration.py    NEW  fit global + per-tree params on readings × weather history
    predict.py        NEW  P1/P2/P3 — combines balance + residual model + confidence
    verify.py         NEW  P4 server-side watering verification
  models/
    weather_reading.py NEW  (grid_cell, vars…, recorded_at)
    tree.py            +pred_moisture, +pred_updated_at, +hours_to_critical, +confidence
    watering.py        +verified, +verify_confidence, +verify_reason
  routes/
    sensors.py         status now set from predict.py, not the <15/<25 rule
    dashboard.py       /api/dashboard/forecast, /predictions, /water-route
    citizens.py        watering credit gated by services/verify.py
  jobs/
    refresh.py        NEW  scheduled (APScheduler/cron): hourly weather pull → re-run
                           balance for all trees → write pred_* → fire alerts
```

**Cadence:** hourly batch job (weather is hourly; soil is slow — sub-hourly is wasteful). On each sensor ingest, also do a cheap incremental update for *that* tree so the map is fresh. Store predictions denormalized on `trees` so map/list reads stay O(1).

**Training/calibration:** offline script (`calibration.py` run as `python -m vega.calibration`), versioned params written to a `model_params` table or a JSON artifact; the live job just loads them.

---

## 9. Evaluation — how we prove it works

- **Baselines to beat:** (a) current `<15/<25` rule, (b) persistence ("moisture stays as last reading"), (c) pure climatology.
- **Backtest protocol:** time-series split (train on earlier weeks, test on later — *never* random split; leakage). Hold out **entire sensored trees** to honestly measure P1 transfer to unsensored trees (leave-one-tree-out).
- **Metrics:**
  - P1/P2 moisture: MAE / RMSE (% VWC); skill score vs. persistence.
  - P3 days-to-critical: lead-time error; **precision/recall on "tree went critical within 48 h"** (the alert that matters).
  - P4: precision/recall on a hand-labeled set of genuine vs. spoofed waterings; false-credit rate.
- **Calibration of uncertainty:** reliability diagram — does the stated `confidence` match observed error?
- **Target for demo credibility:** P2 RMSE < ~7% VWC at +24 h on held-out trees; P3 catches ≥80% of next-day critical events.

---

## 10. Cold-start & data-reality honesty

- Right now: **8 trees, 1,749 readings, all on KA-00001.** That is enough to *stand up the pipeline and demo the physics*, **not** enough to train the ML residual layer or claim accuracy numbers. Be explicit about this internally.
- Hackathon-honest framing: "The physical model runs today on real Karlsruhe weather for all 88k cadastre trees; the calibration tightens automatically as nodes deploy." That's true and impressive without overclaiming a trained net.
- Synthetic bootstrap (demo only): drive the balance model with the last 2 weeks of real Open-Meteo Karlsruhe history to generate plausible dry-down curves for the map, clearly labeled `modeled` vs `measured`. Replace the hash-based `est_moisture` (`data/SOURCES.md`) with this — it's the same effort and infinitely more defensible.

---

## 11. Phased roadmap

| Phase | Deliverable | Effort |
|-------|-------------|--------|
| **0 — Hackathon MVP** | `weather.py` (Open-Meteo, per-neighborhood) + `water_balance.py` (FAO-56 with literature defaults, no fit) + replace `est_moisture` with modeled now-cast + P3 days-to-critical on the map. Server-side P4 rain cross-check. | 1–2 days |
| **1 — Calibration** | `calibration.py` fits global soil params + per-tree offsets on `readings`×ERA5; confidence map; backtest harness. | post-event, days |
| **2 — Learned correction** | LightGBM residual model; footfall/heat-island features; reliability eval. | weeks (needs data) |
| **3 — Sequence + scale** | TFT/LSTM forecasting once readings are dense; watering-route optimizer (P3 → TSP); multi-city soil priors. | later |

---

## 12. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Too little real data to train ML | Lead with physics (needs ~no data); ML is additive, gated behind data volume. |
| Open-Meteo rate limits / outage | Cache per grid cell hourly; DWD Open Data fallback; model degrades to last-known weather, not to nothing. |
| Capacitive moisture sensors are noisy / un-calibrated in absolute VWC | Learn the transfer `g()` per node; use *relative* rise for P4; QC on `battery_voltage`/`rssi`. |
| Soil/species params unknown for KA | Start with loam + species lookup table; calibration corrects; expose assumptions in the dashboard. |
| Overclaiming accuracy in the pitch | Show `confidence`/hatching on the map; "calibrates as it scales" framing; never quote a trained-net number we can't back. |

---

## 13. Immediate next actions (Phase 0)

1. Add `services/weather.py` — Open-Meteo client, `weather_readings` table, hourly job for ~10 Karlsruhe grid points (forecast + 30-day archive).
2. Add `services/water_balance.py` — pure FAO-56 integrator + species/soil default tables; unit tests on a known dry-down.
3. Add `services/predict.py` — P1 now-cast + P3 hours-to-critical; write `pred_moisture`/`hours_to_critical`/`confidence` onto `trees`.
4. Swap `routes/sensors.py` status logic and `data/SOURCES.md` estimation to use `predict.py` instead of the hash/threshold.
5. Move verification server-side in `services/verify.py`; gate `routes/citizens.py` watering credit; add `verified` columns.
6. Expose `/api/dashboard/forecast` + `/api/trees/{id}/forecast`; wire the frontend map color + "dry by Thursday" badge.
```
