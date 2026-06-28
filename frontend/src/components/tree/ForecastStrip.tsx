"use client";
import { Droplets, CloudRain, CheckCircle2 } from "lucide-react";
import type { TreeForecast } from "@/lib/api/trees";

function weekday(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
}

interface Headline {
  icon: React.ReactNode;
  text: string;
  tone: string; // tailwind text color
}

function headlineFor(fc: TreeForecast): Headline {
  const rainBeforeDry =
    fc.next_rain_at != null &&
    (fc.dry_by == null || fc.next_rain_at <= fc.dry_by);

  if (fc.will_refill && rainBeforeDry) {
    return {
      icon: <CloudRain size={15} />,
      text: `Rain ${weekday(fc.next_rain_at!)} will refill — can wait`,
      tone: "text-sky-600 dark:text-sky-400",
    };
  }
  if (fc.dry_in_hours == null) {
    return {
      icon: <CheckCircle2 size={15} />,
      text: "Healthy — no watering needed this week",
      tone: "text-[var(--verified)]",
    };
  }
  if (fc.dry_in_hours <= 1) {
    return {
      icon: <Droplets size={15} />,
      text: "Thirsty now — water today",
      tone: "text-amber-600 dark:text-amber-400",
    };
  }
  const when = fc.dry_by ? `by ${weekday(fc.dry_by)}` : `in ${fc.dry_in_hours}h`;
  return {
    icon: <Droplets size={15} />,
    text: `Needs water ${when}`,
    tone: "text-amber-600 dark:text-amber-400",
  };
}

interface Props {
  forecast: TreeForecast | null;
  loading: boolean;
}

export function ForecastStrip({ forecast, loading }: Props) {
  if (loading) {
    return <div className="bg-muted animate-pulse rounded-xl h-[68px]" />;
  }
  // Degrade silently if weather is unavailable or there's nothing to show.
  if (!forecast || forecast.source === "unavailable" || forecast.curve.length < 2) return null;

  const fc = forecast;
  const head = headlineFor(fc);

  // ── Sparkline (same inline-SVG pattern as VerifyView) ──
  const width = 300;
  const height = 36;
  const xs = fc.curve.length - 1;
  const points = fc.curve
    .map((p, i) => `${(i / xs) * width},${height - (p.m / 100) * height}`)
    .join(" ");
  const thresholdY = height - (fc.threshold / 100) * height;

  return (
    <div className="bg-muted rounded-xl p-3 flex flex-col gap-2">
      <div className={`flex items-center gap-1.5 text-sm font-medium ${head.tone}`}>
        {head.icon}
        <span>{head.text}</span>
        {fc.source === "modeled" && (
          <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground">
            modeled
          </span>
        )}
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line
          x1={0}
          y1={thresholdY}
          x2={width}
          y2={thresholdY}
          stroke="#2E9E63"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#1B5732"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>7-day forecast · dashed = thirsty</span>
        {fc.liters_per_day != null && (
          <span className="font-medium text-foreground">
            ≈ {fc.liters_per_day} L/day need
          </span>
        )}
      </div>
    </div>
  );
}
