# VEGA Challenge — Idea Exploration & Creative Angles

> "Smart Watering for Urban Trees" — ESP32 + soil sensor provided
> **Pitch deadline:** Sunday 10:15. No working time after — pitches only.
> **This doc:** Explore every angle BEFORE locking into a build direction.

---

## 1. Core Data: What Can We Measure?

```
                         ┌─ Soil moisture (provided sensor)
                         │
    THE ESP32 ───────────┼─ Temperature / humidity (DHT22 — bring one?)
                         │
                         ├─ Light exposure (photoresistor — cheap)
                         │
                         ├─ Rainfall? (external API: OpenWeatherMap)
                         │
                         └─ "Was watered" event (citizen report via bot)
```

**Question:** Do we stick to just the provided sensor (safer, faster) or bring additional sensors for richer data?

**Answer:** Start with just moisture. If ahead of schedule, DHT22 is $2 and adds temperature context. But the core product doesn't need it.

---

## 2. Citizen Engagement: Beyond "Get Alert, Water Tree"

### The Obvious Layer
- Subscribe via Telegram bot: `/subscribe`
- Alert when nearby tree is dry: push notification with tree name + location
- Mark as watered: `/watered linden_01`
- Leaderboard: most trees watered this week

### The Interesting Layer
- **Tree Adoption** — "Adopt the Linden on Roonstr. 23a." You're responsible for it. You name it.
- **Watering Streaks** — "Julian has kept his tree alive for 47 days." Gamification.
- **Neighborhood Competition** — Südstadt vs. Oststadt: which neighborhood has the healthiest trees?
- **Tree Diary** — citizens upload photos of "their" tree over seasons. Community archive.
- **Watering Routes** — "3 trees near you need water. Here's a 12-minute walking route."
- **Event Mode** — heat wave incoming → mass alert: "10 trees in your area urgently need water"

### The Viral Layer
- **"I Watered This"** — shareable card: "I just watered the 140-year-old plane tree on Marktplatz. It's survived two world wars. Now it survived this summer too." → Instagram/Twitter.
- **Tree Stories** — each tree gets a small wiki: species, age, CO2 absorbed, history. Citizens contribute.
- **Tree Tinder** — swipe right to adopt. Silly but memorable.

### Which to build?
- **Hours 0-8:** Alerts + watered marking + leaderboard (MVP engagement)
- **Hours 8-14:** Adoption + watering routes (the differentiation)
- **Hours 14+:** One viral feature if time allows

---

## 3. Municipal Dashboard: What Does the City See?

### Obvious
- Map of all monitored trees with moisture status (🟢🟡🔴)
- Historical chart per tree
- Export CSV

### Interesting
- **Watering Optimization** — which trees need water NOW vs. can wait until next week?
- **Cost Calculator** — "Without sensors: city waters all trees on schedule. With sensors: only the ones that need it. Savings: X liters, Y euros."
- **Heat Map by Neighborhood** — where are trees dying fastest? Prioritize new plantings there.
- **Citizen Engagement Metrics** — how many citizens watered trees this month? Trends over time.
- **Predictive Alerts** — "Based on weather forecast, 15 trees will reach critical moisture in 48h. Recommended action: citizen alert or truck dispatch."
- **Tree Species Comparison** — which species handle drought best? Data-driven urban planning.

---

## 4. Technical Architecture: Options Beyond Basic MQTT

### Option A: Simple (recommended start)
```
ESP32 → MQTT → Python (FastAPI) → SQLite → Web Dashboard + Telegram Bot
```
- **Pro:** Fast to build, everything you know, 100% reliable
- **Con:** Conventional. Every team will do this.

### Option B: Edge Processing
```
ESP32 does local ML? → Only sends alerts, not raw data
```
- **Pro:** Cool technical flex for R&D jury
- **Con:** ESP32 TensorFlow Lite Micro is finicky. High risk.

### Option C: Mesh Network (LoRa?)
```
ESP32 + LoRa module → Gateway → Cloud
```
- **Pro:** "We don't need WiFi at every tree — mesh covers a whole park." Impressive to dev jury.
- **Con:** Do you have LoRa modules? Probably not. Skip.

### Option D: Digital Twin
```
Physical sensor → Digital twin of the urban canopy → Simulation
```
- **Pro:** "We can simulate a heat wave and see which trees die." Very R&D.
- **Con:** Simulation is complex. Only if you have time.

### Decision: Option A + sprinkle of Option D (simple prediction model)

---

## 5. Pitch Angles: Which Story Are You Telling?

### Angle A: "The Climate Story" 🌍
> "Karlsruhe lost 12% of its urban trees in the last heat wave. Our platform prevents the next one. This is climate adaptation you can touch."
- **Strength:** Emotional, timely, Ministry patron = Umwelt
- **Weakness:** Not differentiated from other sustainability pitches

### Angle B: "The Efficiency Story" 💰
> "The City of Karlsruhe spends X euros watering trees on a fixed schedule. With our sensors, they water only when needed. 40% less water, 60% less cost."
- **Strength:** Hard numbers, municipal procurement loves this
- **Weakness:** Needs real cost data you don't have

### Angle C: "The Community Story" 🫂
> "Trees aren't just infrastructure. They're the soul of a street. Our platform connects neighbors through the trees they share. The Linden on Roonstr. now has 23 people who care for it."
- **Strength:** Emotional, memorable, unique angle
- **Weakness:** Hard to quantify

### Angle D: "The Platform Story" 🏗️
> "We didn't build a watering app. We built an urban canopy operating system. Sensors today. Predictive models tomorrow. Open API for researchers. This is infrastructure."
- **Strength:** Ambitious, scalable, impresses dev jury
- **Weakness:** Risk of overpromising

### Recommendation: Lead with Angle C (community) + close with Angle D (platform). The emotional hook + the technical ambition.

---

## 6. Demo Design: What 3 Minutes Looks Like

### The Live Demo Arc
```
0:00-0:30   PROBLEM — Photo of dying tree. Heat wave stats.
0:30-1:00   SOLUTION — Architecture diagram. "ESP32 in this tree right now."
1:00-2:00   LIVE DEMO
              1. Show dashboard: 10 trees, 3 are red
              2. Pour water on your demo sensor
              3. Dashboard updates: tree goes green
              4. Telegram alert fires ON A JUDGE'S PHONE
              5. Judge marks tree watered — leaderboard updates
2:00-2:30   IMPACT — "10 trees today. 50,000 tomorrow. Open API."
2:30-3:00   ROADMAP + CLOSE — "This is how Karlsruhe becomes Europe's smartest green city."
```

### Demo Props
- **Small pot with soil + sensor** — pour water, moisture rises live
- **Second phone** showing Telegram bot receiving alert
- **Dashboard** on your laptop screen

### The "Oh Shit" Backup
If hardware fails: pre-recorded video of the demo. Not ideal, but better than standing there with dead hardware.

---

## 7. What Makes This DIFFERENT From Other Teams?

Every team will do: sensor → dashboard. That's table stakes.

**Your differentiators:**
1. **Citizen platform, not just city tool** — three user groups with real UX
2. **Tree adoption + social** — emotional connection, not just data
3. **Predictive layer** — "this tree will be critical in 6 hours" (even if simple linear regression)
4. **Live hardware demo** — actual sensor in soil, water poured on stage
5. **Real Karlsruhe street names** — Roonstr., Kaiserstr. — locals recognize them

---

## 8. Open Questions to Resolve On-Site

- [ ] Does the venue have WiFi for the ESP32? (Bring hotspot as backup)
- [ ] Can we use real Karlsruhe tree location data? (City might have open GIS data)
- [ ] Are there existing tree-watering citizen initiatives we can name-drop?
- [ ] What's the actual cost of municipal tree watering per year? (Find a stat to cite)
- [ ] Can we get a photo of a real dying tree in Karlsruhe for the pitch?

---

## 9. Pre-Build Checklist (Do BEFORE arrival)

```
[ ] ESP32 toolchain compiles blink example
[ ] Capacitive sensor reads values in serial monitor
[ ] MQTT broker runs locally
[ ] ESP32 → MQTT → Python subscriber works end-to-end
[ ] FastAPI skeleton running
[ ] Dashboard HTML skeleton with Chart.js
[ ] Telegram bot skeleton with /subscribe
[ ] OpenWeatherMap API key (for rainfall data)
[ ] Bring: potentiometer (sensor fallback), breadboard, jumper wires
[ ] Bring: travel router or phone hotspot
[ ] Bring: small plant pot + soil for demo
[ ] Bring: water bottle for demo
```
