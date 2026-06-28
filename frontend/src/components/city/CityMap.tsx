"use client";

import { useRef, useState, useMemo } from "react";
import MapGL, { Source, Layer, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildIdwRaster, colorFnFor } from "@/lib/heatmap";
import type { CityMapPoint, CityMetric } from "@/lib/types";
import { cityMapStyle } from "@/lib/city/mapStyle";

const mapLibPromise = import("maplibre-gl");

interface LegendEntry { label: string; color: string }

const LEGENDS: Record<CityMetric, LegendEntry[]> = {
  noise:    [{ label: "Quiet", color: "#34d399" }, { label: "Moderate", color: "#fbbf24" }, { label: "Loud", color: "#ef4444" }],
  activity: [{ label: "Low", color: "#0f172a" }, { label: "Medium", color: "#06b6d4" }, { label: "High", color: "#f0f9ff" }],
  heat:     [{ label: "Cool", color: "#34d399" }, { label: "Warm", color: "#fb923c" }, { label: "Hot", color: "#ef4444" }],
  moisture: [{ label: "Dry", color: "#c8b48c" }, { label: "Moist", color: "#7daff0" }, { label: "Wet", color: "#1d4ed8" }],
};

interface CityMapProps {
  points: CityMapPoint[];
  metric: CityMetric;
}

export function CityMap({ points, metric }: CityMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [ready, setReady] = useState(false);

  const heatmapPoints = useMemo(
    () => points.map((p) => ({ lng: p.lng, lat: p.lat, value: p.value })),
    [points],
  );

  const overlayImage = useMemo(() => {
    if (!ready || heatmapPoints.length === 0) return null;
    return buildIdwRaster(heatmapPoints, colorFnFor(metric), { size: 200, alpha: 200 });
  }, [ready, heatmapPoints, metric]);

  // GeoJSON for the tree dot layer
  const pointsFC = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: points.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] as [number, number] },
      properties: { name: p.name, value: p.value, neighborhood: p.neighborhood },
    })),
  }), [points]);

  const legend = LEGENDS[metric];

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <MapGL
        ref={mapRef}
        mapLib={mapLibPromise}
        initialViewState={{ longitude: 8.4037, latitude: 49.0069, zoom: 12 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={cityMapStyle()}
        onLoad={() => setReady(true)}
        attributionControl={false}
      >
        {overlayImage && (
          <Source type="image" url={overlayImage.url} coordinates={overlayImage.coords}>
            <Layer id="city-overlay" type="raster" paint={{ "raster-opacity": 0.8, "raster-fade-duration": 0 }} />
          </Source>
        )}
        {pointsFC.features.length > 0 && (
          <Source id="city-points" type="geojson" data={pointsFC}>
            <Layer
              id="city-dots"
              type="circle"
              paint={{
                "circle-radius": 5,
                "circle-color": "#fff",
                "circle-opacity": 0.9,
                "circle-stroke-color": "#1f2937",
                "circle-stroke-width": 1,
              }}
            />
          </Source>
        )}
      </MapGL>

      {/* Legend */}
      <div
        className="absolute bottom-3 left-3 flex items-center gap-1.5 backdrop-blur-sm rounded-lg px-3 py-2"
        style={{ background: "rgba(255,255,255,0.9)", border: "1px solid var(--cc-border)", boxShadow: "0 1px 3px rgba(15,23,42,0.08)" }}
      >
        {legend.map((entry, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: entry.color }} />
            <span className="text-[10px]" style={{ color: "var(--cc-muted)" }}>{entry.label}</span>
            {i < legend.length - 1 && <span className="text-xs" style={{ color: "var(--cc-muted2)" }}>·</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
