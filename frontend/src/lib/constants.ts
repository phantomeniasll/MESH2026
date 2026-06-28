export const KARLSRUHE_CENTER = { lng: 8.4037, lat: 49.0069 };
export const VERIFY_WINDOW_MS = 40_000;
export const MOISTURE_THRESHOLD = 45;

// Live-sensor watering verification (real readings from KA-00001).
export const LIVE_VERIFY_WINDOW_MS = 60_000; // give up if no rise within 60s
export const LIVE_RISE_DELTA = 6; // % moisture rise that confirms a real watering
export const LIVE_POLL_MS = 800; // how often to poll the live sensor
// Moisture must stay above the goal for this much *cumulative* time before we
// confirm — a sustained rise, not a one-sample spike (also blocks gaming).
export const VERIFY_SUSTAIN_MS = 3_000;
export const REWARD_PER_WATER = 25;
export const SEED_REDEEM_COST = 50;

// Drought-prone / shallow-rooted genera — singled out as extra-thirsty on the
// map and flagged in the tree detail view. Keep in sync with the snapshot
// regen script (backend/scripts/regen_snapshot.py: DROUGHT_GENERA).
export const DROUGHT_PRONE_GENERA = [
  "Betula",
  "Prunus",
  "Sorbus",
  "Aesculus",
  "Salix",
  "Crataegus",
];

export function isDroughtProneSpecies(species?: string | null): boolean {
  if (!species) return false;
  return DROUGHT_PRONE_GENERA.includes(species.trim().split(" ")[0]);
}

// ── Demo tree ────────────────────────────────────────────────────────────────
// KA-00001 (the live-sensor tree) usually sits wet. We cap only its *displayed
// water level* low enough to register thirsty (map + detail), without touching
// its real liters/day need or the forecast. The live-watering verify still
// polls the raw sensor.
export const DEMO_TREE_ID = "KA-00001";
export const DEMO_THIRSTY_MOISTURE = 22;

/** Display moisture capped to thirsty for the demo tree; untouched otherwise. */
export function demoDisplayMoisture(id: string, moisture: number): number {
  return id === DEMO_TREE_ID ? Math.min(moisture, DEMO_THIRSTY_MOISTURE) : moisture;
}
export const TREE_COUNT = 300;

export const SPECIES = [
  "Tilia cordata",
  "Acer platanoides",
  "Quercus robur",
  "Prunus avium",
  "Betula pendula",
  "Fraxinus excelsior",
  "Platanus × acerifolia",
  "Sorbus aucuparia",
];

export const NEIGHBORHOODS = [
  "Innenstadt", "Südstadt", "Weststadt", "Oststadt",
  "Mühlburg", "Durlach", "Grötzingen", "Neureut",
  "Waldstadt", "Stupferich", "Wettersbach", "Hohenwettersbach",
];
