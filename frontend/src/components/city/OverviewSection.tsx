"use client";

import { useEffect, useState } from "react";
import { fetchCityOverview, fetchTimeSeries } from "@/lib/api/city";
import type { CityOverview, TimeSeriesResponse } from "@/lib/types";
import { KpiCard } from "./KpiCard";
import { CityTimelapseMap } from "./CityTimelapseMap";
import { TimeSeriesChart } from "./TimeSeriesChart";

const CHART_WRAP: React.CSSProperties = {
  background: "var(--cc-surface)",
  border: "1px solid var(--cc-border)",
  borderRadius: "4px",
  padding: "14px 16px",
};

export function OverviewSection() {
  const [overview, setOverview] = useState<CityOverview | null>(null);
  const [series, setSeries] = useState<TimeSeriesResponse | null>(null);

  useEffect(() => {
    fetchCityOverview().then(setOverview).catch(() => {});
    fetchTimeSeries("noise", "day", { days: 30 }).then(setSeries).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="h-[420px] lg:h-full">
        <CityTimelapseMap defaultMetric="heat" />
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto">
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--cc-text)" }}>City at a glance</h2>

        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Trees monitored" value={overview?.trees_monitored ?? "—"} sub="with live sensors" accent="default" />
          <KpiCard label="Neighbourhoods" value={overview?.neighborhoods_covered ?? "—"} sub="covered" accent="default" />
          <KpiCard
            label="Avg noise"
            value={overview?.current.noise_db != null ? `${overview.current.noise_db} dB` : "—"}
            sub="7-day average"
            accent="noise"
          />
          <KpiCard
            label="Avg temp"
            value={overview?.current.heat_avg_c != null ? `${overview.current.heat_avg_c}°C` : "—"}
            sub="street-level"
            accent="heat"
          />
          <KpiCard
            label="Activity 7d"
            value={overview?.current.activity_total_7d.toLocaleString() ?? "—"}
            sub="total pedestrian counts"
            accent="activity"
          />
          <KpiCard
            label="Tree health"
            value={overview?.health_pct != null ? `${overview.health_pct}%` : "—"}
            sub="healthy status"
            accent="default"
          />
        </div>

        {series && (
          <div style={CHART_WRAP}>
            <p style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cc-muted)", marginBottom: "8px" }}>
              Noise — 30-day trend
            </p>
            <TimeSeriesChart series={series.series} color="#d97706" unit=" dB" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div style={{ ...CHART_WRAP, padding: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "22px", fontWeight: 600, color: "#16a34a", fontFamily: "var(--cc-mono)", fontVariantNumeric: "tabular-nums" }}>
              {overview?.status_counts.healthy ?? 0}
            </p>
            <p style={{ fontSize: "11px", color: "var(--cc-muted)" }}>Healthy</p>
          </div>
          <div style={{ ...CHART_WRAP, padding: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "22px", fontWeight: 600, color: "#d97706", fontFamily: "var(--cc-mono)", fontVariantNumeric: "tabular-nums" }}>
              {overview?.status_counts.stressed ?? 0}
            </p>
            <p style={{ fontSize: "11px", color: "var(--cc-muted)" }}>Stressed</p>
          </div>
          <div style={{ ...CHART_WRAP, padding: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "22px", fontWeight: 600, color: "#ef4444", fontFamily: "var(--cc-mono)", fontVariantNumeric: "tabular-nums" }}>
              {overview?.status_counts.critical ?? 0}
            </p>
            <p style={{ fontSize: "11px", color: "var(--cc-muted)" }}>Critical</p>
          </div>
        </div>
      </div>
    </div>
  );
}
