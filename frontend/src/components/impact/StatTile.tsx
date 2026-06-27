interface Props {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}

export function StatTile({ label, value, sub, icon }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="text-muted-foreground">{icon}</div>
      <p className="font-heading text-2xl font-bold text-foreground">{value}</p>
      <div>
        <p className="text-xs font-medium">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
