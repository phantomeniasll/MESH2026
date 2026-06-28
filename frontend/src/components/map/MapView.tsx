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
import { Siren, X, Navigation2, AlertTriangle, Building2 } from "lucide-react";
import { buildIdwRaster, colorFnFor, type HeatPoint } from "@/lib/heatmap";
import { DEMO_TREE_ID, demoDisplayMoisture } from "@/lib/constants";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`
  : "https://tiles.openfreemap.org/styles/positron";

const mapLibPromise = import("maplibre-gl");
const FOREST = "#1B5732";
// Karlsruhe center fallback when no user location
const KA_LAT = 49.0069;
const KA_LNG = 8.4037;

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
        // Demo tree: cap only its displayed water level so it registers thirsty
        // (consistent map + detail); its real liters/day need is left untouched.
        for (const feature of fc.features) {
          if (feature.properties.id === DEMO_TREE_ID) {
            feature.properties.moisture = demoDisplayMoisture(
              feature.properties.id,
              feature.properties.moisture,
            );
            feature.properties.status = "thirsty";
            feature.properties.needsWater = true;
          }
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
    if (overlay === "none" || !treesFC) return null;
    const metric = overlay === "heat" ? "heat" : "moisture";
    const points: HeatPoint[] = treesFC.features.map((f) => ({
      lng: f.geometry.coordinates[0] as number,
      lat: f.geometry.coordinates[1] as number,
      value: metric === "heat" ? f.properties.heat : f.properties.moisture,
    }));
    return buildIdwRaster(points, colorFnFor(metric));
  }, [overlay, treesFC]);

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      // Query a small box around the tap, not just the exact pixel, so the
      // small markers are far easier to hit.
      const TOL = 12;
      const bbox: [[number, number], [number, number]] = [
        [e.point.x - TOL, e.point.y - TOL],
        [e.point.x + TOL, e.point.y + TOL],
      ];

      const features = map.queryRenderedFeatures(bbox, {
        layers: ["unclustered-trees"],
      });

      if (features.length > 0) {
        // Pick the marker nearest the tap point.
        const nearest = features.reduce(
          (best, f) => {
            const c = (f.geometry as GeoJSON.Point).coordinates as [number, number];
            const p = map.project(c);
            const d = (p.x - e.point.x) ** 2 + (p.y - e.point.y) ** 2;
            return d < best.d ? { f, d } : best;
          },
          { f: features[0], d: Infinity },
        ).f;
        const props = nearest.properties as TreeFeature["properties"];
        const geom = nearest.geometry as GeoJSON.Point;
        const syntheticTree: TreeFeature = {
          type: "Feature",
          geometry: geom,
          properties: props,
        };
        setSelectedTree(syntheticTree);
        setSheetOpen(true);
        return;
      }

      const clusterFeatures = map.queryRenderedFeatures(bbox, {
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
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 7, 15, 9, 18, 11],
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

      {/* Jump to the city operations dashboard */}
      <a
        href="/city"
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-background/90 backdrop-blur border border-border rounded-full px-3 py-1.5 text-xs font-medium shadow-sm text-foreground hover:text-primary transition-colors"
      >
        <Building2 size={14} />
        City
      </a>

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
