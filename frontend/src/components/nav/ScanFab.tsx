"use client";
import { LogoMark } from "@/components/brand/LogoMark";
import { useBetreeStore } from "@/store/useBetreeStore";

export function ScanFab() {
  const openScanFor = useBetreeStore((s) => s.openScanFor);
  return (
    <button
      onClick={(e) => {
        (e.currentTarget as HTMLButtonElement).blur();
        openScanFor(null);
      }}
      className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform -mt-5 focus-visible:outline-2 focus-visible:outline-primary"
      aria-label="Scan"
    >
      <LogoMark size={28} className="text-primary-foreground" />
    </button>
  );
}
