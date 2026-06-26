# VEGA Challenge — Battle Plan

> **Hackathon:** HackXplore 2026, June 26-28, 36h
> **Challenge:** Smart Watering for Urban Trees
> **Hardware:** ESP32 + capacitive soil moisture sensor (provided)
> **Stack:** ESP32 (Arduino/C++) → MQTT → Python backend → Web dashboard + Telegram bot

---

## Architecture (Decide NOW)

```
[ESP32 + soil sensor] ──WiFi/MQTT──> [Mosquitto broker] ──> [Python backend]
                                                                │
                                                    ┌───────────┴───────────┐
                                                    │                       │
                                              [Web Dashboard]        [Telegram Bot]
                                              (municipal view)       (citizen alerts)
```

### Why this stack
- **MQTT** — native to ESP32, lightweight, one broker handles all sensors
- **Python backend** — FastAPI, you know it, Hermes knows it
- **Web dashboard** — single HTML file + Chart.js, no framework needed
- **Telegram bot** — already have the bot token, citizens can subscribe

### Alternatives to consider
- **Blynk/ThingsBoard** — faster ESP32→dashboard but less customizability
- **WebSockets** instead of MQTT — simpler but less IoT-idiomatic

---

## Pre-Flight Setup (Do BEFORE the event, ~30 min)

### 1. ESP32 toolchain
```bash
# Install Arduino CLI or PlatformIO
# Have the blink example compiling before you arrive
arduino-cli core install esp32:esp32
```
- [ ] ESP32 blinks an LED — verify toolchain works
- [ ] Capacitive soil sensor reads values — verify wiring

### 2. Local dev environment
```bash
mkdir ~/hackxplore-vega && cd ~/hackxplore-vega
python3 -m venv venv && source venv/bin/activate
pip install fastapi uvicorn paho-mqtt pandas
```
- [ ] `main.py` serves "Hello HackXplore" on localhost:8000

### 3. Boilerplate files to pre-create
- `esp32/sensor.ino` — reads sensor, publishes to MQTT
- `backend/main.py` — FastAPI app skeleton
- `backend/mqtt_handler.py` — subscribes to MQTT, stores readings
- `dashboard/index.html` — empty Chart.js page
- `bot/bot.py` — Telegram bot skeleton

### 4. MQTT broker
- [ ] Know how to spin up Mosquitto locally: `mosquitto -d` or `docker run eclipse-mosquitto`
- [ ] Test: publish a fake reading, see it in Python subscriber

---

## 36-Hour Timeline

### HOUR 0-3: Foundation (Friday evening)
**Goal:** Sensor data flowing end-to-end

- [ ] Wire ESP32 + sensor, verify readings in serial monitor
- [ ] ESP32 publishes `{"tree_id": "linden_01", "moisture": 342, "timestamp": "..."}` to MQTT
- [ ] Python backend receives MQTT messages, stores in dict
- [ ] GET `/api/trees` returns current readings
- [ ] **MILESTONE: Data pipeline works**

### HOUR 3-8: Dashboard (Friday night)
**Goal:** Municipal dashboard showing real data

- [ ] Single HTML page with a map/grid of trees
- [ ] Each tree shows: name, location, moisture %, status (🟢 ok / 🟡 dry / 🔴 critical)
- [ ] Auto-refreshes from `/api/trees` every 5 seconds
- [ ] Mock data for 10 trees around the venue (use real street names: Roonstr., etc.)
- [ ] **MILESTONE: Dashboard looks real**

### HOUR 8-14: Citizen engagement (Saturday morning)
**Goal:** Citizens can help

- [ ] Telegram bot: `/subscribe` registers a citizen
- [ ] Bot sends alert when a nearby tree is dry: "🌳 The Linden on Roonstr. 23a needs water!"
- [ ] `/watered linden_01` marks tree as watered, resets moisture reading
- [ ] Leaderboard: who watered the most trees?
- [ ] Dashboard adds "citizen view" — simpler, mobile-friendly

### HOUR 14-20: Polish & smarts (Saturday afternoon/evening)
**Goal:** Looks professional

- [ ] Predictive watering: "This tree will be critical in ~6 hours at current rate"
- [ ] Historical chart per tree (moisture over last 24h)
- [ ] Municipal view: heat map of watering needs across the neighborhood
- [ ] Export: city can download a CSV of watering recommendations
- [ ] Nice CSS — dark theme, tree icons, clean typography

### HOUR 20-28: Sleep + buffer (Saturday night → Sunday morning)
- Sleep 4-5 hours. You need it for the pitch.
- Buffer for debugging hardware, edge cases

### HOUR 28-34: Pitch prep (Sunday)
**Goal:** 3-minute pitch that wins

- [ ] Pitch deck: 5-6 slides max
- [ ] Practice pitch 3x with timer
- [ ] Demo flow: show dashboard → simulate dry tree → Telegram alert → citizen waters → dashboard updates
- [ ] Prepare FAQ answers

### HOUR 34-36: Final polish + submission
- [ ] Code cleanup, README
- [ ] Kill any bugs found during pitch rehearsal
- [ ] Submit

---

## Pitch Structure (3 minutes)

```
SLIDE 1: THE PROBLEM (30 sec)
  "Karlsruhe spends [X] on tree irrigation. Nobody knows which trees need water."
  Photo of a dying urban tree. Stats on heat waves.

SLIDE 2: OUR SOLUTION (30 sec)
  "Smart sensors + citizen platform. Three user groups, one system."
  Architecture diagram. ESP32 in a tree.

SLIDE 3: THE TECH (45 sec)
  "ESP32 publishes moisture data via MQTT. Backend processes. Dashboard + Telegram."
  DEMO: Live dashboard with the sensor you brought.

SLIDE 4: CITIZEN ENGAGEMENT (45 sec)
  "Citizens get alerts. They water. The city saves money. Trees survive."
  DEMO: Telegram alert → citizen marks tree watered → dashboard updates.

SLIDE 5: IMPACT & ROADMAP (30 sec)
  "Scale to all of Karlsruhe. 50,000 trees. Open data for citizen science."
  Cost estimate per sensor. Integration with city GIS.
```

### FAQ prep
- **"How accurate is the sensor?"** — Capacitive, not resistive. ±3% after calibration. Good enough for "needs water / doesn't."
- **"How do you power the ESP32?"** — Deep sleep mode, 2x AA batteries last 6 months.
- **"What about vandalism?"** — Sensor is buried, ESP32 in a small weatherproof box on the trunk.
- **"How does this scale to 50,000 trees?"** — MQTT broker handles 10k+ concurrent connections. Dashboard paginates.

---

## What Makes This Win

1. **It WILL work.** Hardware is trivial, software is your wheelhouse. No "we couldn't get it working" excuses.
2. **Three distinct user groups** with real UX for each — hits "User-centricity" hard
3. **Live demo** with actual sensor data — dev/R&D jury can touch it
4. **Sustainability narrative** — Ministry patron is literally the Umweltministerium
5. **Scalable story** — "We started with 10 trees on Roonstr. Here's how it goes city-wide."

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| ESP32 won't connect to venue WiFi | Bring a travel router or phone hotspot as AP |
| Sensor breaks | Bring a potentiometer as fallback (mimics analog sensor) |
| MQTT broker issues | Fallback: ESP32 HTTP POST directly to backend |
| Dashboard doesn't refresh | Use simple `setInterval` polling, not WebSockets |
| Telegram API rate limit | Pre-generate alert templates, batch notifications |

---

## Packing List

- [ ] Laptop + charger
- [ ] USB-C cable for ESP32
- [ ] Breadboard + jumper wires (backup)
- [ ] Travel router or phone hotspot
- [ ] Power bank (for ESP32 demo)
- [ ] Small plant or pot of soil (for the live demo)
- [ ] Water bottle (to demonstrate sensor change live)

---

## Files to Pre-Create

```
~/hackxplore-vega/
├── esp32/
│   └── sensor.ino          # Reads sensor, MQTT publish
├── backend/
│   ├── main.py             # FastAPI app
│   ├── mqtt_handler.py     # MQTT subscriber
│   └── requirements.txt
├── dashboard/
│   └── index.html          # Municipal dashboard
├── bot/
│   └── bot.py              # Telegram citizen bot
└── README.md
```
