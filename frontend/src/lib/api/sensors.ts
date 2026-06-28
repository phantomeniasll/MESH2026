import { apiFetch } from "./client";

export interface SensorReading {
  id: string;
  tree_id: string;
  moisture: number | null;
  temperature: number | null;
  humidity: number | null;
  recorded_at: string;
}

/** Most recent readings for a tree (newest first). Used for live watering verification. */
export async function fetchTreeReadings(
  treeId: string,
  limit = 1,
): Promise<SensorReading[]> {
  return apiFetch<SensorReading[]>(
    `/api/sensors/tree/${encodeURIComponent(treeId)}/readings?limit=${limit}`,
  );
}
