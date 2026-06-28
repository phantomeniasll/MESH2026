# Hidden Slide 3 — Vapour Modelling & Sensor Density

**Visual:** Pull screenshots from the report (Section 5.2 — depth/coverage and the dense/sparse split).

**Title on slide:** *"The probe reads the top 5 cm. Physics models the rest of the tree, and most of the city."*

## Bullet points on slide
- **A sensor only reads the top ~5 cm** of soil, but the roots drink 20–30 cm down, which can be dry while the surface looks fine.
- **Physics-based vaporisation model.** For every tree we don't actively measure, we estimate its water loss (evapotranspiration) from the **weather forecast** plus **data from nearby measured trees**.
- **So a few sensors cover many trees.** Measured trees ground-truth the model; the model fills in the rest.
- **Young trees: dense coverage.** High risk, they die without help, and citizen watering is verifiable on them.
- **Old trees: sparse coverage.** Deep roots, they live through most things, so we interpolate and barely sensor them.
- **Honest caveat:** constants are physical estimates today, not yet fitted to real dry-down data; it calibrates as sensors deploy.

## What to say
- "The probe only sees the top five centimetres. The tree drinks much deeper, so we never trust the surface alone."
- "For trees without a sensor, a physics model estimates their water loss from the weather forecast and from the trees nearby that do have sensors."
- "That's why young trees get dense sensors — high risk, and citizens can actually help — and old trees get almost none, because they survive most things and the model covers them."

## Why a citizen uses it
- The thirst rating is real physics plus nearby ground-truth, so the tree you're sent to genuinely needs water.

## Why the city uses it
- Whole-cadastre coverage from sparse hardware, concentrated where the risk and the verifiable saves actually are.
