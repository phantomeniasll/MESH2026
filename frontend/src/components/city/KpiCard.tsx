interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "noise" | "activity" | "heat" | "moisture" | "default";
  delta?: string;
  deltaPositive?: boolean;
}

const ACCENT_COLORS: Record<string, string> = {
  noise:    "#d97706",
  activity: "#0284c7",
  heat:     "#ea580c",
  moisture: "#3b82f6",
  default:  "#16a34a",
};

export function KpiCard({ label, value, sub, accent = "default", delta, deltaPositive }: KpiCardProps) {
  const color = ACCENT_COLORS[accent] ?? ACCENT_COLORS.default;
  return (
    <div
      style={{
        background: "var(--cc-surface)",
        border: "1px solid var(--cc-border)",
        borderRadius: "4px",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <p style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cc-muted)" }}>
        {label}
      </p>
      <p style={{
        fontSize: "26px",
        fontWeight: 500,
        lineHeight: 1,
        color,
        fontFamily: "var(--cc-mono)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: "11px", color: "var(--cc-muted)" }}>{sub}</p>}
      {delta && (
        <p style={{ fontSize: "11px", fontWeight: 500, color: deltaPositive ? "#16a34a" : "#ef4444", fontFamily: "var(--cc-mono)" }}>
          {delta}
        </p>
      )}
    </div>
  );
}
