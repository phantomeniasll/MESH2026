import { KARLSRUHE_CENTER, SPECIES, NEIGHBORHOODS, TREE_COUNT } from "@/lib/constants";
import { createRng } from "./seed";
import type { TreeProperties, TreeFeature, TreeFC } from "@/lib/types";

export type { TreeProperties, TreeFeature, TreeFC };

let _cached: TreeFC | null = null;

export function generateTrees(): TreeFC {
  if (_cached) return _cached;
  const rng = createRng(42);

  const features: TreeFeature[] = Array.from({ length: TREE_COUNT }, (_, i) => {
    const angle = rng() * Math.PI * 2;
    const radius = rng() * 0.055;
    const lng = KARLSRUHE_CENTER.lng + Math.cos(angle) * radius;
    const lat = KARLSRUHE_CENTER.lat + Math.sin(angle) * radius * 0.7;

    const plantedYear = 2019 + Math.floor(rng() * 5);
    const ageYears = 2026 - plantedYear;
    const moisture = Math.floor(rng() * 60) + 5;
    const needsWater = moisture < 30;
    const status: TreeProperties["status"] = needsWater ? "thirsty" : "ok";
    const litersPerDay = Math.max(8, Math.min(30, ageYears * 4 + Math.floor(rng() * 6)));
    // Higher heat where moisture is low and tree is young (less shade/cooling)
    const heat = Math.round(Math.max(0, Math.min(100, (100 - moisture) * 0.6 + rng() * 40)));

    const daysAgo = Math.floor(rng() * 14);
    const lastWatered = new Date(2026, 5, 27 - daysAgo).toISOString();

    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        id: `KA-${String(i + 1).padStart(5, "0")}`,
        species: SPECIES[Math.floor(rng() * SPECIES.length)],
        plantedYear,
        ageYears,
        moisture,
        heat,
        status,
        needsWater,
        lastWatered,
        neighborhood: NEIGHBORHOODS[Math.floor(rng() * NEIGHBORHOODS.length)],
        litersPerDay,
      },
    };
  });

  _cached = { type: "FeatureCollection", features };
  return _cached;
}

export function getTreeById(id: string): TreeFeature | undefined {
  return generateTrees().features.find((f) => f.properties.id === id);
}
