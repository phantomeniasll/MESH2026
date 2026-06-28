"use client";

import { useEffect, useState } from "react";
import { fetchCityMap, fetchTimeSeries, fetchProfile } from "@/lib/api/city";
import type { CityMapResponse, TimeSeriesResponse, ProfileResponse } from "@/lib/types";
import { KpiCard } from "./KpiCard";
import { CityMap } from "./CityMap";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { ProfileChart } from "./ProfileChart";
import { DeptInsight } from "./DeptInsight";

const PEDESTRIAN_TREE = "KA-00001";
const PEDESTRIAN_DATE = "2026-05-15";

const CHART_WRAP: React.CSSProperties = {
  background: "var(--cc-surface)",
  border: "1px solid var(--cc-border)",
  borderRadius: "4px",
  padding: "14px 16px",
};

export function ActivitySection() {
  const [mapData, setMapData] = useState<CityMapResponse | null>(null);
  const [series, setSeries] = useState<TimeSeriesResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);

  useEffect(() => {
    fetchCityMap("activity", 7).then(setMapData).catch(() => {});
    fetchTimeSeries("activity", "day", { days: 90 }).then(setSeries).catch(() => {});
    fetchProfile("activity", "day_of_week", { tree_id: PEDESTRIAN_TREE }).then(setProfile).catch(() => {});
  }, []);

  // Activity is a daily SUM (footfall total), so avg and peak must both come from
  // `value` — using the per-reading `max` here mixes scales and made the average
  // exceed the "maximum". Drop empty buckets (newest days dip to 0 before sensors
  // report) so they don't drag the average down.
  const activityVals = series
    ? series.series.map((r) => r.value).filter((v): v is number => v != null && v !== 0)
    : [];
  const avgActivity = activityVals.length
    ? activityVals.reduce((s, v) => s + v, 0) / activityVals.length
    : null;
  const peakActivity = activityVals.length ? Math.max(...activityVals) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="h-[420px] lg:h-full">
        <CityMap points={mapData?.points ?? []} metric="activity" />
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--cc-text)" }}>Activity Level</h2>
          <span style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "#0284c7" }}>
            Stadtplanung
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Avg pedestrian activity"
            value={avgActivity != null ? `${Math.round(avgActivity)}/hr` : "—"}
            sub="90-day city average"
            accent="activity"
          />
          <KpiCard
            label="Peak activity"
            value={peakActivity != null ? `${Math.round(peakActivity)}/hr` : "—"}
            sub="90-day maximum"
            accent="activity"
          />
        </div>

        <DeptInsight
          dept="Stadtplanung"
          question="Did pedestrianising Kaiserstraße increase foot traffic in the area?"
          answer="Sensor counts at the Marktplatz node rose significantly after 2026-05-15. The dashed line marks the street closure to vehicles."
          accent="activity"
        />

        {series && (
          <div style={CHART_WRAP}>
            <p style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cc-muted)", marginBottom: "8px" }}>
              90-day activity trend — Marktplatz sensor
            </p>
            <TimeSeriesChart
              series={series.series}
              color="#0284c7"
              unit=" steps/hr"
              events={[{ date: PEDESTRIAN_DATE, label: "Street pedestrianised" }]}
            />
          </div>
        )}

        {profile && (
          <div style={CHART_WRAP}>
            <p style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cc-muted)", marginBottom: "8px" }}>
              Weekday vs weekend — Sat/Sun highlighted
            </p>
            <ProfileChart buckets={profile.buckets} color="#0284c7" highlightWeekend />
          </div>
        )}
      </div>
    </div>
  );
}
