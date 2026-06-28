"use client";

import { useState } from "react";
import { OverviewSection } from "@/components/city/OverviewSection";
import { NoiseSection } from "@/components/city/NoiseSection";
import { ActivitySection } from "@/components/city/ActivitySection";
import { HeatSection } from "@/components/city/HeatSection";
import { RoutesSection } from "@/components/city/RoutesSection";

type Section = "overview" | "noise" | "activity" | "heat" | "routes";

const TABS: { id: Section; label: string; color: string }[] = [
  { id: "overview",  label: "Overview",       color: "#16a34a" },
  { id: "noise",     label: "Noise Analysis", color: "#d97706" },
  { id: "activity",  label: "Activity",       color: "#0284c7" },
  { id: "heat",      label: "Heat Islands",   color: "#ea580c" },
  { id: "routes",    label: "Watering Routes", color: "#3b82f6" },
];

export default function CityPage() {
  const [active, setActive] = useState<Section>("overview");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: "44px",
          borderBottom: "1px solid var(--cc-border)",
          background: "var(--cc-surface)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "14px", letterSpacing: "-0.01em" }}>BeTree</span>
          <span style={{ color: "var(--cc-muted2, #3d5166)", fontSize: "13px" }}>|</span>
          <span style={{ color: "var(--cc-muted)", fontSize: "12px" }}>
            Stadtdaten Karlsruhe — City Intelligence Platform
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--cc-muted)" }}>
          <span style={{ color: "#16a34a" }}>●</span>
          <span>28 sensors live</span>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav
        style={{
          display: "flex",
          padding: "0 24px",
          borderBottom: "1px solid var(--cc-border)",
          background: "var(--cc-surface)",
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              style={{
                padding: "10px 18px",
                paddingBottom: "9px",
                fontSize: "12px",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--cc-text)" : "var(--cc-muted)",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                borderBottom: isActive ? `2px solid ${tab.color}` : "2px solid transparent",
                marginBottom: "-1px",
                background: "none",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, overflow: "hidden", padding: "24px", background: "var(--cc-bg)" }}>
        {active === "overview"  && <OverviewSection />}
        {active === "noise"     && <NoiseSection />}
        {active === "activity"  && <ActivitySection />}
        {active === "heat"      && <HeatSection />}
        {active === "routes"    && <RoutesSection />}
      </main>
    </div>
  );
}
