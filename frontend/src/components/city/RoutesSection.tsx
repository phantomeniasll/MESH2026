"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchPlanTrees } from "@/lib/api/trees";
import { planRoutes } from "@/lib/routing/planRoutes";
import type { PlanTree } from "@/lib/routing/types";
import { KpiCard } from "./KpiCard";
import { RouteMap } from "./RouteMap";

const DEFAULT_CAPACITY_L = 1500;
const CAPACITY_PRESETS = [1500, 2500, 4000, 6000];
const MOISTURE_SLIDER_MAX = 60;        // soil moisture (% VWC) slider range
const DEFAULT_CRITICAL_FRACTION = 0.02; // default threshold ≈ driest 2% of trees
const FALLBACK_MOISTURE_THRESHOLD = 15;
const TARGET_ROUTES = 3.5;             // auto-pick a neighbourhood near this many runs

const CARD: React.CSSProperties = {
  background: "var(--cc-surface)",
  border: "1px solid var(--cc-border)",
  borderRadius: "4px",
  padding: "14px 16px",
};

const LABEL: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--cc-muted)",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  background: "var(--cc-bg)",
  border: "1px solid var(--cc-border2)",
  borderRadius: "4px",
  padding: "7px 9px",
  color: "var(--cc-text)",
  fontSize: "13px",
};

export function RoutesSection() {
  const [allTrees, setAllTrees] = useState<PlanTree[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [neighborhood, setNeighborhood] = useState<string>("all");
  const [capacity, setCapacity] = useState<number>(DEFAULT_CAPACITY_L);
  const [moistureThreshold, setMoistureThreshold] = useState<number>(FALLBACK_MOISTURE_THRESHOLD);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchPlanTrees()
      .then((trees) => {
        setAllTrees(trees);

        // Default the threshold to the moisture value that makes ~2% of trees
        // critical (the 2nd-percentile moisture) — small but always > 0.
        const ms = trees
          .map((t) => t.moisture)
          .filter((m): m is number => m != null)
          .sort((a, b) => a - b);
        let threshold = FALLBACK_MOISTURE_THRESHOLD;
        if (ms.length > 0) {
          // At least the driest tree, ~2% of trees by default. Set the threshold
          // just above the k-th driest moisture so those k trees are < threshold.
          const k = Math.max(1, Math.floor(ms.length * DEFAULT_CRITICAL_FRACTION));
          threshold = Math.min(MOISTURE_SLIDER_MAX, Math.floor(ms[k - 1]) + 1);
          setMoistureThreshold(threshold);
        }

        // Start scoped to one small neighbourhood — the one whose critical trees
        // need closest to ~3-4 truck runs at the default capacity. Keeps the
        // first view local, fast, and free of cross-city route lines.
        const litersByNb = new Map<string, number>();
        for (const t of trees) {
          if ((t.moisture ?? Infinity) < threshold && t.neighborhood) {
            litersByNb.set(t.neighborhood, (litersByNb.get(t.neighborhood) ?? 0) + t.fillLiters);
          }
        }
        let best: string | null = null;
        let bestScore = Infinity;
        for (const [nb, liters] of litersByNb) {
          const routesEst = Math.ceil(liters / DEFAULT_CAPACITY_L);
          const score = Math.abs(routesEst - TARGET_ROUTES);
          if (score < bestScore) {
            bestScore = score;
            best = nb;
          }
        }
        if (best) setNeighborhood(best);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // "Critical" = trees drier than the moisture threshold (% VWC).
  const criticalTrees = useMemo(
    () => allTrees.filter((t) => (t.moisture ?? Infinity) < moistureThreshold),
    [allTrees, moistureThreshold],
  );

  const neighborhoods = useMemo(() => {
    const set = new Set<string>();
    for (const t of criticalTrees) if (t.neighborhood) set.add(t.neighborhood);
    return [...set].sort();
  }, [criticalTrees]);

  const areaTrees = useMemo(
    () =>
      neighborhood === "all"
        ? criticalTrees
        : criticalTrees.filter((t) => t.neighborhood === neighborhood),
    [criticalTrees, neighborhood],
  );

  const routes = useMemo(() => {
    const cap = Math.max(1, capacity || 0);
    return planRoutes(areaTrees, { tankCapacityLiters: cap });
  }, [areaTrees, capacity]);

  // Changing any input rebuilds the routes, so clear any stale selection.
  const applyCapacity = (v: number) => {
    setCapacity(Math.max(1, v || 0));
    setSelectedIndex(null);
  };
  const applyArea = (v: string) => {
    setNeighborhood(v);
    setSelectedIndex(null);
  };
  const applyMoistureThreshold = (v: number) => {
    setMoistureThreshold(v);
    setSelectedIndex(null);
  };

  const totalWater = useMemo(
    () => areaTrees.reduce((s, t) => s + t.fillLiters, 0),
    [areaTrees],
  );
  const totalDistance = useMemo(
    () => routes.reduce((s, r) => s + r.totalDistanceKm, 0),
    [routes],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Map */}
      <div className="h-[420px] lg:h-full">
        <RouteMap
          trees={areaTrees}
          routes={routes}
          selectedIndex={selectedIndex}
          onSelectRoute={setSelectedIndex}
        />
      </div>

      {/* Controls + results */}
      <div className="flex flex-col gap-4 overflow-y-auto">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--cc-text)" }}>Watering Routes</h2>
          <span style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cc-accent)" }}>
            Gartenbauamt · Bewässerung
          </span>
        </div>

        {/* Controls */}
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Area — the primary scope */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={LABEL} htmlFor="area-select">Neighbourhood</label>
            <select
              id="area-select"
              value={neighborhood}
              onChange={(e) => applyArea(e.target.value)}
              style={INPUT}
            >
              <option value="all">All neighbourhoods (slower)</option>
              {neighborhoods.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {neighborhood === "all" && (
              <span style={{ fontSize: "11px", color: "#f59e0b" }}>
                Planning the whole city can be slow and produce long cross-district routes — pick a neighbourhood.
              </span>
            )}
          </div>

          {/* Truck tank capacity */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={LABEL} htmlFor="tank-capacity">Truck tank capacity (litres)</label>
            <input
              id="tank-capacity"
              type="number"
              min={100}
              step={100}
              value={capacity}
              onChange={(e) => applyCapacity(Number(e.target.value))}
              style={{ ...INPUT, fontFamily: "var(--cc-mono)", fontVariantNumeric: "tabular-nums" }}
            />
            <div style={{ display: "flex", gap: "6px" }}>
              {CAPACITY_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => applyCapacity(p)}
                  style={{
                    flex: 1,
                    fontSize: "11px",
                    padding: "5px 0",
                    borderRadius: "4px",
                    border: `1px solid ${capacity === p ? "var(--cc-accent)" : "var(--cc-border2)"}`,
                    background: capacity === p ? "rgba(59,130,246,0.15)" : "transparent",
                    color: capacity === p ? "var(--cc-accent)" : "var(--cc-muted)",
                    cursor: "pointer",
                    fontFamily: "var(--cc-mono)",
                  }}
                >
                  {p.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Critical threshold — trees drier than this soil-moisture level */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <label style={LABEL} htmlFor="moisture-threshold">Critical below soil moisture</label>
              <span style={{ fontSize: "12px", color: "var(--cc-accent)", fontFamily: "var(--cc-mono)", fontVariantNumeric: "tabular-nums" }}>
                &lt; {moistureThreshold}% · {loaded ? criticalTrees.length : "—"} trees
              </span>
            </div>
            <input
              id="moisture-threshold"
              type="range"
              min={0}
              max={MOISTURE_SLIDER_MAX}
              step={1}
              value={moistureThreshold}
              onChange={(e) => applyMoistureThreshold(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--cc-accent)" }}
            />
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Critical trees" value={loaded ? areaTrees.length : "—"} sub="red predictions in area" accent="default" />
          <KpiCard label="Routes needed" value={loaded ? routes.length : "—"} sub="truck runs at this capacity" accent="activity" />
          <KpiCard label="Total water" value={loaded ? `${totalWater.toLocaleString()} L` : "—"} sub="to refill trees in area" accent="moisture" />
          <KpiCard label="Total distance" value={loaded ? `${totalDistance.toFixed(1)} km` : "—"} sub="straight-line, all routes" accent="heat" />
        </div>

        {/* Route list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={LABEL}>Suggested routes</p>
          {loaded && areaTrees.length === 0 && (
            <p style={{ fontSize: "12px", color: "var(--cc-muted)" }}>No critical trees in this area.</p>
          )}
          {routes.map((r) => {
            const selected = selectedIndex === r.index;
            const pct = Math.min(100, Math.round(r.capacityUtilization * 100));
            return (
              <button
                key={r.index}
                onClick={() => setSelectedIndex(selected ? null : r.index)}
                style={{
                  ...CARD,
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: selected ? r.color : "var(--cc-border)",
                  outline: selected ? `1px solid ${r.color}` : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--cc-text)" }}>Route {r.index + 1}</span>
                  <span style={{ fontSize: "11px", color: "var(--cc-muted)", marginLeft: "auto", fontFamily: "var(--cc-mono)" }}>
                    {r.stops.length} stops · {r.totalDistanceKm.toFixed(1)} km
                  </span>
                </div>

                {/* Capacity bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--cc-border2)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: r.color }} />
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--cc-muted)", fontFamily: "var(--cc-mono)", fontVariantNumeric: "tabular-nums" }}>
                    {r.totalFillLiters.toLocaleString()} / {capacity.toLocaleString()} L
                  </span>
                </div>

                {r.exceedsCapacity && (
                  <span style={{ fontSize: "11px", color: "#f59e0b" }}>
                    ⚠ This tree alone needs more than one tank — plan multiple fills.
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
