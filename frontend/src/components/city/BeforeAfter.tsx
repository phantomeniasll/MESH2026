interface BeforeAfterProps {
  label: string;
  beforeVal: number | null;
  afterVal: number | null;
  delta: number | null;
  deltaPct: number | null;
  unit?: string;
  accent?: "noise" | "activity" | "heat";
}

const ACCENT: Record<string, string> = {
  noise:    "bg-amber-500",
  activity: "bg-cyan-600",
  heat:     "bg-orange-500",
};

export function BeforeAfter({ label, beforeVal, afterVal, delta, deltaPct, unit = "", accent = "noise" }: BeforeAfterProps) {
  const barClass = ACCENT[accent];
  const maxVal = Math.max(beforeVal ?? 0, afterVal ?? 0) || 1;
  const improved = accent === "noise" || accent === "heat" ? (delta ?? 0) < 0 : (delta ?? 0) > 0;

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--cc-muted)" }}>{label}</p>
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-xs" style={{ color: "var(--cc-muted)" }}>
            <span>Before</span>
            <span className="font-mono">{beforeVal != null ? `${beforeVal}${unit}` : "—"}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--cc-surface2)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${((beforeVal ?? 0) / maxVal) * 100}%`, background: "var(--cc-muted2)" }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs" style={{ color: "var(--cc-muted)" }}>
            <span>After</span>
            <span className="font-mono">{afterVal != null ? `${afterVal}${unit}` : "—"}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--cc-surface2)" }}>
            <div
              className={`h-full ${barClass} rounded-full`}
              style={{ width: `${((afterVal ?? 0) / maxVal) * 100}%` }}
            />
          </div>
        </div>
      </div>
      {delta != null && deltaPct != null && (
        <p className="text-sm font-bold" style={{ color: improved ? "#15803d" : "#dc2626" }}>
          {delta > 0 ? "+" : ""}{delta}{unit} ({deltaPct > 0 ? "+" : ""}{deltaPct}%)
        </p>
      )}
    </div>
  );
}
