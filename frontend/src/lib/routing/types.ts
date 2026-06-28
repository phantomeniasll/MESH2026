// Types for the critical-tree watering route planner.
// Pure data shapes — no framework or fetch dependencies live here.

export interface PlanTree {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  /** Litres of water this tree should receive on this visit. */
  fillLiters: number;
  neighborhood?: string | null;
  /** Latest soil moisture (% VWC), for display only. */
  moisture?: number | null;
}

export interface RouteStop extends PlanTree {
  /** 1-based position of this stop within its route. */
  order: number;
  /** Running litres dispensed including this stop. */
  cumulativeLiters: number;
  /** Straight-line distance (km) from the previous stop; 0 for the first. */
  legDistanceKm: number;
}

export interface SuggestedRoute {
  /** 0-based route index. */
  index: number;
  /** Stable display colour for this route. */
  color: string;
  stops: RouteStop[];
  totalFillLiters: number;
  /** totalFillLiters / tankCapacityLiters, clamped to [0, 1+]. */
  capacityUtilization: number;
  /** Sum of straight-line legs (km), open path (no return to start). */
  totalDistanceKm: number;
  /** True when a single tree's fill amount exceeds the whole tank. */
  exceedsCapacity?: boolean;
}

export interface PlannerConfig {
  /** Water-truck tank capacity in litres. */
  tankCapacityLiters: number;
}
