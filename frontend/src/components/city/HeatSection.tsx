"use client";

import { useEffect, useState } from "react";
import { fetchCityMap, fetchTimeSeries, fetchProfile } from "@/lib/api/city";
import type { CityMapResponse, TimeSeriesResponse, ProfileResponse } from "@/lib/types";
import { KpiCard } from "./KpiCard";
import { CityMap } from "./CityMap";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { ProfileChart } from "./ProfileChart";
import { DeptInsight } from "./DeptInsight";

const HEAT_ISLAND_TREE = "KA-00003";
const COOL_TREE        = "KA-00002";

const CHART_WRAP: React.CSSProperties = {
  background: "var(--cc-surface)",
  border: "1px solid var(--cc-border)",
  borderRadius: "4px",
  padding: "14px 16px",
};

export function HeatSection() {
  const [mapData, setMapData] = useState<CityMapResponse | null>(null);
  const [hotSeries, setHotSeries] = useState<TimeSeriesResponse | null>(null);
  const [coolSeries, setCoolSeries] = useState<TimeSeriesResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);

  useEffect(() => {
    fetchCityMap("heat", 7).then(setMapData).catch(() => {});
    fetchTimeSeries("heat", "day", { tree_id: HEAT_ISLAND_TREE, days: 90 }).then(setHotSeries).catch(() => {});
    fetchTimeSeries("heat", "day", { tree_id: COOL_TREE, days: 90 }).then(setCoolSeries).catch(() => {});
    fetchProfile("heat", "hour_of_day", { tree_id: HEAT_ISLAND_TREE }).then(setProfile).catch(() => {});
  }, []);

  const hotAvg = hotSeries
    ? hotSeries.series.reduce((s, r) => s + (r.value ?? 0), 0) / (hotSeries.series.length || 1)
    : null;
  const coolAvg = coolSeries
    ? coolSeries.series.reduce((s, r) => s + (r.value ?? 0), 0) / (coolSeries.series.length || 1)
    : null;
  const delta = hotAvg != null && coolAvg != null ? hotAvg - coolAvg : null;

  const hotPeak = hotSeries
    ? Math.max(...hotSeries.series.map((r) => r.max ?? r.value ?? 0))
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="h-[420px] lg:h-full">
        <CityMap points={mapData?.points ?? []} metric="heat" />
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--cc-text)" }}>Heat Islands</h2>
          <span style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "#ea580c" }}>
            Gesundheitsamt · Umweltamt
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Heat-island offset"
            value={delta != null ? `+${delta.toFixed(1)}°C` : "—"}
            sub="Südstadt vs Schlossgarten"
            accent="heat"
          />
          <KpiCard
            label="Peak temp (heatwave)"
            value={hotPeak != null ? `${hotPeak.toFixed(1)}°C` : "—"}
            sub="Südstadt sensor"
            accent="heat"
          />
        </div>

        <DeptInsight
          dept="Gesundheitsamt"
          question="Which neighbourhoods exceeded safe temperatures during the June 2026 heat wave?"
          answer={hotPeak != null
            ? `Südstadt reached ${hotPeak.toFixed(1)}°C — ${delta?.toFixed(1) ?? "?"}°C above the Schlossgarten park sensor. Priority cooling centre zone.`
            : "Loading data…"}
          accent="heat"
        />

        {hotSeries && coolSeries && (
          <div style={CHART_WRAP}>
            <p style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cc-muted)", marginBottom: "4px" }}>
              90-day temperature comparison
            </p>
            <p style={{ fontSize: "10px", color: "var(--cc-muted)", marginBottom: "8px" }}>
              <span style={{ color: "#ea580c" }}>■</span> Südstadt &nbsp;
              <span style={{ color: "#16a34a" }}>■</span> Schlossgarten
            </p>
            <TimeSeriesChart series={hotSeries.series} color="#ea580c" unit="°C" />
            <div style={{ marginTop: "4px" }}>
              <TimeSeriesChart series={coolSeries.series} color="#16a34a" unit="°C" />
            </div>
          </div>
        )}

        {profile && (
          <div style={CHART_WRAP}>
            <p style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cc-muted)", marginBottom: "8px" }}>
              Diurnal pattern — peak at ~15h
            </p>
            <ProfileChart buckets={profile.buckets} color="#ea580c" unit="°C" />
          </div>
        )}
      </div>
    </div>
  );
}
