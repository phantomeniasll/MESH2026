# Hidden Slide H1 — Why We're So Cheap

**Visual:** The hardware BOM / cost breakdown (see `backend/findings/power-budget.md` and `backend/findings/costs.md`), plus the "install in 5 min" line.

**Title on slide:** *"Cheap at every layer: hardware, connectivity, power, data, and coverage."*

## Bullet points on slide
- **Hardware:** ~**€24 BOM** per node at volume. Standard, reusable off-the-shelf sensors.
- **Install in 5 minutes.** Stake it next to the tree, register it in the app, and it joins the mesh and knows where it is. No grid hookup, no trenching, no specialist.
- **Connectivity: ~€1 per node.** ESP-NOW mesh is free between nodes; only the central gateway nodes carry WiFi, amortised to roughly €1 per node across the cluster. No SIM, no LoRaWAN fee, no WiFi per tree.
- **Power: €0 running cost.** Solar + LiPo, no grid, no battery swaps, no maintenance truck rolls.
- **Tiny energy budget.** The node deep-sleeps and wakes ~every 15 min with the sensors power-gated off, drawing ~7 µA: on the order of **0.2 mAh/day (~60 mAh/year)** in the production design. A 5×5 cm solar cell is overkill, so it runs for years with no battery swap. *(The hackathon dev board draws more through its USB chip; the custom PCB hits these numbers.)*
- **Data: free.** Open-Meteo / DWD weather costs nothing.
- **Coverage: nearly free.** The hybrid model covers all **126k trees** from a few hundred sensors, so we don't pay for a sensor per tree.
- **Rewards: existing city capacity**, not cash out the door (seed packets, museum entry, transit pass).

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
