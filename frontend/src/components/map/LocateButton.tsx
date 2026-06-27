"use client";
import { Locate } from "lucide-react";
import type { MapRef } from "react-map-gl/maplibre";
import { useBetreeStore } from "@/store/useBetreeStore";

interface Props {
  mapRef: React.RefObject<MapRef | null>;
}

export function LocateButton({ mapRef }: Props) {
  const userLat = useBetreeStore((s) => s.userLat);
  const userLng = useBetreeStore((s) => s.userLng);

  const handler = () => {
    // If we already have a position from watchPosition, use it immediately.
    if (userLat != null && userLng != null) {
      mapRef.current?.getMap().flyTo({
        center: [userLng, userLat],
        zoom: 17,
        duration: 900,
      });
      return;
    }
    // Fallback: request a fresh fix.
    navigator.geolocation?.getCurrentPosition((pos) => {
      mapRef.current?.getMap().flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 17,
        duration: 900,
      });
    });
  };

  return (
    <button
      onClick={handler}
      className="w-10 h-10 flex items-center justify-center rounded-full bg-background/90 backdrop-blur border border-border shadow-sm text-foreground hover:text-primary transition-colors"
      aria-label="Show my location"
    >
      <Locate size={18} />
    </button>
  );
}
