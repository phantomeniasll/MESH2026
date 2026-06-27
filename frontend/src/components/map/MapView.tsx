"use client";
import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import MapGL, {
  Source,
  Layer,
  type MapRef,
  type MapMouseEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchMapTrees, fetchLiveOverrides, fetchRescueTrees } from "@/lib/api/trees";
import { type TreeFeature, type TreeFC, type TreeSummary } from "@/lib/types";
import { useBetreeStore } from "@/store/useBetreeStore";
import { OverlayPill } from "./OverlayPill";
import { LocateButton } from "./LocateButton";
import { TreeSheet } from "@/components/tree/TreeSheet";
import type { Overlay } from "@/store/useBetreeStore";
import type { GeoJSONSource } from "maplibre-gl";
import { Siren, X, Navigation2, AlertTriangle } from "lucide-react";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`
  : "https://tiles.openfreemap.org/styles/positron";

const mapLibPromise = import("maplibre-gl");
const FOREST = "#1B5732";
// Karlsruhe center fallback when no user location
const KA_LAT = 49.0069;
const KA_LNG = 8.4037;

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function heatRgb(t: number): [number, number, number] {
  const green: [number, number, number] = [34, 197, 94];
  const orange: [number, number, number] = [249, 115, 22];
  const red: [number, number, number] = [220, 38, 38];
  return t < 0.5 ? lerpColor(green, orange, t * 2) : lerpColor(orange, red, (t - 0.5) * 2);
}

function moistureRgb(t: number): [number, number, number] {
  const tan: [number, number, number]  = [200, 180, 140];
  const mid: [number, number, number]  = [125, 175, 220];
  const blue: [number, number, number] = [29,  78,  216];
  return t < 0.5 ? lerpColor(tan, mid, t * 2) : lerpColor(mid, blue, (t - 0.5) * 2);
}

function binTreesToCentroids(
  features: TreeFC["features"],
  fieldFn: (f: TreeFeature) => number
): { lng: number; lat: number; value: number }[] {
  const cells = new Map<
    string,
    { sumLng: number; sumLat: number; sumVal: number; count: number }
  >();
  for (const f of features) {
    const lng = f.geometry.coordinates[0] as number;
    const lat = f.geometry.coordinates[1] as number;
    const val = fieldFn(f);
    const cellKey = `${Math.round(lat / 0.00135)},${Math.round(lng / 0.00135)}`;
    const cell = cells.get(cellKey);
    if (cell) {
      cell.sumLng += lng;
      cell.sumLat += lat;
      cell.sumVal += val;
      cell.count++;
    } else {
      cells.set(cellKey, { sumLng: lng, sumLat: lat, sumVal: val, count: 1 });
    }
  }
  return Array.from(cells.values()).map(({ sumLng, sumLat, sumVal, count }) => ({
    lng: sumLng / count,
    lat: sumLat / count,
    value: sumVal / count,
  }));
}

async function fetchOsrmRoute(
  fromLat: number, fromLng: number,
  toLat: number,   toLng: number,
): Promise<GeoJSON.LineString | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.routes?.[0]?.geometry ?? null;
  } catch {
    return null;
  }
}

function statusColor(status: string) {
  if (status === "critical") return "text-red-500";
  if (status === "stressed") return "text-orange-500";
  return "text-muted-foreground";
}

export default function MapView() {
  const mapRef = useRef<MapRef | null>(null);
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [selectedTree, setSelectedTree] = useState<TreeFeature | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [treesFC, setTreesFC] = useState<TreeFC | null>(null);
  const wateredTreeIds = useBetreeStore((s) => s.wateredTreeIds);
  const setAppReady = useBetreeStore((s) => s.setAppReady);
  const appReady = useBetreeStore((s) => s.appReady);
  const setMapTreesFC = useBetreeStore((s) => s.setMapTreesFC);
  const userLat = useBetreeStore((s) => s.userLat);
  const userLng = useBetreeStore((s) => s.userLng);
  const setUserLocation = useBetreeStore((s) => s.setUserLocation);
  const navigateTarget = useBetreeStore((s) => s.navigateTarget);
  const setNavigateTarget = useBetreeStore((s) => s.setNavigateTarget);

  // Route state — geometry stored separately; routeFC gated on navigateTarget being set
  const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSON.LineString | null>(null);

  // Rescue panel state
  const [rescueOpen, setRescueOpen] = useState(false);
  const [rescueTrees, setRescueTrees] = useState<TreeSummary[]>([]);
  const [rescueLoading, setRescueLoading] = useState(false);

  // Watch user geolocation
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [setUserLocation]);

  // Auto-fly to user on first fix, but only once the map is loaded.
  // userLat/userLng may arrive before appReady, so we wait for both.
  const autoFlownRef = useRef(false);
  useEffect(() => {
    if (autoFlownRef.current || !appReady || userLat == null || userLng == null) return;
    autoFlownRef.current = true;
    mapRef.current?.getMap().flyTo({ center: [userLng, userLat], zoom: 17, duration: 1200 });
  }, [appReady, userLat, userLng]);

  // Fetch route when navigateTarget changes.
  // No synchronous setState — setRouteGeoJSON only called in the async .then() callback.
  useEffect(() => {
    if (!navigateTarget) return; // routeFC is gated on navigateTarget via useMemo below
    const lat = userLat ?? KA_LAT;
    const lng = userLng ?? KA_LNG;
    fetchOsrmRoute(lat, lng, navigateTarget.lat, navigateTarget.lng).then((geom) => {
      setRouteGeoJSON(geom);
      if (geom && mapRef.current) {
        mapRef.current.getMap().flyTo({
          center: [navigateTarget.lng, navigateTarget.lat],
          zoom: 16,
          duration: 1000,
        });
      }
    });
  }, [navigateTarget, userLat, userLng]);

  // User location GeoJSON
  const userLocationFC = useMemo((): GeoJSON.FeatureCollection | null => {
    if (userLat == null || userLng == null) return null;
    return {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [userLng, userLat] },
        properties: {},
      }],
    };
  }, [userLat, userLng]);

  // Route GeoJSON as FC — gated on navigateTarget so clearing the target hides the route
  // without needing a synchronous setState in the effect.
  const routeFC = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!routeGeoJSON || !navigateTarget) return null;
    return {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: routeGeoJSON,
        properties: {},
      }],
    };
  }, [routeGeoJSON, navigateTarget]);

  async function openRescue() {
    setRescueOpen(true);
    setRescueLoading(true);
    const lat = userLat ?? KA_LAT;
    const lng = userLng ?? KA_LNG;
    try {
      const trees = await fetchRescueTrees(lat, lng, 5);
      setRescueTrees(trees);
    } catch {
      setRescueTrees([]);
    } finally {
      setRescueLoading(false);
    }
  }

  function handleRescueNavigate(tree: TreeSummary) {
    setNavigateTarget({ lat: tree.latitude, lng: tree.longitude, treeId: tree.id });
    setRescueOpen(false);
  }

  function handleRescueFlyTo(tree: TreeSummary) {
    mapRef.current?.getMap().flyTo({
      center: [tree.longitude, tree.latitude],
      zoom: 17,
      duration: 800,
    });
    // Find the matching feature in the loaded FC and open the sheet
    const feature = treesFC?.features.find((f) => f.properties.id === tree.id) ?? null;
    if (feature) {
      setSelectedTree(feature);
      setSheetOpen(true);
    }
    setRescueOpen(false);
  }

  // Load tree data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fc = await fetchMapTrees();
        if (cancelled) return;
        try {
          const overrides = await fetchLiveOverrides();
          if (!cancelled) {
            const overrideMap = new Map(overrides.map((o) => [o.id, o]));
            for (const feature of fc.features) {
              const ov = overrideMap.get(feature.properties.id);
              if (ov) {
                feature.properties.moisture = ov.moisture;
                feature.properties.status = ov.status;
                feature.properties.needsWater = ov.moisture < 30;
              }
            }
          }
        } catch {
          // live overrides non-critical
        }
        if (!cancelled) {
          setTreesFC(fc);
          setMapTreesFC(fc);
        }
      } catch {
        // leave treesFC null
      }
    })();
    return () => { cancelled = true; };
  }, [setMapTreesFC]);

  useEffect(() => {
    if (!appReady || !treesFC) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    wateredTreeIds.forEach((id) => {
      map.setFeatureState({ source: "trees", id }, { watered: true });
    });
  }, [wateredTreeIds, appReady, treesFC]);

  const overlayImage = useMemo(() => {
    if (overlay === "none" || !treesFC || typeof document === "undefined") return null;

    const SIZE = 180;
    const pts = binTreesToCentroids(
      treesFC.features,
      (f) => overlay === "heat" ? f.properties.heat : f.properties.moisture
    );

    const lngs = pts.map((p) => p.lng);
    const lats = pts.map((p) => p.lat);
    const pad = 0.014;
    const minLng = Math.min(...lngs) - pad;
    const maxLng = Math.max(...lngs) + pad;
    const minLat = Math.min(...lats) - pad;
    const maxLat = Math.max(...lats) + pad;

    const vals = new Float32Array(SIZE * SIZE);
    let minV = Infinity, maxV = -Infinity;
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const lng = minLng + (px / SIZE) * (maxLng - minLng);
        const lat = maxLat - (py / SIZE) * (maxLat - minLat);
        let sumW = 0, acc = 0;
        for (const pt of pts) {
          const dx = lng - pt.lng, dy = lat - pt.lat;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1e-14) { acc = pt.value; sumW = 1; break; }
          const w = 1 / (d2 * d2 * d2);
          sumW += w;
          acc += w * pt.value;
        }
        const v = acc / sumW;
        vals[py * SIZE + px] = v;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    }

    const raw = document.createElement("canvas");
    raw.width = SIZE;
    raw.height = SIZE;
    const ctx = raw.getContext("2d")!;
    const img = ctx.createImageData(SIZE, SIZE);
    const range = maxV - minV || 1;
    for (let i = 0; i < SIZE * SIZE; i++) {
      const t = (vals[i] - minV) / range;
      const [r, g, b] = overlay === "heat" ? heatRgb(t) : moistureRgb(t);
      img.data[i * 4]     = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 210;
    }
    ctx.putImageData(img, 0, 0);

    const blurred = document.createElement("canvas");
    blurred.width = SIZE;
    blurred.height = SIZE;
    const bctx = blurred.getContext("2d")!;
    bctx.filter = "blur(6px)";
    bctx.drawImage(raw, 0, 0);
    bctx.filter = "none";

    const cx = SIZE / 2, cy = SIZE / 2;
    const grad = bctx.createRadialGradient(cx, cy, SIZE * 0.28, cx, cy, SIZE * 0.56);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    bctx.globalCompositeOperation = "destination-in";
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, SIZE, SIZE);

    return {
      url: blurred.toDataURL(),
      coords: [
        [minLng, maxLat],
        [maxLng, maxLat],
        [maxLng, minLat],
        [minLng, minLat],
      ] as [[number, number], [number, number], [number, number], [number, number]],
    };
  }, [overlay, treesFC]);

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const features = map.queryRenderedFeatures(e.point, {
        layers: ["unclustered-trees"],
      });

      if (features.length > 0) {
        const props = features[0].properties as TreeFeature["properties"];
        const geom = features[0].geometry as GeoJSON.Point;
        const syntheticTree: TreeFeature = {
          type: "Feature",
          geometry: geom,
          properties: props,
        };
        setSelectedTree(syntheticTree);
        setSheetOpen(true);
        return;
      }

      const clusterFeatures = map.queryRenderedFeatures(e.point, {
        layers: ["clusters"],
      });
      if (clusterFeatures.length > 0) {
        const clusterId = clusterFeatures[0].properties?.cluster_id as number;
        const source = map.getSource("trees") as GeoJSONSource | undefined;
        if (source) {
          source.getClusterExpansionZoom(clusterId).then((zoom) => {
            if (zoom == null) return;
            const coords = (
              clusterFeatures[0].geometry as GeoJSON.Point
            ).coordinates as [number, number];
            map.flyTo({ center: coords, zoom, duration: 500 });
          }).catch(() => {});
        }
      }
    },
    []
  );

  return (
    <div className="relative w-full h-full">
      <MapGL
        ref={mapRef}
        mapLib={mapLibPromise}
        initialViewState={{ longitude: KA_LNG, latitude: KA_LAT, zoom: 13 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        onClick={handleMapClick}
        onLoad={() => {
          setAppReady();
          const map = mapRef.current?.getMap();
          if (!map) return;
          const style = map.getStyle();
          const vecSrc = Object.keys(style.sources).find(
            (k) => (style.sources[k] as { type: string }).type === "vector"
          );
          if (!vecSrc) return;
          const firstSymbol = style.layers.find((l) => l.type === "symbol")?.id;
          const tints = [
            { id: "betree-green-landuse",   sl: "landuse",   filter: ["in", "class", "park", "grass", "garden", "pitch"] },
            { id: "betree-green-landcover", sl: "landcover", filter: ["in", "class", "grass", "wood", "farmland"] },
          ];
          tints.forEach(({ id, sl, filter }) => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              map.addLayer({ id, type: "fill", source: vecSrc, "source-layer": sl, filter: filter as any, paint: { "fill-color": "#1B5732", "fill-opacity": 0.16 } } as any, firstSymbol);
            } catch { /* source-layer absent */ }
          });
        }}
        cursor="auto"
        attributionControl={false}
        interactiveLayerIds={["clusters", "unclustered-trees"]}
      >
        {/* IDW raster overlay */}
        {overlayImage && (
          <Source type="image" url={overlayImage.url} coordinates={overlayImage.coords}>
            <Layer id="overlay-raster" type="raster" paint={{ "raster-opacity": 0.82, "raster-fade-duration": 0 }} />
          </Source>
        )}

        {/* User location — rendered BEFORE trees so tree dots paint on top of the halo */}
        {userLocationFC && (
          <Source id="user-location" type="geojson" data={userLocationFC}>
            <Layer id="user-location-halo" type="circle" paint={{
              "circle-color": "#3B82F6",
              "circle-radius": 16,
              "circle-opacity": 0.2,
            }} />
            <Layer id="user-location-dot" type="circle" paint={{
              "circle-color": "#3B82F6",
              "circle-radius": 8,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#fff",
            }} />
          </Source>
        )}

        {/* Tree data — after user-location so dots render on top of the halo */}
        {treesFC && (
          <Source id="trees" type="geojson" data={treesFC} promoteId="id" cluster clusterRadius={50} clusterMaxZoom={14}>
            <Layer id="clusters" type="circle" filter={["has", "point_count"]} paint={{
              "circle-color": FOREST,
              "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 50, 30],
              "circle-opacity": 0.9,
            }} />
            <Layer id="cluster-count" type="symbol" filter={["has", "point_count"]}
              layout={{ "text-field": ["get", "point_count_abbreviated"], "text-size": 13, "text-font": ["Noto Sans Bold"] }}
              paint={{ "text-color": "#FEF9E0" }}
            />
            <Layer id="unclustered-trees" type="circle" filter={["!", ["has", "point_count"]]} paint={{
              "circle-color": [
                "case",
                ["boolean", ["feature-state", "watered"], false], "#16A34A",
                ["interpolate", ["linear"], ["get", "moisture"],
                  0, "#DC2626", 20, "#EA580C", 40, "#CA8A04", 60, "#65A30D", 100, "#16A34A"],
              ],
              "circle-radius": 7,
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#FEF9E0",
            }} />
          </Source>
        )}

        {/* Walking route line */}
        {routeFC && (
          <Source id="route" type="geojson" data={routeFC}>
            <Layer id="route-line-casing" type="line" layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": "#fff", "line-width": 7, "line-opacity": 0.9 }}
            />
            <Layer id="route-line" type="line" layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": "#2563EB", "line-width": 4, "line-opacity": 0.95, "line-dasharray": [2, 1] }}
            />
          </Source>
        )}
      </MapGL>

      <div className="absolute top-4 left-4 z-10">
        <OverlayPill value={overlay} onChange={setOverlay} />
      </div>

      {/* FAB column — bottom-right, locate on top, rescue below */}
      <div className="absolute bottom-10 right-4 z-10 flex flex-col items-end gap-2">
        {navigateTarget && (
          <button
            onClick={() => { setNavigateTarget(null); setRouteGeoJSON(null); }}
            className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-border rounded-full px-3 py-2 text-xs font-medium shadow-md text-muted-foreground hover:text-destructive transition-colors"
          >
            <X size={12} /> Clear route
          </button>
        )}
        <LocateButton mapRef={mapRef} />
        {/* Tree Rescue FAB */}
        <button
          onClick={openRescue}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg transition-colors"
        >
          <Siren size={16} />
          Tree Rescue
        </button>
      </div>

      {/* Rescue panel — always rendered for animation; slides up from below tab bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 bg-background border-t border-border rounded-t-2xl shadow-2xl max-h-[60dvh] flex flex-col transition-all duration-300 ease-out ${
          rescueOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <Siren size={16} className="text-red-500" />
            <p className="font-semibold text-sm">Trees that need rescue</p>
          </div>
          <button onClick={() => setRescueOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={14} />
          </button>
        </div>
        {userLat == null && (
          <p className="px-4 pb-2 text-xs text-amber-600 dark:text-amber-400">
            Geolocation unavailable — showing nearest to city centre.
          </p>
        )}
        <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-2">
          {rescueLoading && <p className="text-xs text-muted-foreground text-center py-4">Finding trees…</p>}
          {!rescueLoading && rescueTrees.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No critical trees found nearby.</p>
          )}
          {rescueTrees.map((tree) => (
            <div key={tree.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <AlertTriangle size={18} className={statusColor(tree.status)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{tree.name || tree.id}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {tree.neighborhood ?? ""}{tree.address ? ` · ${tree.address}` : ""}
                </p>
                <p className={`text-xs font-medium ${statusColor(tree.status)}`}>
                  {tree.status} {tree.latest_moisture != null ? `· ${tree.latest_moisture}% moisture` : ""}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => handleRescueFlyTo(tree)}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  View
                </button>
                {userLat != null && (
                  <button
                    onClick={() => handleRescueNavigate(tree)}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    <Navigation2 size={11} />Route
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TreeSheet
        tree={selectedTree}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
