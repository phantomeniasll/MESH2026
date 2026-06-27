interface Props {
  value: number;
}

export function MoistureGauge({ value }: Props) {
  const color =
    value < 25
      ? "bg-primary"
      : value < 50
      ? "bg-amber-500"
      : "bg-[var(--verified)]";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Moisture</span>
        <span className="font-medium text-foreground">{value}%</span>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
