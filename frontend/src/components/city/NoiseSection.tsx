"use client";

import { useEffect, useState } from "react";
import { fetchCityMap, fetchTimeSeries, fetchProfile } from "@/lib/api/city";
import type { CityMapResponse, TimeSeriesResponse, ProfileResponse } from "@/lib/types";
import { KpiCard } from "./KpiCard";
import { CityMap } from "./CityMap";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { ProfileChart } from "./ProfileChart";
import { DeptInsight } from "./DeptInsight";

const TEMPO30_TREE = "KA-00004";
const TEMPO30_DATE = "2026-05-15";

const CHART_WRAP: React.CSSProperties = {
  background: "var(--cc-surface)",
  border: "1px solid var(--cc-border)",
  borderRadius: "4px",
  padding: "14px 16px",
};

export function NoiseSection() {
  const [mapData, setMapData] = useState<CityMapResponse | null>(null);
  const [series, setSeries] = useState<TimeSeriesResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);

  useEffect(() => {
    fetchCityMap("noise", 7).then(setMapData).catch(() => {});
    fetchTimeSeries("noise", "day", { days: 90 }).then(setSeries).catch(() => {});
    fetchProfile("noise", "hour_of_day", { tree_id: TEMPO30_TREE }).then(setProfile).catch(() => {});
  }, []);

  const avgNoise = series
    ? series.series.reduce((s, r) => s + (r.value ?? 0), 0) / (series.series.length || 1)
    : null;
  const peakNoise = series
    ? Math.max(...series.series.map((r) => r.max ?? r.value ?? 0))
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="h-[420px] lg:h-full">
        <CityMap points={mapData?.points ?? []} metric="noise" />
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--cc-text)" }}>Noise Analysis</h2>
          <span style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "#d97706" }}>
            Umweltamt
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="90-day avg noise"
            value={avgNoise != null ? `${avgNoise.toFixed(1)} dB` : "—"}
            sub="city-wide average"
            accent="noise"
          />
          <KpiCard
            label="Peak rush-hour noise"
            value={peakNoise != null ? `${peakNoise.toFixed(1)} dB` : "—"}
            sub="90-day maximum"
            accent="noise"
          />
        </div>

        <DeptInsight
          dept="Umweltamt"
          question="Did the Tempo 30 zone on the B36 reduce noise levels in adjacent residential streets?"
          answer="Sensor data shows a measurable step-down after 2026-05-15. The dashed line marks the policy change."
          accent="noise"
        />

        {series && (
          <div style={CHART_WRAP}>
            <p style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cc-muted)", marginBottom: "8px" }}>
              90-day noise trend — B36 sensor
            </p>
            <TimeSeriesChart
              series={series.series}
              color="#d97706"
              unit=" dB"
              events={[{ date: TEMPO30_DATE, label: "Tempo 30 in force" }]}
            />
          </div>
        )}

        {profile && (
          <div style={CHART_WRAP}>
            <p style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cc-muted)", marginBottom: "8px" }}>
              Rush-hour curve — avg by hour of day
            </p>
            <ProfileChart buckets={profile.buckets} color="#d97706" unit=" dB" />
          </div>
        )}
      </div>
    </div>
  );
}
