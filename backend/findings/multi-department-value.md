# Multi-Department Value Analysis — One Sensor Box, Five Ämter

**Date:** June 27, 2026
**Context:** The BeTree sensor box is not just a tree moisture monitor. The accelerometer, microphone, temperature, and humidity sensors produce data that serves departments across the city administration. One deployment, five use cases, zero additional hardware cost.

---

## The Hardware

Each ground-stake sensor contains:

| Sensor | What it measures | Data produced |
|--------|-----------------|---------------|
| Capacitive soil moisture | Root-zone water content | Moisture % every 15 min |
| DHT11 temperature/humidity | Air temp + relative humidity at tree level | °C, %RH every 15 min |
| MPU6050 accelerometer | Ground vibration (footsteps) + tilt | Footstep count per interval, lean angle |
| Analog electret microphone | Ambient sound pressure level | Peak-to-peak amplitude, mapped to 0-100% |

All transmitted via LoRaWAN (roadmap) or WiFi/ESP-NOW (hackathon demo). Stored in the same `readings` table. Available via the same API.

---

## Department-by-Department Value

### 1. Grünflächenamt (Parks & Green Spaces)

**What they get:** Soil moisture per tree. Tree health status (healthy/stressed/critical). Automated alerts. Watering route optimization.

**Question they can now answer:** "Which of our 50,000 trees need water right now — not which ones are on today's schedule?"

**Before BeTree:** Water on fixed schedule. Visual drive-by inspection. Citizen complaints.

**After BeTree:** Real-time moisture data per tree. Only dispatch trucks to trees that need water. Citizen watering tracked and rewarded.

**Cost impact:** ~€500k-1M/year watering budget optimization. Avoided tree replacement costs (€300-1,500 per tree planted, plus 3-5 year establishment watering ~€1,000/tree).

**Source of cost figures:** Baumspezialist Karlsruhe price list, Baupreise 2026 (DIN 276), Stadt Karlsruhe GRDrs 396/2013, Stadt Karlsruhe Baumschutzverordnung. See `findings/tree-costs-sourced.md` for full sourcing.

---

### 2. Stadtplanungsamt (Urban Planning)

**What they get:** Footfall data. Per-street pedestrian counts. Before/after comparisons for infrastructure changes.

**Question they can now answer:** "We pedestrianized Kaiserstraße in 2025. Did foot traffic increase? In which sections? At what times of day?"

**Before BeTree:** Manual pedestrian counts (expensive, one-off studies). No continuous data. No before/after baseline for most streets.

**After BeTree:** Continuous footfall data from every tree sensor on every street. Granular: per 15-minute interval. Historical: baseline exists before any intervention.

**Concrete example:** "Before pedestrianization, Kaiserstraße plane trees registered 3,200 steps/day. After: 8,700 steps/day. Peak: 12,000 on Saturdays. The investment paid off."

**Additional use:** Identify pedestrian desire lines — where do people actually walk vs. planned paths? Plan new benches, lighting, crossings at actual high-traffic points.

---

### 3. Umweltamt (Environmental Protection)

**What they get:** Noise level map. Temperature microclimate data. Humidity data. Carbon capture estimates.

**Question they can now answer:** "We introduced Tempo 30 on the B36. Did it reduce noise in adjacent residential streets? By how many decibels?"

**Before BeTree:** One DWD weather station (airport). One-off noise measurement campaigns. No continuous microclimate data. No per-street temperature data.

**After BeTree:** 50,000 distributed noise sensors. 50,000 distributed temperature sensors. Real data on urban heat island effect per street. Noise maps updated in real time, not every 5 years.

**Concrete example:** "Südstadt-Ost is 4.8°C hotter than Weststadt on summer afternoons. This correlates with 60% less tree canopy cover. Priority planting zone identified."

**Carbon data:** Per-tree CO2 sequestration estimates based on species + trunk diameter (from OSM). City can quantify carbon capture for EU climate reporting.

---

### 4. Gesundheitsamt (Public Health)

**What they get:** Heat vulnerability mapping. Noise pollution correlation with health outcomes.

**Question they can now answer:** "During the last heat wave, which neighborhoods exceeded 35°C at street level? Where should we open cooling centers?"

**Before BeTree:** Airport temperature only. No street-level data. Heat warnings are city-wide, not neighborhood-specific.

**After BeTree:** Per-street temperature data. Identify heat islands in real time. Target cooling center placement. Warn vulnerable populations (elderly, children) before heat peaks.

**Concrete example:** "In the July 2025 heat wave, Oststadt street-level temperatures reached 41°C while the airport station reported 36°C. Three neighborhoods exceeded 38°C for 6+ hours. Cooling centers opened in those neighborhoods first."

---

### 5. Tiefbauamt / Versorger (Civil Engineering & Utilities)

**What they get:** Tree lean/tilt data (storm damage early warning). Root zone moisture (predicts root intrusion into pipes).

**Question they can now answer:** "After last night's storm, which trees are leaning more than 2° and need inspection before they fall on power lines?"

**Before BeTree:** Reactive. Tree falls → emergency crews dispatched. Root intrusion into sewer pipes discovered when pipe bursts.

**After BeTree:** Tilt sensors trigger inspection before failure. Moisture data near pipes predicts root growth direction.

---

## The Economic Argument

One sensor box costs ~€24 at scale (see `findings/power-budget.md` BOM). It produces data for five departments. If each department funded even a fraction:

| Department | Willingness to pay per sensor? | Rationale |
|-----------|-------------------------------|-----------|
| Grünflächenamt | €15 | Replaces manual inspections + watering optimization |
| Stadtplanung | €5 | Replaces pedestrian counting studies |
| Umweltamt | €5 | Replaces noise measurement campaigns |
| Gesundheitsamt | €3 | Heat island data for public health |
| Tiefbauamt | €2 | Storm damage early warning |
| **Total** | **€30** | **More than covers the sensor cost** |

The sensor pays for itself through departmental cost sharing before a single tree is saved.

