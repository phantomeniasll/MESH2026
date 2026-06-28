import { apiFetch } from "./client";
import type { TreeFC, TreeProperties } from "@/lib/types";
import type { PlanTree } from "@/lib/routing/types";

// ── Backend DTOs ─────────────────────────────────────────────────────────────

/** Short-key shape returned by GET /api/map/trees */
interface MapTreeDTO {
  id: string;
  sp: string;   // species
  nb: string;   // neighborhood
  lat: number;
  lng: number;
  m: number;    // moisture
  h: number;    // heat
  ay: number;   // ageYears
  py: number;   // plantedYear
  lpd: number;  // litersPerDay
}

interface MapTreesResponse {
  v: number;
  trees: MapTreeDTO[];
}

interface LiveOverride {
  id: string;
  moisture: number;
  status: "thirsty" | "ok" | "watered";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveStatus(moisture: number): TreeProperties["status"] {
  return moisture < 30 ? "thirsty" : "ok";
}

function expandDTO(dto: MapTreeDTO): TreeProperties {
  const status = deriveStatus(dto.m);
  return {
    id: dto.id,
    species: dto.sp,
    neighborhood: dto.nb,
    moisture: dto.m,
    heat: dto.h,
    ageYears: dto.ay,
    plantedYear: dto.py,
    litersPerDay: dto.lpd,
    status,
    needsWater: dto.m < 30,
    lastWatered: null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchMapTrees(): Promise<TreeFC> {
  const data = await apiFetch<MapTreesResponse>("/api/map/trees");

  const features = data.trees.map((dto) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [dto.lng, dto.lat] as [number, number],
    },
    properties: expandDTO(dto),
  }));

  return { type: "FeatureCollection", features };
}

export async function fetchLiveOverrides(): Promise<LiveOverride[]> {
  return apiFetch<LiveOverride[]>("/api/map/live");
}

export async function fetchTreeDetail(id: string): Promise<TreeProperties> {
  return apiFetch<TreeProperties>(`/api/trees/${encodeURIComponent(id)}/detail`);
}

// ── Forecast (hybrid water-balance) ─────────────────────────────────────────

export interface ForecastPoint {
  t: string; // ISO8601 local
  m: number; // 0-100
}

export interface TreeForecast {
  tree_id: string;
  source: "sensor" | "modeled" | "unavailable";
  now_moisture: number | null;
  threshold: number;
  liters_per_day: number | null;
  curve: ForecastPoint[];
  dry_in_hours: number | null;
  dry_by: string | null;
  next_rain_at: string | null;
  will_refill: boolean;
}

export async function fetchTreeForecast(
  id: string,
  opts?: { lat?: number; lng?: number; age?: number; species?: string | null },
): Promise<TreeForecast> {
  const qs = new URLSearchParams();
  if (opts?.lat != null) qs.set("lat", String(opts.lat));
  if (opts?.lng != null) qs.set("lng", String(opts.lng));
  if (opts?.age != null) qs.set("age", String(opts.age));
  if (opts?.species) qs.set("species", opts.species);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<TreeForecast>(
    `/api/trees/${encodeURIComponent(id)}/forecast${suffix}`,
  );
}

export async function fetchRescueTrees(
  lat: number,
  lng: number,
  limit = 5,
): Promise<import("@/lib/types").TreeSummary[]> {
  return apiFetch(`/api/trees/rescue?lat=${lat}&lng=${lng}&limit=${limit}`);
}

// ── Trees for route planning ─────────────────────────────────────────────────

/**
 * Days of water a single truck visit tops up. The per-visit fill is the tree's
 * modelled daily need × this — a realistic deep watering (~a week's worth), so a
 * truck tank holds a handful of trees rather than dozens.
 */
const WATERING_DAYS = 7;

/**
 * Fetch all trees as planner input. Uses /api/map/trees, which already carries
 * per-tree litres-per-day (`lpd`) and moisture (`m`), so we get coordinates AND
 * a fill amount in a single call with no backend change.
 *
 * The "critical" subset is selected in the UI by a soil-moisture threshold, so
 * this returns the full set and lets the caller rank/filter it.
 */
export async function fetchPlanTrees(): Promise<PlanTree[]> {
  const data = await apiFetch<MapTreesResponse>("/api/map/trees");
  return data.trees.map((t) => ({
    id: t.id,
    name: t.id,
    lat: t.lat,
    lng: t.lng,
    neighborhood: t.nb,
    moisture: t.m,
    fillLiters: Math.max(10, Math.round(t.lpd * WATERING_DAYS)),
  }));
}
