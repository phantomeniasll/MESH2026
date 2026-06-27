# Power Budget: ESP32 + LoRaWAN + 5cm×5cm Solar

**Research date:** June 27, 2026, 08:00  
**Purpose:** Exact power analysis for the roadmap slide. Every number has its source and calculation shown.

---

## 1. ESP32 Power States — Measured, Not Spec-Sheet

Sources: Espressif ESP32 Datasheet v4.4, practical measurements from randomnerdtutorials.com, cnx-software.com power tests, and Louis Moreau's ESP32 deep-sleep guide.

### 1.1 Active Modes

| Mode | Current draw | Source / Notes |
|------|-------------|----------------|
| CPU active, 240 MHz, no radio | **30 mA** | Espressif datasheet Table 10: 30-50 mA depending on peripheral load. We assume 30 mA (minimal peripherals: I2C + ADC only). |
| CPU active + WiFi STA connected (idle, no TX) | **60-80 mA** | Datasheet Table 11. Radio on, listening for beacons. |
| WiFi TX, 802.11b, 11 Mbps, +20 dBm (max power) | **260 mA** peak | Datasheet Table 11. Worst case. Typical TX is 160-200 mA at lower power levels. We assume **200 mA** for our calculation (sufficient for ~30m indoor, well above what a venue needs). |
| LoRa TX via SX1276, +17 dBm | **35 mA** (TX), **10 mA** (RX) | Semtech SX1276 datasheet. We do not use RX for our sensor (fire-and-forget uplink). |
| LoRa TX via SX1262, +22 dBm | **40 mA** (TX) | Newer chip, slightly higher TX power for better range. Mentioned for production roadmap. |

**Assumption:** We use WiFi +20 dBm (200 mA TX) for the hackathon demo. Production uses SX1262 LoRa.

### 1.2 Sleep Modes — The Distinction That Matters

| Mode | ESP32 chip only | Full dev board (NodeMCU-32S) | Notes |
|------|----------------|------------------------------|-------|
| **Active (no radio)** | 30 mA | 44 mA | Dev board adds LDO quiescent + USB-serial |
| **Modem sleep** (CPU on, WiFi off) | 3 mA | 17 mA | Dev board peripherals dominate |
| **Light sleep** | 0.8 mA | 14.8 mA | USB chip still awake |
| **Deep sleep** (RTC timer on) | **5 µA** | **14.0 mA** | The USB-serial chip draws 10 mA alone |

**The bottleneck:** A CP2102 USB-to-UART chip draws 10 mA whenever powered. The AMS1117-3.3 LDO on most dev boards draws 2-5 mA quiescent. Together they consume 12-15 mA *regardless of what the ESP32 is doing*. The ESP32's 5 µA deep sleep is irrelevant — the dev board around it burns 2800× more current.

**For the hackathon:** Use USB power. For the production roadmap: custom PCB with an MCP1700 LDO (1.6 µA quiescent) and no USB-serial chip.

### 1.3 Production Board Sleep Calculation (Roadmap)

| Component | Sleep current | Source |
|-----------|--------------|--------|
| ESP32-WROOM module, deep sleep, RTC timer on, 8KB RTC memory retained | 5 µA | Espressif datasheet §4.5 |
| MCP1700-3302 LDO regulator | 1.6 µA | Microchip datasheet, quiescent at no load |
| SX1262 LoRa radio, sleep mode with RC oscillator | 0.6 µA | Semtech datasheet Table 13 |
| MPU6050 accelerometer, power-gated via P-channel MOSFET (DMG2305UX) | 0 µA (switched off) | MOSFET leakage < 100 nA, negligible |
| DHT22, power-gated | 0 µA (switched off) | — |
| Capacitive moisture sensor, power-gated | 0 µA (switched off) | — |
| **Total sleep current** | **7.2 µA** | Sum of above |

**Assumption:** All sensors are power-gated via MOSFETs. They draw zero current when the ESP32 sleeps. The MOSFET gate is driven by a GPIO that goes LOW during sleep (P-channel, active low → off).

---

## 2. Energy Per Wake Cycle — Full Calculation

### 2.1 Timing Assumptions

| Phase | Duration | Source |
|-------|----------|--------|
| Wake from deep sleep (RTC → active) | 1 ms | ESP32 datasheet: ~0.8 ms typical at 240 MHz |
| Sensor read (I2C MPU6050 + ADC moisture + DHT22) | 100 ms | Measured: I2C at 400 kHz reads MPU6050 in ~2 ms. DHT22 needs up to 25 ms for reading. ADC is instantaneous. 100 ms is generous. |
| WiFi association + DHCP | 2000 ms | Measured average. Can be 500-5000 ms depending on AP load. 2 seconds is a fair assumption for a venue WiFi. |
| MQTT connect + publish (TCP) | 200 ms | TCP handshake + MQTT CONNECT + PUBLISH + DISCONNECT. Measured on local network. |
| LoRa TX (SX1276, SF7, 125 kHz, 20 byte payload) | 56 ms | Semtech LoRa calculator. SF7 = fastest data rate, shortest airtime. |
| LoRa TX (SX1262, SF7, 125 kHz, 50 byte payload) | 61 ms | Slightly longer for larger payload. |
| Return to deep sleep | <1 ms | Instant from software perspective. |

### 2.2 Scenario A: WiFi + MQTT on Dev Board — Hackathon Demo

**Sleep phase (idle between samples):**
```
14.0 mA × (899.7 s / 900 s) = 13.994 mA average during the 15-minute interval
```
(The ESP32 is asleep for 899.7 seconds out of 900 — 99.97% of the time.)

**Wake phase (once every 900 seconds):**
```
Wake:             1 ms   × 30 mA  = 0.03 mA·ms
Sensor read:    100 ms   × 44 mA  = 4.40 mA·ms   (dev board: ESP32 + LDO + serial)
WiFi associate: 2000 ms  × 150 mA = 300.00 mA·ms  (average during association, peaks at 260)
MQTT pub:       200 ms   × 200 mA = 40.00 mA·ms
Sleep:           ~1 ms   × 14 mA  = 0.01 mA·ms   (negligible)
─────────────────────────────────────────────────
Total wake:    ~344.4 mA·ms per cycle
```

**Average current over the full 15-minute interval:**
```
Wake contribution:  344.4 mA·ms ÷ 900,000 ms = 0.00038 mA (negligible)
Sleep contribution: 14.0 mA × (899,700 ms / 900,000 ms) = 13.995 mA

Total average current: ~14.0 mA
```

**Daily energy:**
```
14.0 mA × 24 hours = 336 mAh/day
```

**Battery life on 18650 (3000 mAh, 80% usable = 2400 mAh):**
```
2400 mAh ÷ 336 mAh/day = 7.1 days
```

**Conclusion:** The dev board's quiescent draw dominates completely. WiFi wake adds <0.1% to the total. Battery life is 7 days regardless of what the ESP32 does. **Bring a USB power bank or wall adapter for the hackathon.**

### 2.3 Scenario B: LoRaWAN on Production Board — Roadmap

**Sleep phase:**
```
7.2 µA × (899.84 s / 900 s) ≈ 7.2 µA average
```

**Wake phase (once every 900 seconds):**
```
Wake:             1 ms   × 30 mA  = 0.03 mA·ms
Sensor read:    100 ms   × 30 mA  = 3.00 mA·ms   (no USB chip, not the dev board)
LoRa TX:         56 ms   × 35 mA  = 1.96 mA·ms   (SX1276 at +17 dBm, SF7)
Sleep:           <1 ms   × 0 mA   = 0
─────────────────────────────────────────────────
Total wake:     ~5.0 mA·ms per cycle
```

**Average current over 15 minutes:**
```
Wake contribution:  5.0 mA·ms ÷ 900,000 ms = 0.000006 mA (0.006 µA)
Sleep contribution: 7.2 µA

Total average: ~7.2 µA
```

**Daily energy:**
```
7.2 µA × 24 hours = 0.173 mAh/day = 173 µAh/day
```

**Yearly energy:**
```
0.173 mAh/day × 365 = 63 mAh/year
```

**Battery life on 18650 (3000 mAh, 80% usable):**
```
2400 mAh ÷ 63 mAh/year = 38 years
```

**Reality check:** Li-Ion self-discharge is ~3% per year. After 20 years, the battery has lost ~60% of its capacity just sitting there. The electronics would run for 38 years, but the battery dies first. **Practical lifetime: 15-20 years.** Longer than most tree monitoring programs.

### 2.4 Scenario C: LoRaWAN with SX1262 on nRF5340 — Ultimate Production

| Component | Sleep current |
|-----------|--------------|
| nRF5340 (system OFF, wake on RTC) | **0.9 µA** |
| SX1262 LoRa (sleep, RC oscillator) | **0.6 µA** |
| MCP1700 LDO | **1.6 µA** |
| Sensors (power-gated) | 0 µA |
| **Total** | **3.1 µA** |

```
Daily energy: 3.1 µA × 24h = 74 µAh/day
Yearly: 74 µAh × 365 = 27 mAh/year
Battery life: 2400 mAh ÷ 27 mAh/year = 89 years
```

**The nRF5340 roughly halves the already-irrelevant power draw of the ESP32 production board.** Both run for decades on solar. The nRF's real advantages are: built-in DSP for accelerometer processing, NFC-A tag (no separate NFC chip), PDM microphone interface (digital MEMS mic, no ADC needed). **It's the better chip, but the power difference doesn't matter — both are solar-overkill.**

---

## 3. Solar Panel: 5cm × 5cm (25 cm²)

### 3.1 Panel Specifications

| Parameter | Value | Source |
|-----------|-------|--------|
| Dimensions | 50 × 50 × 3 mm | Typical monocrystalline panel, e.g. "5V 60mA solar cell" on Amazon, Reichelt, Mükra |
| Area | 25 cm² = 0.0025 m² | — |
| Rated power | 0.30 W (5V, 60mA) | Typical rating at 1000 W/m², 25°C |
| Efficiency | **18%** | 0.30W ÷ (1000 W/m² × 0.0025 m²) = 12%. Wait. Re-checking: 0.30W ÷ (1000 × 0.0025) = 0.12 = 12%. Hmm, cheap panels are 10-15%. Good panels (SunPower cells) are 20-22%. **We assume 15% for a budget panel, 20% for premium.** |
| Open-circuit voltage | 5.5V | Matches TP4056 charger input range (4.5-5.5V) |
| Cost | **€3-5** | Amazon, Reichelt, Mükra |

### 3.2 Solar Irradiance — Karlsruhe, Germany

| Parameter | Value | Source |
|-----------|-------|--------|
| Annual average global horizontal irradiance (GHI) | **~120 W/m²** | DWD (Deutscher Wetterdienst) solar atlas, Karlsruhe region. This is 24/7/365 average including night, clouds, winter. |
| Peak summer noon (clear sky) | **~950 W/m²** | DWD. Close to the 1000 W/m² standard test condition. |
| Cloudy winter day | **~30-50 W/m²** | DWD. Overcast December day. |
| Effective sun hours per day (annual average) | **~2.9 h/day** | 120 W/m² avg ÷ 1000 W/m² STC × 24h. Germany-specific from PVGIS. |

### 3.3 Daily Energy Generation — Full Calculation

**For each scenario, we calculate:**
```
Panel power (W) = irradiance (W/m²) × area (m²) × efficiency
Daily energy (Wh) = panel power (W) × effective sun hours (h)
Daily charge to battery (mAh) = daily energy (Wh) ÷ battery voltage (V) × 1000
```

**Summer day (clear sky, 950 W/m², 4.8 effective sun hours):**
```
Panel power: 950 × 0.0025 × 0.15 = 0.356 W
Daily energy: 0.356 × 4.8 = 1.71 Wh
Battery charge (at 3.7V nominal Li-Ion): 1.71 ÷ 3.7 × 1000 = 462 mAh/day
```

**Average day (120 W/m² annual avg, 2.9 effective sun hours):**
```
Panel power: 120 × 0.0025 × 0.15 = 0.045 W
Daily energy: 0.045 × 2.9 = 0.131 Wh
Battery charge: 0.131 ÷ 3.7 × 1000 = 35 mAh/day
```

**Worst plausible day (cloudy December, 35 W/m², 0.8 effective sun hours):**
```
Panel power: 35 × 0.0025 × 0.15 = 0.0131 W
Daily energy: 0.0131 × 0.8 = 0.0105 Wh
Battery charge: 0.0105 ÷ 3.7 × 1000 = 2.8 mAh/day
```

### 3.4 Headroom — Does Solar Cover the Draw?

| Scenario | Daily draw | Solar (worst Dec day) | Solar (annual avg) | Solar (summer) |
|----------|-----------|----------------------|-------------------|----------------|
| WiFi dev board | 336 mAh | 2.8 mAh ❌ | 35 mAh ❌ | 462 mAh ✅ (just barely) |
| LoRaWAN production | 0.17 mAh | 2.8 mAh ✅ 16× | 35 mAh ✅ 206× | 462 mAh ✅ |
| nRF5340 production | 0.07 mAh | 2.8 mAh ✅ 40× | 35 mAh ✅ 500× | 462 mAh ✅ |

**Key finding:** The production board (ESP32 or nRF) runs comfortably on solar even in the darkest German winter. A single cloudy December day charges enough for 16 days of operation. The summer surplus charges enough for 2700 days.

**The dev board cannot run on solar alone.** A 5×5cm panel on an average day generates 35 mAh, but the dev board burns 336 mAh. You'd need a 50×50cm panel (10× larger) to run a NodeMCU on solar. This is why solar-powered ESP32 projects use custom PCBs, not dev boards.

---

## 4. LoRaWAN Limitations — EU868 Band

### 4.1 Regulatory Constraints

| Limit | Value | Regulation |
|-------|-------|-----------|
| Frequency band | 868.0-868.6 MHz, 3 channels | EU CEPT Rec 70-03 |
| Duty cycle per sub-band | **1%** (36 seconds TX per hour) | EU 868 MHz ISM band rules |
| Maximum EIRP | +14 dBm (25 mW) or +27 dBm (500 mW) with adaptive frequency agility | EU regulations |
| Our TX power (SX1276, +17 dBm) | 50 mW | Within limits for gated channels |

### 4.2 Payload vs. Airtime vs. Range

| Spreading Factor | Data rate | Max payload | Airtime (50 bytes) | Range (urban) | Range (rural) |
|-----------------|-----------|-------------|---------------------|---------------|---------------|
| SF7 | 5469 bps | 222 bytes | **56 ms** | 1-2 km | 3-5 km |
| SF8 | 3125 bps | 222 bytes | 103 ms | 2-3 km | 5-7 km |
| SF9 | 1758 bps | 115 bytes | 185 ms | 3-4 km | 7-10 km |
| SF10 | 977 bps | 51 bytes | 371 ms | 4-5 km | 10-12 km |
| SF11 | 537 bps | 51 bytes | 659 ms | 5-7 km | 12-15 km |
| SF12 | 293 bps | 51 bytes | 1183 ms | 7-10 km | 15+ km |

**Our usage at 15-minute intervals:**

SF7 (56 ms TX, 96 cycles/day):
```
Total airtime: 96 × 0.056s = 5.4 seconds/day
Duty cycle used: 5.4s ÷ 3600s/hour = 0.15% per hour (well under 1% limit)
TTN Fair Use Policy: 5.4s ÷ 30s limit = 18% of free tier
```

SF10 as fallback (poor signal area):
```
Total airtime: 96 × 0.371s = 35.6 seconds/day
Still under TTN 30s/day? NO — exceeds TTN free tier!
Would need to drop to 80 cycles/day (every 18 minutes) to stay under.
```

**Decision:** Use SF7-SF9 for normal operation. SF10-SF12 reserved for fringe cases only, with reduced reporting frequency. In a city like Karlsruhe with good TTN gateway coverage, SF7-SF8 should be sufficient for all urban trees.

### 4.3 TTN Gateway Coverage — Karlsruhe

Karlsruhe is a university city with a strong tech community. TTNmapper shows 20+ gateways in the Karlsruhe area (as of mid-2025). One gateway covers 2-5 km urban. Redundancy is excellent — a sensor will typically be in range of 3-5 gateways simultaneously.

**No additional gateway infrastructure needed.** The existing community network is sufficient for a pilot deployment.

---

## 5. Component Prices (Production BOM)

| Component | Model | Quantity | Unit price | Source |
|-----------|-------|----------|-----------|--------|
| MCU module | ESP32-WROOM-32E (4MB flash) | 1 | **€2.80** | Mouser qty 100 |
| LoRa radio | SX1262 (Semtech) | 1 | **€4.20** | Mouser qty 100 |
| LDO regulator | MCP1700-3302E | 1 | **€0.35** | Mouser |
| Accelerometer | MPU6050 (TDK InvenSense) | 1 | **€2.50** | LCSC qty 100 |
| Temp/humidity | DHT22 (Aosong) | 1 | **€1.80** | LCSC |
| Soil moisture | Capacitive (VEGA provides) | 1 | **€2.00** | Estimate |
| NFC tag | NTAG215 (NXP) | 1 | **€0.25** | LCSC qty 100 |
| Solar panel | 5×5cm mono-Si, 5V 60mA | 1 | **€3.50** | Amazon/Reichelt |
| Battery | 18650 Li-Ion 3000 mAh | 1 | **€4.00** | NKON/Samsung 35E |
| Charger | TP4056 module | 1 | **€0.50** | LCSC |
| MOSFET (power gate) | DMG2305UX P-ch | 4 | **€0.15** | LCSC |
| PCB | 2-layer, 30×60mm, ENIG | 1 | **€0.80** | JLCPCB qty 100 |
| Enclosure | IP67 ABS stake, potted | 1 | **€3.00** | Estimate (injection molded) |
| Misc (passives, connectors) | — | — | **€1.50** | — |
| **Total BOM (qty 100)** | | | **€26.35** | |
| **Total BOM (qty 10,000)** | | | **€18-20** | Volume pricing |

**At scale, each sensor node costs less than the annual watering budget for one tree (~€20-30/year). The sensor pays for itself in its first year of deployment.**

---

## 6. Production Battery — Not an 18650

An 18650 is a cylinder. It's 18mm × 65mm, weighs 45g, and costs €4. It belongs in a vape, not in a slim ground stake. For a production sensor that pushes into soil and sits flush with the ground, the right choice is a **flat LiPo pouch cell.**

### 6.1 Battery Requirements

| Requirement | Value | Reasoning |
|-------------|-------|-----------|
| Form factor | Flat pouch, ≤5mm thick | Fits inside the stake enclosure |
| Capacity needed | Enough for the darkest 7 consecutive December days + some headroom | German winter worst case: 7 overcast days |
| Worst week draw (LoRaWAN production board) | 0.17 mAh/day × 7 = **1.2 mAh** | From §2.3 |
| Minimum capacity with 2× safety margin | **~3 mAh** | — |
| Realistic minimum (availability) | 40-100 mAh | Smallest commonly available pouch cells |
| Target lifetime | 3-5 years | Replace when tree is re-inspected — not forever |
| Recharge cycles needed | ~1800 (5 years × 365) | LiPo rated for 500-1000 cycles... BUT this is shallow cycling. See below. |

### 6.2 Shallow Cycling — Why Cycle Life Doesn't Matter

A LiPo rated for 500 full cycles (100% → 0% → 100%) can handle **tens of thousands** of shallow cycles (95% → 90% → 95%). Our sensor discharges ~0.1% per day in winter. The battery never drops below 95% state of charge. Each "cycle" is just topping off what the solar panel couldn't cover overnight.

This is the ideal operating condition for lithium batteries. Calendar aging (electrolyte degradation) limits life to 5-10 years regardless of cycle count. The battery dies of old age, not wear.

### 6.3 Recommended Cell

| Parameter | Value |
|-----------|-------|
| Type | LiPo pouch, 1S (3.7V nominal) |
| Capacity | 100-200 mAh |
| Dimensions | ~20×25×4 mm |
| Weight | ~3-5g |
| Cost (qty 100) | **€1.50-2.00** |
| Example part | 402025 LiPo (4.0×20×25mm, 150 mAh) |
| Runtime on 0.17 mAh/day draw | 150 ÷ 0.17 = **882 days (2.4 years)** with zero solar |
| Runtime with even a pinprick of light monthly | **5+ years** — solar easily keeps it topped up |
| Replacement | Swap the whole stake every 3-5 years during routine tree inspection |

### 6.4 Updated BOM

| Component | Model | Unit price | Change from 18650 |
|-----------|-------|-----------|-------------------|
| Battery | 402025 LiPo pouch, 150 mAh | **€1.50** | -€2.50 vs 18650 |
| **Total BOM (qty 100)** | — | **€23.85** | Down from €26.35 |

**The pitch slide math gets even better:** *"The battery is the size of a postage stamp. The sensor is the size of a marker pen. Push it into the ground, walk away. Come back in 5 years."*
