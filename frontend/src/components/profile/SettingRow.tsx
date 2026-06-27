interface Props {
  label: string;
  children: React.ReactNode;
}

export function SettingRow({ label, children }: Props) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}
