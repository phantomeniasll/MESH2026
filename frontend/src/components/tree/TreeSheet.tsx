"use client";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { X, Heart, Navigation2 } from "lucide-react";
import { useBetreeStore } from "@/store/useBetreeStore";
import { formatRelativeTime } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { TreeRingViz } from "./TreeRingViz";
import { SoilWaterViz } from "./SoilWaterViz";
import type { TreeFeature } from "@/lib/types";

interface Props {
  tree: TreeFeature | null;
  open: boolean;
  onClose: () => void;
}

export function TreeSheet({ tree, open, onClose }: Props) {
  const openScanFor = useBetreeStore((s) => s.openScanFor);
  const lang = useBetreeStore((s) => s.lang);
  const wateredTreeIds = useBetreeStore((s) => s.wateredTreeIds);
  const favorites = useBetreeStore((s) => s.favorites);
  const toggleFavorite = useBetreeStore((s) => s.toggleFavorite);
  const userLat = useBetreeStore((s) => s.userLat);
  const userLng = useBetreeStore((s) => s.userLng);
  const setNavigateTarget = useBetreeStore((s) => s.setNavigateTarget);
  const userId = useBetreeStore((s) => s.userId);
  const t = getDict(lang);
  const p = tree?.properties;

  if (!p) return null;

  const isWatered = wateredTreeIds.has(p.id);
  const isFav = favorites.has(p.id);
  const canNavigate = userLat !== null && userLng !== null;
  const treeLat = tree?.geometry?.coordinates[1] as number | undefined;
  const treeLng = tree?.geometry?.coordinates[0] as number | undefined;

  function handleNavigate() {
    if (!canNavigate || treeLat == null || treeLng == null) return;
    setNavigateTarget({ lat: treeLat, lng: treeLng, treeId: p!.id });
    onClose();
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="flex flex-col max-h-[90dvh]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Species header — top-left */}
        <div className="px-4 pt-3 pb-2 shrink-0 pr-12">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-heading text-xl leading-tight">{p.species}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{p.neighborhood} · {p.id}</p>
            </div>
            {/* Favorite toggle */}
            {userId && (
              <button
                onClick={() => toggleFavorite(p.id)}
                className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full border transition-all ${isFav ? "bg-rose-50 border-rose-300 text-rose-500 dark:bg-rose-950/30" : "border-border text-muted-foreground hover:text-rose-400"}`}
                aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
              >
                <Heart size={16} fill={isFav ? "currentColor" : "none"} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2">

          {/* Main row */}
          <div className="grid grid-cols-[5fr_7fr] gap-2">
            <div className="flex flex-col gap-1.5">
              <div className="bg-muted rounded-xl overflow-hidden h-52">
                <SoilWaterViz moisture={p.moisture} isWatered={isWatered} litersPerDay={p.litersPerDay} />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {p.litersPerDay} L / day
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="bg-muted rounded-xl p-3 h-52 flex items-center">
                <TreeRingViz ageYears={p.ageYears} treeId={p.id} />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                since {p.plantedYear}
              </p>
            </div>
          </div>

          {/* CO₂ and cooling */}
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="CO₂ absorbed" value={`~${p.ageYears * 12} kg`} />
            <StatTile label="Cooling effect" value={`~${Math.round(p.litersPerDay * 0.7)} kWh`} />
          </div>

          {/* Last watered */}
          <p className="text-xs text-muted-foreground text-center">
            {t.lastWatered}:{" "}
            {p.lastWatered == null && !isWatered
              ? "never"
              : formatRelativeTime(isWatered ? new Date().toISOString() : p.lastWatered!)}
          </p>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              size="lg"
              disabled={isWatered}
              onClick={() => {
                onClose();
                openScanFor(p.id);
              }}
            >
              {isWatered ? "Watered today ✓" : t.waterThisTree}
            </Button>
            {canNavigate && treeLat != null && (
              <Button
                size="lg"
                variant="outline"
                onClick={handleNavigate}
                className="shrink-0 gap-1.5"
              >
                <Navigation2 size={15} />
                Route
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted rounded-xl p-3 flex flex-col gap-0.5">
      <span className="text-base font-bold tabular-nums leading-none">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}
