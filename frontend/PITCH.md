# BeTree — 3-Minute Hackathon Pitch Deck
### HackXplore 2026 · Team Be Tree

---

## Timing guide
| Slide | Time | Cumulative |
|-------|------|-----------|
| 1 — Hook | 0:20 | 0:20 |
| 2 — Problem | 0:30 | 0:50 |
| 3 — Solution | 0:25 | 1:15 |
| 4 — Hardware | 0:30 | 1:45 |
| 5 — Citizen App | 0:25 | 2:10 |
| 6 — Proof of Care | 0:20 | 2:30 |
| 7 — The Reward Loop | 0:15 | 2:45 |
| 8 — City Value | 0:10 | 2:55 |
| 9 — Ask / Close | 0:05 | 3:00 |

---

## Slide 1 — Hook (0:20)
**Visual:** Full-screen heat map of a city block. Red blobs pulse on dying trees. One tree in the centre is greying out.

**Title on slide:** *"Every year, a city loses millions in trees that could have been saved with a glass of water."*

### What to say
- "Imagine walking past this tree every day. It looks fine. But 20 cm below the soil — it's bone dry."
- "It will be dead in two weeks. And the city will pay €10,000 to dig it up and replant it."
- "We built BeTree so that never happens again."

---

## Slide 2 — The Problem (0:30)
**Visual:** Split: city worker with clipboard vs. cracked dry soil close-up.

**Title on slide:** *"Cities can't see their trees dying — and can't afford to fix it alone."*

### Bullet points on slide
- German cities are **legally required** under the *Bundes-Klimaanpassungsgesetz* to measure and act on heat and drought
- Karlsruhe alone has **50,000 street trees** — a €1M/year watering budget — and zero per-tree data
- Young trees die in their **first 3–5 years** without supplemental water; replacement costs **€5,000–15,000** each
- Existing apps? Weather-model estimates. Citizen check-ins on the **honor system**. Nobody knows what's real.

### What to say
- "The law now says cities must measure climate risk and act on it. The mandate exists. The budget doesn't."
- "Water trucks drive fixed routes — trees that don't need water get watered, trees that do get missed."
- "Existing tree apps ask citizens to self-report waterings. But there's no proof. No sensor. Just trust."
- "That's a €1M problem running on a paper receipt."

---

## Slide 3 — Our Solution (0:25)
**Visual:** BeTree logo. Then a single sentence over a green background.

**Title on slide:** *"BeTree: we measure where the city is dying, pay people to fix it, and prove it worked."*

### Bullet points on slide
- **Cheap solar ESP32 node** per tree — capacitive soil moisture + temperature + vibration + sound
- **ESP-NOW mesh** connects nodes wirelessly at zero per-node connectivity cost (LoRaWAN roadmap)
- **Mobile web app** — color-coded map of every tree's thirst, live
- Citizen **scans QR / taps NFC** to start a watering session
- Sensor **confirms** a real moisture rise, cross-checked against rainfall → **"Proof of Care"**
- Verified watering → **credits** → **real city perks** (transit tickets, museum entry, Bürgeramt priority)

### What to say
- "We close both gaps at once: real sensor data per tree, and a verified citizen action loop."
- "No honor system. The soil tells us whether you actually watered it."

---

## Slide 4 — The Hardware (0:30)
**Visual:** Photo of the ESP32 node on a stake. Annotated diagram showing sensor layers.

**Title on slide:** *"Wurzelwerk — one node, five data streams, €24 at scale."*

### Bullet points on slide
| Sensor | Measures | City value |
|--------|----------|-----------|
| Capacitive soil moisture | Root-zone hydration % | "Which trees need water right now?" |
| DHT11 temp + humidity | Microclimate per tree | Urban heat island mapping |
| Vibration / IMU | Ground footfall + tree tilt | Pedestrian counts + storm damage alerts |
| Analog microphone | Ambient sound level | Real-time noise map |
| Solar + battery | Self-powered | Deploy and forget |

- **Dual-node architecture:** mesh nodes deep-sleep and wake every 15 min, gateway node bridges ESP-NOW → WiFi → FastAPI backend at `api.betree.me`
- Firmware is **modular** — each node declares which sensors it has; backend schema accepts nulls for absent fields
- **LoRaWAN** next: swap the radio, gain 5 km range, talk to existing TTN infrastructure — no WiFi per tree needed

### What to say
- "We call it Wurzelwerk — German for 'root network.'"
- "Each node stakes into the soil next to the tree. Solar panel charges a LiPo. No grid connection. No maintenance."
- "The mesh node wakes up, reads the soil, fires the data over ESP-NOW to the gateway node 50 metres away, and goes back to sleep in under half a second."
- "€24 per sensor at volume. That's the BOM cost. Before any departmental cost-sharing."

---

## Slide 5 — The Citizen App (0:25)
**Visual:** Phone mockup — map with colored tree pins, tree detail sheet open, QR scan screen, confetti.

**Title on slide:** *"Open the app. See a thirsty tree. Walk there. Water it. Done."*

### Bullet points on slide
- **Full-screen map** — trees colored red (thirsty), amber, green (watered)
- Tap any tree → **moisture gauge, soil visualization, tree species, last watered**
- **QR code scan or NFC tap** to start a verified watering session
- Live **moisture chart** animates as sensor samples arrive — you watch the soil get wetter in real time
- **Impact dashboard** — trees watered, litres delivered, CO₂ proxy, cooling estimate, activity heatmap
- **Reward shop** — spend credits on seed packets, museum tickets, VVK day pass, priority Bürgeramt slot
- Multilingual (DE / EN), PWA-installable, no app store

### What to say
- "The UX is one decision: find a red tree near you. Everything else is guided by the app."
- "You don't report a watering. The sensor reports it. Your phone just watches the moisture rise."
- "When the threshold is hit — confetti. You get your credits. The city gets its data."

---

## Slide 6 — Proof of Care (0:20)
**Visual:** The VerifyView component — live moisture line chart rising, crossing the green threshold line, confetti.

**Title on slide:** *"Not the honor system. Sensor-verified, rain-checked, tamper-resistant."*

### Bullet points on slide
- Sensor polls moisture every **500 ms** during a watering session
- Requires a **sustained rise** above threshold — a single spike doesn't count
- **Cross-checked against citywide rainfall data** — if it's raining, credit is suppressed
- Session must last a minimum window — can't fake a quick tap-and-run
- Every verified watering logged with timestamp, GPS, moisture delta → **audit trail for the city**

### What to say
- "Anyone can tap a QR code and claim they watered a tree. We don't trust that."
- "The sensor has to show a sustained moisture rise within the verification window. Rain cross-check kills gaming."
- "The city now has ground-truth data — not citizen diaries. That's what the Klimaanpassungsgesetz actually needs."

---

## Slide 7 — The Reward Loop & Economics (0:15)
**Visual:** Loop diagram: Citizen waters → sensor verifies → credits earned → city perks redeemed → city saves money → city funds more sensors.

**Title on slide:** *"One saved tree outpays a season of rewards."*

### Bullet points on slide
- Replacing one dead young tree costs the city **€5,000–15,000** (removal + replant + 3-5 yr establishment watering)
- A full summer of citizen watering credits costs **< €50** in redeemable perks
- **100× ROI** on every tree kept alive
- Reward catalogue: 🌱 seed packets · 🎟 museum entry · 🚌 transit day-pass · ⏩ priority Bürgeramt appointment
- City buys the data layer it's now **legally mandated** to produce — the sensor network is the compliance product

### What to say
- "The economics are simple. One saved tree pays for the sensor hardware and a year of citizen rewards many times over."
- "The city isn't paying for a nice app. It's buying the monitoring data it legally has to produce anyway — with citizen labor making the actual saves."

---

## Slide 8 — One Sensor, Five Departments (0:10)
**Visual:** Table — sensor icon on left, five department logos on right.

**Title on slide:** *"Not a tree sensor. The first street-level data grid for the city."*

### Bullet points on slide
| Dept | Question answered |
|------|------------------|
| Grünflächenamt | Which of our 50k trees need water right now? |
| Stadtplanung | Did pedestrianising Kaiserstraße increase foot traffic? |
| Umweltamt | Did Tempo 30 reduce noise in residential streets? |
| Gesundheitsamt | Where are heat islands exceeding 38°C during heat waves? |
| Tiefbauamt | Which trees are leaning after last night's storm? |

- **One sensor. One installation. One API. Five departments. Zero additional hardware.**
- Each department co-funds a fraction → sensor pays for itself before a single tree is saved

### What to say
- "Every department is currently paying for studies and manual surveys to answer these questions. We give them continuous, per-street answers as a side effect of the tree network."

---

## Slide 9 — The Ask / Close (0:05)
**Visual:** BeTree logo + tagline. QR code to the live demo URL.

**Title on slide:** *"BeTree — measure where the city is dying, pay people to fix it, prove it worked."*

### Bullet points on slide
- **Live today:** firmware running, API live, citizen app deployed, real sensor data flowing
- **Pilot ask:** 50 sensors, one district, one summer — let the data speak
- **Scale:** scales like software (ground-truth model covers every tree from a few hundred sensors), sells like infrastructure

### What to say
- "We have working hardware, a live API, and a deployed app. The sensor is in the ground. Scan the QR code — you can use the app right now."
- "We're asking for a pilot deployment: 50 nodes, one district, one summer. After that, the data makes the case better than we can."
- "BeTree. Because the trees can't ask for help themselves — but your phone can."

---

## Appendix — Key Numbers (backup for Q&A)

| Fact | Source |
|------|--------|
| 50,000 street trees in Karlsruhe | Stadt Karlsruhe open data |
| €5k–15k replacement cost per mature tree | Baupreise 2026 (DIN 276) |
| €24 sensor BOM at scale | ESP32 + sensors BoM, see `findings/power-budget.md` |
| €1M/year city watering budget | Stadt Karlsruhe Grünflächen |
| Legal mandate: *Bundes-Klimaanpassungsgesetz* | Federal law, in force 2025 |
| Sensor sensors: moisture, temp, vibration, sound | `backend/esp32/src/sensors.h` |
| ESP-NOW mesh, LoRaWAN roadmap | `backend/esp32/src/main.cpp` |
| Anti-gaming: rainfall cross-check | `src/components/scan/VerifyView.tsx` |
| Five-department value | `backend/findings/multi-department-value.md` |

---

## Rehearsal Notes

- **Speak to the tree, not the slide.** Open with the human story (a dying tree nobody noticed), not the law.
- **The demo is the killer.** Have the app live on a phone. Ask a judge to scan the QR on the node. Show the moisture chart move.
- **Don't say "IoT sensor."** Say "a stake in the ground next to the tree."
- **Don't say "gamification."** Say "the city pays you in real city perks for real work."
- **Anticipate: "Is this just another watering app?"** Answer: "No other app has a sensor in the soil. We're the only one that knows whether the watering actually happened."
- **Anticipate: "What about LoRaWAN?"** Answer: "The firmware already supports it — it's a radio swap. We built the architecture to scale from day one."
