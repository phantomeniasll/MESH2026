// Capacity-constrained nearest-neighbour route planner (CVRP-lite).
//
// Given the critical ("red") trees and a truck tank capacity, partition them
// into one or more suggested routes such that each route's total fill amount
// fits the tank, ordering stops with a straight-line nearest-neighbour heuristic.
// Open path, no fixed start (the westernmost remaining tree seeds each route),
// which makes the output deterministic for a given input.
//
// Pure: no fetch, no framework. Easily unit-testable in isolation.

import { haversineKm } from "./haversine";
import type { PlanTree, RouteStop, SuggestedRoute, PlannerConfig } from "./types";

/** Stable per-route colours, cycled if there are more routes than colours. */
export const ROUTE_COLORS = [
  "#16a34a", // green
  "#0284c7", // blue
  "#d97706", // amber
  "#9333ea", // purple
  "#dc2626", // red
  "#0d9488", // teal
  "#c026d3", // fuchsia
  "#ca8a04", // gold
];

function deterministicOrder(trees: PlanTree[]): PlanTree[] {
  // Sort west→east, then south→north, then by id — fully deterministic.
  return [...trees].sort(
    (a, b) => a.lng - b.lng || a.lat - b.lat || a.id.localeCompare(b.id),
  );
}

function buildRoute(
  index: number,
  ordered: PlanTree[],
  capacity: number,
  exceedsCapacity: boolean,
): SuggestedRoute {
  let cumulativeLiters = 0;
  let totalDistanceKm = 0;
  const stops: RouteStop[] = ordered.map((tree, i) => {
    const legDistanceKm = i === 0 ? 0 : haversineKm(ordered[i - 1], tree);
    totalDistanceKm += legDistanceKm;
    cumulativeLiters += tree.fillLiters;
    return { ...tree, order: i + 1, cumulativeLiters, legDistanceKm };
  });

  return {
    index,
    color: ROUTE_COLORS[index % ROUTE_COLORS.length],
    stops,
    totalFillLiters: cumulativeLiters,
    capacityUtilization: capacity > 0 ? cumulativeLiters / capacity : 0,
    totalDistanceKm,
    exceedsCapacity: exceedsCapacity || undefined,
  };
}

export function planRoutes(
  trees: PlanTree[],
  config: PlannerConfig,
): SuggestedRoute[] {
  const capacity = config.tankCapacityLiters;
  const unvisited = deterministicOrder(trees);
  const routes: SuggestedRoute[] = [];

  while (unvisited.length > 0) {
    const seed = unvisited.shift()!;
    const ordered: PlanTree[] = [seed];
    let load = seed.fillLiters;

    // A single tree whose fill exceeds the whole tank gets its own flagged route.
    if (capacity > 0 && seed.fillLiters > capacity) {
      routes.push(buildRoute(routes.length, ordered, capacity, true));
      continue;
    }

    // Greedily append the nearest unvisited tree that still fits the tank.
    let last: PlanTree = seed;
    for (;;) {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const candidate = unvisited[i];
        if (load + candidate.fillLiters > capacity) continue;
        const d = haversineKm(last, candidate);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break; // nothing else fits — close this route
      const [next] = unvisited.splice(bestIdx, 1);
      ordered.push(next);
      load += next.fillLiters;
      last = next;
    }

    routes.push(buildRoute(routes.length, ordered, capacity, false));
  }

  return routes;
}
