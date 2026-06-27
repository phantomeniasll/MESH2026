import { apiFetch } from "./client";
import type { TreeFC, TreeProperties } from "@/lib/types";

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

export async function fetchRescueTrees(
  lat: number,
  lng: number,
  limit = 5,
): Promise<import("@/lib/types").TreeSummary[]> {
  return apiFetch(`/api/trees/rescue?lat=${lat}&lng=${lng}&limit=${limit}`);
}
