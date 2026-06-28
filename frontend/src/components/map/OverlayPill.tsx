"use client";
import type { Overlay } from "@/store/useBetreeStore";

interface Props {
  value: Overlay;
  onChange: (v: Overlay) => void;
}

const options: { value: Overlay; label: string }[] = [
  { value: "none", label: "None" },
  { value: "moisture", label: "Moisture" },
  { value: "heat", label: "Heat" },
];

export function OverlayPill({ value, onChange }: Props) {
  return (
    <div className="flex bg-background/90 backdrop-blur rounded-full border border-border shadow-sm overflow-hidden text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
