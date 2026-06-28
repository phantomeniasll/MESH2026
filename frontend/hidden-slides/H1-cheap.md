# Hidden Slide H1 — Why We're So Cheap

**Visual:** The hardware BOM / cost breakdown (see `backend/findings/power-budget.md` and `backend/findings/costs.md`), plus the "install in 5 min" line.

**Title on slide:** *"Cheap at every layer: hardware, connectivity, power, data, and coverage."*

## Bullet points on slide
- **~€24 BOM** per node at volume
- **Install in 5 minutes:** stake, register, joins the mesh
- **Connectivity ~€1 per node** (only gateways use WiFi)
- **Self-powered:** solar + LiPo, no grid, no battery swaps
- **Tiny energy budget:** deep-sleep ~7 µA, ~60 mAh/year
- **Free weather data** (Open-Meteo / DWD)
- **A few hundred sensors cover all 126k trees**
- **Rewards are existing city capacity,** not cash

## What to say
- "The cost isn't just a cheap sensor. Every single layer is cheap: the build, the radio, the power, the weather data, and the coverage."
- "Installing one takes about five minutes. Stake it, register it in the app, and it joins the mesh and knows exactly where it is."
- "Connectivity is roughly a euro per node. Only the gateways talk WiFi, and they cover a whole cluster."
- "Power is basically free. It sleeps at a few microamps, wakes every 15 minutes to read and send, and a tiny 5-by-5 cm solar panel covers it many times over. The production design runs for years on one battery."
- "A whole one-district pilot is about €1,200 of hardware. One young tree that dies costs five to fifteen thousand to replace."

## Why a citizen uses it
- Cheap enough that the city can actually deploy widely, so there are real thirsty trees near you to rescue.
- Low running cost keeps the program alive, so the rewards keep coming.

## Why the city uses it
- Fits a tight, legally-mandated budget: low total cost of ownership, no per-tree capex.
- Pays for itself against a single avoided tree death; scales without a sensor per tree.
