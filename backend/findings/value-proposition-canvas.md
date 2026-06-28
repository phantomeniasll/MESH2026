# BeTree — Value Proposition Canvas

**Date:** June 27, 2026
**Tool:** Strategyzer Value Proposition Canvas
**Segments:** City of Karlsruhe, Citizens, Environmental Initiatives

---

## Segment 1: City of Karlsruhe (Municipal Tree Management)

### Customer Profile

| Jobs to be done | Pains | Gains |
|----------------|-------|-------|
| Keep ~50,000 street trees alive through heat waves | Zero per-tree data — water on fixed schedules | Save €500k-1M/year on watering |
| Optimize €1M/year watering budget | Trees die silently — first sign is brown leaves → too late | Prevent dead tree replacements (€5k-15k each) |
| Provide data for urban planning | Water trucks drive to trees that don't need water | Carbon credit revenue (€80k-200k/year) |
| Comply with EU green city directives | Citizen complaints are reactive, not predictive | Automated alerts — no manual inspections |
| Respond to citizen complaints about dying trees | Can't prove tree maintenance for liability/insurance claims | Data-driven urban planning decisions |
| Plan new tree plantings (€2M Hildapromenade) | Poorer neighborhoods have zero tree health data | Integration with existing GIS |
| Quantify carbon capture for climate reporting | Fixed watering schedule wastes water and diesel | Public transparency dashboard |
| | 3-5 year establishment watering costs ~€1,000 per new tree | Citizen labor at zero marginal cost |

### Value Map — How BeTree Helps

| Pain Relievers | Gain Creators |
|---------------|---------------|
| Real-time per-tree moisture → only water trees that need it | Reduced watering costs (targeted, not scheduled) |
| Automated critical alerts → catch stress before death | Fewer dead trees → avoided replacement costs |
| Watering route optimizer → trucks only go where needed | Carbon credit monetization (Verra VM0047) |
| Auto-register devices → no manual sensor setup | Footfall data → urban planning gold (where do people walk?) |
| Liability data → prove trees were maintained before storms | Noise maps → side effect of tree sensors, value for city planning |
| Predictive: "Tree #3147 will be critical in 6 hours" | Citizen labor → citizens water for points, city saves truck costs |
| Digital twin map → one view of entire canopy | Public dashboard → transparency reduces complaint volume |

### Value Map — Products & Services

- LoRaWAN soil moisture sensor network (€23.85/sensor at scale)
- City dashboard with digital twin map (Leaflet/OSM)
- `/api/dashboard/overview`, `/map`, `/footfall`, `/carbon` endpoints
- Open API for research and integration
- Noise + temperature + footfall overlays
- Carbon credit ledger with revenue estimates

---

## Segment 2: Citizens

### Customer Profile

| Jobs to be done | Pains | Gains |
|----------------|-------|-------|
| Care for their neighborhood | Don't know which trees need water | Know exactly which trees need them |
| Feel connected to their street | Water trees that don't need it (wasted effort) | See the impact: "Your Linden has been green for 47 days" |
| Do something meaningful for the environment | No recognition for effort | Recognition: points, badges, leaderboard, streaks |
| Get outside, be active | No feedback — did that watering actually help? | Social connection: neighborhood teams, tree adoption |
| Meet neighbors | Can't find trees that need care near them | Real city benefits: priority Bürgeramt, free day pass |
| | Trees dying in their neighborhood → feel powerless | Be part of something: "23 caretakers for this tree this month" |

### Value Map — How BeTree Helps

| Pain Relievers | Gain Creators |
|---------------|---------------|
| NFC tap → "This tree needs water. You're here. Help?" | Points economy: 50 pts per watering |
| Push alerts when nearby trees are dry | Streak: "5th day in a row. +10 bonus." |
| Map shows which trees need water near you | Arenas: Südstadt ⚔️ Oststadt — neighborhood league |
| One button: "I WATERED THIS" — zero friction | Achievements: 9 badges (First Drop, Early Bird, Centurion...) |
| | Leaderboard: top caretakers visible |
| | Tree adoption: claim a tree as yours |
| | Rewards: points → city services (Bürgeramt slot, day pass, plaque) |
| | Friends: challenge friends, gift points |
| | Photos: upload tree photos, community archive |

### Value Map — Products & Services

- NFC tag on each sensor → phone tap → web app, no install
- Citizen web app: tree info + "I watered this" + points + leaderboard
- Telegram bot alternative for alerts
- Points economy: 6 reward types (Bus Pass, Bürgeramt, Plaque, Certificate, Ceremony, Merch)

---

## Segment 3: Environmental Initiatives / NGOs

### Customer Profile

| Jobs to be done | Pains | Gains |
|----------------|-------|-------|
| Track urban canopy health | Zero real-time canopy data | Real-time moisture + health data per tree |
| Mobilize volunteers | Volunteer coordination is manual, ad-hoc | Citizen platform already mobilizing people |
| Report on environmental metrics | Can't quantify impact of tree programs | CO2 capture metrics per tree |
| Advocate for tree protection | Hard to prove trees are dying before visible | Early warning data for advocacy |
| Research urban microclimates | Sparse weather station data | Per-tree temperature + humidity microclimate data |

### Value Map

| Pain Relievers | Gain Creators |
|---------------|---------------|
| Open API → researchers access anonymized canopy data | Quantifiable metrics for grant applications |
| Citizen platform → volunteers already mobilized, just need to point them at trees | Per-tree CO2 data for climate reporting |
| Early warning → advocate before trees die, not after | 14,217 OSM-mapped trees as baseline |
| Per-tree microclimate → 50,000 data points instead of 1 airport station | School programs: biology classes adopt trees, track data |

---

## Fit Summary

| Segment | Top Pain Relieved | Top Gain Created | Fit Strength |
|---------|------------------|-----------------|-------------|
| **City** | "We know which trees need water right now" | €500k-1M/year savings + avoided tree deaths | 🔥🔥🔥🔥🔥 |
| **Citizens** | "Tap here. This tree needs you." | Recognition + real city rewards for free labor | 🔥🔥🔥🔥 |
| **NGOs** | Open data for research | Quantifiable canopy health metrics | 🔥🔥🔥 |

### The Core Value Proposition (One Sentence)

> **"BeTree tells the city which trees need water and tells citizens which trees need them — and rewards them for it."**
