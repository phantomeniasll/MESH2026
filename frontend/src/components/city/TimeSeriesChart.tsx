"use client";

import { useMemo } from "react";
import type { TimeSeriesPoint } from "@/lib/types";

interface ChartEvent {
  date: string;
  label: string;
}

interface TimeSeriesChartProps {
  series: TimeSeriesPoint[];
  color?: string;
  label?: string;
  unit?: string;
  height?: number;
  events?: ChartEvent[];
}

export function TimeSeriesChart({
  series,
  color = "#16a34a",
  label,
  unit = "",
  height = 120,
  events,
}: TimeSeriesChartProps) {
  const { path, xLabels, yLabels, eventLines, W, H, PAD } = useMemo(() => {
    const W = 520;
    const H = height;
    const PAD = { top: 8, right: 8, bottom: 24, left: 36 };
    const inner = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom };

    // Treat null, 0, AND partial buckets as "no reading". The newest buckets often
    // carry 0 (sensors haven't reported) or a fraction of a real value (still
    // filling in); both crash the line to the axis. A point counts as missing if
    // it's below 10% of the average of the real (non-null, non-zero) values.
    const nonZeroVals = series.map((s) => s.value).filter((v): v is number => v !== null && v !== 0);
    const avgVal = nonZeroVals.length ? nonZeroVals.reduce((a, b) => a + b, 0) / nonZeroVals.length : 0;
    const floor = avgVal * 0.1;
    const missing = (v: number | null) => v === null || v === 0 || v < floor;

    const realVals = nonZeroVals.filter((v) => v >= floor);
    const minV = realVals.length ? Math.min(...realVals) : 0;
    const maxV = realVals.length ? Math.max(...realVals) : 1;
    const range = maxV - minV || 1;

    const toX = (i: number) => PAD.left + (i / Math.max(series.length - 1, 1)) * inner.w;
    const toY = (v: number) => PAD.top + inner.h - ((v - minV) / range) * inner.h;

    // Build path, lifting the pen over missing points rather than drawing to the axis.
    let path = "";
    for (let i = 0; i < series.length; i++) {
      const v = series[i].value;
      if (v === null || v === 0 || v < floor) continue; // inline so TS narrows v to number
      const cmd = path === "" ? "M" : (missing(series[i - 1]?.value ?? null) ? " M" : " L");
      path += `${cmd} ${toX(i)},${toY(v)}`;
    }

    // X labels: ~5 evenly spaced
    const step = Math.max(1, Math.floor(series.length / 5));
    const xLabels = series
      .filter((_, i) => i % step === 0 || i === series.length - 1)
      .map((s) => {
        const idx = series.indexOf(s);
        const short = s.t.length === 10 ? s.t.slice(5) : s.t.slice(11, 16);
        return { x: toX(idx), label: short };
      });

    // Y labels: 3 ticks
    const yLabels = [0, 0.5, 1].map((t) => ({
      y: PAD.top + inner.h * (1 - t),
      label: String(Math.round(minV + t * range)),
    }));

    // Annotation event lines — alternate label heights to avoid overlap, anchor away from edge
    const eventLines = (events ?? []).flatMap((ev, evIdx) => {
      const idx = series.findIndex((s) => s.t >= ev.date);
      if (idx < 0) return [];
      const x = toX(idx);
      const nearRight = x > W * 0.7;
      return [{
        x,
        label: ev.label,
        labelX: nearRight ? x - 5 : x + 5,
        anchor: nearRight ? "end" : "start",
        yLabel: PAD.top + 9 + (evIdx % 2) * 14,
      }];
    });

    return { path, xLabels, yLabels, eventLines, W, H, PAD };
  }, [series, height, events]);

  if (!series.length) return (
    <div style={{ height: "120px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--cc-muted)" }}>
      No data
    </div>
  );

  return (
    <div className="w-full">
      {label && <p style={{ fontSize: "11px", marginBottom: "4px", color: "var(--cc-muted)" }}>{label}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        {/* Y gridlines */}
        {yLabels.map((yl) => (
          <g key={yl.label}>
            <line x1={36} y1={yl.y} x2={W - 8} y2={yl.y} stroke="var(--cc-border)" strokeWidth={0.5} />
            <text x={32} y={yl.y + 4} textAnchor="end" fontSize={9} fill="var(--cc-muted)">
              {yl.label}{unit}
            </text>
          </g>
        ))}
        {/* Line */}
        {path && <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />}
        {/* X labels */}
        {xLabels.map((xl) => (
          <text key={xl.x} x={xl.x} y={H - 4} textAnchor="middle" fontSize={8} fill="var(--cc-muted)">
            {xl.label}
          </text>
        ))}
        {/* Annotation event lines */}
        {eventLines.map((ev) => (
          <g key={ev.label}>
            <line
              x1={ev.x} y1={PAD.top} x2={ev.x} y2={H - PAD.bottom}
              stroke="var(--cc-muted2)" strokeWidth={1} strokeDasharray="4,3"
            />
            <text
              x={ev.labelX} y={ev.yLabel}
              textAnchor={ev.anchor as "start" | "end"}
              fontSize={8} fill="var(--cc-muted)"
            >
              {ev.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
