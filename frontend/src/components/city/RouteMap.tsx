"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MapGL, { Source, Layer, Marker, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PlanTree, SuggestedRoute } from "@/lib/routing/types";
import { cityMapStyle } from "@/lib/city/mapStyle";

const mapLibPromise = import("maplibre-gl");

interface RouteMapProps {
  trees: PlanTree[];
  routes: SuggestedRoute[];
  selectedIndex: number | null;
  onSelectRoute?: (index: number | null) => void;
}

export function RouteMap({ trees, routes, selectedIndex, onSelectRoute }: RouteMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [ready, setReady] = useState(false);

  // All critical trees as faint context dots.
  const treesFC = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: trees.map((t) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [t.lng, t.lat] as [number, number] },
        properties: { id: t.id },
      })),
    }),
    [trees],
  );

  // One LineString per route, with display width/opacity baked into properties.
  const anySelected = selectedIndex != null;
  const routesFC = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: routes
        .filter((r) => r.stops.length >= 2)
        .map((r) => {
          const selected = anySelected && r.index === selectedIndex;
          return {
            type: "Feature" as const,
            geometry: {
              type: "LineString" as const,
              coordinates: r.stops.map((s) => [s.lng, s.lat] as [number, number]),
            },
            properties: {
              index: r.index,
              color: r.color,
              width: selected ? 6 : anySelected ? 2 : 3.5,
              opacity: anySelected && !selected ? 0.25 : 0.9,
            },
          };
        }),
    }),
    [routes, selectedIndex, anySelected],
  );

  // Numbered stop markers — only for the selected route, to keep the DOM light.
  const selectedRoute = selectedIndex != null ? routes[selectedIndex] : null;

  // Fit the viewport to the critical trees whenever the set changes.
  useEffect(() => {
    if (!ready || trees.length === 0) return;
    const map = mapRef.current;
    if (!map) return;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const t of trees) {
      minLng = Math.min(minLng, t.lng);
      minLat = Math.min(minLat, t.lat);
      maxLng = Math.max(maxLng, t.lng);
      maxLat = Math.max(maxLat, t.lat);
    }
    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 56, maxZoom: 15, duration: 600 },
    );
  }, [ready, trees]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <MapGL
        ref={mapRef}
        mapLib={mapLibPromise}
        initialViewState={{ longitude: 8.4037, latitude: 49.0069, zoom: 12 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={cityMapStyle()}
        onLoad={() => setReady(true)}
        interactiveLayerIds={["route-lines"]}
        onClick={(e) => {
          const f = e.features?.[0];
          if (f && typeof f.properties?.index === "number") {
            onSelectRoute?.(f.properties.index as number);
          } else {
            onSelectRoute?.(null);
          }
        }}
        attributionControl={false}
      >
        {/* Critical-tree context dots */}
        {treesFC.features.length > 0 && (
          <Source id="route-trees" type="geojson" data={treesFC}>
            <Layer
              id="route-tree-dots"
              type="circle"
              paint={{
                "circle-radius": 3.5,
                "circle-color": "#ef4444",
                "circle-opacity": 0.55,
                "circle-stroke-color": "#1f2937",
                "circle-stroke-width": 1,
              }}
            />
          </Source>
        )}

        {/* Route polylines */}
        {routesFC.features.length > 0 && (
          <Source id="route-lines-src" type="geojson" data={routesFC}>
            <Layer
              id="route-lines"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": ["get", "color"],
                "line-width": ["get", "width"],
                "line-opacity": ["get", "opacity"],
              }}
            />
          </Source>
        )}

        {/* Numbered stops for the selected route */}
        {selectedRoute?.stops.map((s) => (
          <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="center">
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: selectedRoute.color,
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid #ffffff",
                boxShadow: "0 1px 3px rgba(15,23,42,0.35)",
              }}
            >
              {s.order}
            </div>
          </Marker>
        ))}
      </MapGL>

      {/* Legend */}
      <div
        className="absolute bottom-3 left-3 flex items-center gap-1.5 backdrop-blur-sm rounded-lg px-3 py-2"
        style={{ background: "rgba(255,255,255,0.9)", border: "1px solid var(--cc-border)", boxShadow: "0 1px 3px rgba(15,23,42,0.08)" }}
      >
        <div className="w-3 h-3 rounded-full" style={{ background: "#ef4444", opacity: 0.7 }} />
        <span className="text-[10px]" style={{ color: "var(--cc-muted)" }}>Critical tree</span>
        <span className="text-xs" style={{ color: "var(--cc-muted2)" }}>·</span>
        <span className="text-[10px]" style={{ color: "var(--cc-muted)" }}>Lines = suggested truck routes</span>
      </div>
    </div>
  );
}
