"use client";

import { useMemo } from "react";
import type { ProfileBucket } from "@/lib/types";

interface ProfileChartProps {
  buckets: ProfileBucket[];
  color?: string;
  unit?: string;
  height?: number;
  highlightWeekend?: boolean;
}

export function ProfileChart({
  buckets,
  color = "#34d399",
  unit = "",
  height = 100,
  highlightWeekend = false,
}: ProfileChartProps) {
  const { bars, yLabels, W, H } = useMemo(() => {
    const W = 520;
    const H = height;
    const PAD = { top: 8, right: 8, bottom: 20, left: 36 };
    const inner = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom };

    const vals = buckets.map((b) => b.value ?? 0);
    // Floor from non-zero values only — a broken/null bar doesn't compress the visible range
    const nonZeroVals = vals.filter((v) => v > 0);
    const minV = nonZeroVals.length ? Math.min(...nonZeroVals) * 0.8 : 0;
    const maxV = Math.max(...vals) || 1;
    const range = maxV - minV || 1;

    const barW = inner.w / buckets.length;
    const bars = buckets.map((b, i) => {
      const v = b.value ?? 0;
      const barH = ((v - minV) / range) * inner.h;
      return {
        x: PAD.left + i * barW,
        y: PAD.top + inner.h - barH,
        h: barH,
        w: barW * 0.78,
        label: b.label,
        value: v,
        isWeekend: highlightWeekend && (i === 5 || i === 6),
        showLabel: buckets.length <= 10 || i % 6 === 0,
      };
    });

    const yLabels = [0, 0.5, 1].map((t) => ({
      y: PAD.top + inner.h * (1 - t),
      label: String(Math.round(minV + t * range)),
    }));

    return { bars, yLabels, W, H };
  }, [buckets, height, highlightWeekend]);

  if (!buckets.length) return null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {yLabels.map((yl) => (
        <g key={yl.label}>
          <line x1={36} y1={yl.y} x2={W - 8} y2={yl.y} stroke="var(--cc-border)" strokeWidth={0.5} />
          <text x={32} y={yl.y + 4} textAnchor="end" fontSize={9} fill="var(--cc-muted)">
            {yl.label}{unit}
          </text>
        </g>
      ))}
      {bars.map((b) => (
        <g key={b.label}>
          <rect
            x={b.x + (b.w * 0.11)}
            y={b.y}
            width={b.w}
            height={Math.max(2, b.h)}
            fill={b.isWeekend ? "#0284c7" : color}
            fillOpacity={b.isWeekend ? 0.85 : 0.75}
            rx={2}
          />
          {b.showLabel && (
            <text x={b.x + b.w * 0.6} y={H - 4} textAnchor="middle" fontSize={8} fill="var(--cc-muted)">
              {b.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
