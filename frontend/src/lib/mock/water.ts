import { VERIFY_WINDOW_MS, MOISTURE_THRESHOLD } from "@/lib/constants";
import { createRng } from "./seed";

export interface WaterSample {
  moisture: number;
  t: number;
  raining: boolean;
}

const POLL_INTERVAL = 500;
const TOTAL_SAMPLES = VERIFY_WINDOW_MS / POLL_INTERVAL;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export async function* simulateSession(
  treeId: string,
  startMoisture = 18
): AsyncGenerator<WaterSample> {
  const seed = treeId.charCodeAt(3) * 137 + (Date.now() % 1000);
  const rng = createRng(seed);
  const raining = rng() < 0.05;
  const targetMoisture = raining ? startMoisture + 5 : MOISTURE_THRESHOLD + 15;

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const progress = i / (TOTAL_SAMPLES * 0.75);
    const base = startMoisture + (targetMoisture - startMoisture) * sigmoid((progress - 0.5) * 6);
    const noise = (rng() - 0.5) * 3;
    const moisture = Math.round(Math.min(100, Math.max(0, base + noise)));
    yield { moisture, t: (i + 1) * POLL_INTERVAL, raining };
  }
}
