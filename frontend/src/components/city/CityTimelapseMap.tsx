"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MapGL, { Layer, Source, type MapRef } from "react-map-gl/maplibre";
import type { ImageSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildIdwRaster, colorFnFor, type IdwRasterResult } from "@/lib/heatmap";
import { fetchCityMapFrames } from "@/lib/api/city";
import type { CityMetric } from "@/lib/types";
import { cityMapStyle } from "@/lib/city/mapStyle";

const mapLibPromise = import("maplibre-gl");

const METRIC_COLOR: Record<CityMetric, string> = {
  noise:    "#d97706",
  activity: "#0284c7",
  heat:     "#ea580c",
  moisture: "#3b82f6",
};

const LEGEND: Record<CityMetric, { label: string; color: string }[]> = {
  noise:    [{ label: "Quiet", color: "#34d399" }, { label: "Moderate", color: "#d97706" }, { label: "Loud", color: "#ef4444" }],
  activity: [{ label: "Low", color: "#0f2033" }, { label: "Medium", color: "#0284c7" }, { label: "High", color: "#bfdbfe" }],
  heat:     [{ label: "Cool", color: "#34d399" }, { label: "Warm", color: "#ea580c" }, { label: "Hot", color: "#ef4444" }],
  moisture: [{ label: "Dry", color: "#c8b48c" }, { label: "Moist", color: "#60a5fa" }, { label: "Wet", color: "#1d4ed8" }],
};

const TIMELINE_EVENTS = [
  { date: "2026-05-15", label: "Tempo 30", color: "#d97706" },
  { date: "2026-05-31", label: "Heatwave", color: "#ea580c" },
  { date: "2026-06-13", label: "Heatwave end", color: "var(--cc-muted)" },
];

const SPEEDS = [0.5, 1, 2, 4];

interface ComputedFrame {
  idx: number;
  start: string;
  end: string;
  url: string;
  coords: IdwRasterResult["coords"];
}

interface Props {
  defaultMetric?: CityMetric;
}

export function CityTimelapseMap({ defaultMetric = "heat" }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const loadIdRef = useRef(0);

  const [metric, setMetric] = useState<CityMetric>(defaultMetric);
  const [frames, setFrames] = useState<ComputedFrame[]>([]);
  // loading progress — null means idle, 0-1 means computing for a new metric
  const [loadProgress, setLoadProgress] = useState<number | null>(null);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2); // fps

  // Fetch → compute global value range → render IDW frames
  useEffect(() => {
    const myId = ++loadIdRef.current;

    fetchCityMapFrames(metric, 3, 90)
      .then(async (data) => {
        if (myId !== loadIdRef.current) return;
        // All state updates inside the async callback — avoids synchronous setState-in-effect
        setLoadProgress(0);

        // Compute global value range across ALL frames for consistent coloring
        const allValues = data.frames.flatMap((f) => f.points.map((p) => p.value));
        const globalMinV = allValues.length ? Math.min(...allValues) : 0;
        const globalMaxV = allValues.length ? Math.max(...allValues) : 1;

        const colorFn = colorFnFor(metric);
        const computed: ComputedFrame[] = [];

        for (let i = 0; i < data.frames.length; i++) {
          if (myId !== loadIdRef.current) return;
          const f = data.frames[i];
          const pts = f.points.map((p) => ({ lng: p.lng, lat: p.lat, value: p.value }));
          const raster = buildIdwRaster(pts, colorFn, {
            size: 150,
            alpha: 200,
            globalMinV,
            globalMaxV,
          });
          if (raster) {
            computed.push({ idx: i, start: f.start, end: f.end, url: raster.url, coords: raster.coords });
          }
          setLoadProgress((i + 1) / data.frames.length);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }

        if (myId === loadIdRef.current) {
          setFrames(computed);
          setCurrentFrame(0);
          setLoadProgress(null);
        }
      })
      .catch(() => setLoadProgress(null));
  }, [metric]);

  // Auto-advance animation loop
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const timer = setTimeout(
      () => setCurrentFrame((f) => (f + 1) % frames.length),
      1000 / speed,
    );
    return () => clearTimeout(timer);
  }, [playing, currentFrame, frames.length, speed]);

  // Imperatively update the MapLibre image source to trigger the raster crossfade
  useEffect(() => {
    if (!mapReady || frames.length === 0) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const source = map.getSource("timelapse-overlay") as ImageSource | undefined;
    const url = frames[currentFrame]?.url;
    if (source && url && typeof source.updateImage === "function") {
      source.updateImage({ url });
    }
  }, [currentFrame, frames, mapReady]);

  const seekTo = useCallback(
    (idx: number) => setCurrentFrame(Math.max(0, Math.min(idx, frames.length - 1))),
    [frames.length],
  );

  const firstFrame = frames[0];
  const currentFrameData = frames[currentFrame];
  const accentColor = METRIC_COLOR[metric];
  const isComputing = loadProgress !== null;

  const eventMarkers = TIMELINE_EVENTS.flatMap((ev) => {
    const idx = frames.findIndex((f) => f.start >= ev.date);
    if (idx < 0) return [];
    return [{ ...ev, position: idx / Math.max(frames.length - 1, 1) }];
  });

  const progressPct = frames.length > 1 ? (currentFrame / (frames.length - 1)) * 100 : 0;
  const intervalMs = 1000 / speed;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>

      {/* Thin top progress bar — visible only while computing new metric frames */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        zIndex: 30, pointerEvents: "none",
        opacity: isComputing ? 1 : 0,
        transition: "opacity 0.3s",
      }}>
        <div style={{
          height: "100%",
          width: `${(loadProgress ?? 0) * 100}%`,
          background: accentColor,
          transition: "width 0.1s ease",
        }} />
      </div>

      {/* Metric selector — top right */}
      <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 10, display: "flex", gap: "4px" }}>
        {(["heat", "noise", "activity"] as CityMetric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            style={{
              padding: "4px 10px",
              fontSize: "10px",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              borderRadius: "3px",
              border: `1px solid ${metric === m ? METRIC_COLOR[m] : "var(--cc-border2)"}`,
              background: metric === m
                ? `${METRIC_COLOR[m]}22`
                : "rgba(255,255,255,0.85)",
              color: metric === m ? METRIC_COLOR[m] : "var(--cc-muted)",
              cursor: isComputing ? "default" : "pointer",
              backdropFilter: "blur(6px)",
              fontFamily: "var(--cc-mono, monospace)",
              opacity: isComputing && m !== metric ? 0.45 : 1,
              transition: "all 0.2s",
            }}
          >
            {m}{isComputing && m === metric ? " …" : ""}
          </button>
        ))}
      </div>

      {/* MapLibre */}
      <MapGL
        ref={mapRef}
        mapLib={mapLibPromise}
        initialViewState={{ longitude: 8.4037, latitude: 49.0069, zoom: 11.5 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={cityMapStyle()}
        onLoad={() => setMapReady(true)}
        attributionControl={false}
      >
        {firstFrame && (
          <Source
            id="timelapse-overlay"
            type="image"
            url={firstFrame.url}
            coordinates={firstFrame.coords}
          >
            <Layer
              id="timelapse-layer"
              type="raster"
              paint={{ "raster-opacity": 0.78, "raster-fade-duration": 700 }}
            />
          </Source>
        )}
      </MapGL>

      {/* Legend */}
      {frames.length > 0 && (
        <div style={{
          position: "absolute", bottom: "72px", left: "12px", zIndex: 5,
          display: "flex", gap: "10px", alignItems: "center",
          background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)",
          border: "1px solid var(--cc-border)", boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
          borderRadius: "3px", padding: "5px 10px",
          opacity: isComputing ? 0.5 : 1, transition: "opacity 0.3s",
        }}>
          {LEGEND[metric].map((e) => (
            <div key={e.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: e.color }} />
              <span style={{ fontSize: "10px", color: "var(--cc-muted)" }}>{e.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline scrubber */}
      {frames.length > 0 && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
          padding: "8px 14px 14px",
          background: "linear-gradient(to bottom, transparent, rgba(243,245,248,0.96) 35%)",
        }}>
          {/* Controls row */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <button
              onClick={() => setPlaying((p) => !p)}
              style={{
                width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0,
                background: "rgba(15,23,42,0.04)",
                border: "1px solid var(--cc-border2)",
                color: "var(--cc-text)", fontSize: "10px",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "⏸" : "▶"}
            </button>

            <span style={{
              fontSize: "11px", color: "var(--cc-text)", flexShrink: 0,
              fontFamily: "var(--cc-mono, monospace)", fontVariantNumeric: "tabular-nums",
              minWidth: "148px",
            }}>
              {currentFrameData?.start ?? "—"} → {currentFrameData?.end ?? "—"}
            </span>

            <div style={{ display: "flex", gap: "3px", marginLeft: "auto" }}>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  style={{
                    padding: "2px 7px",
                    fontSize: "9px",
                    fontFamily: "var(--cc-mono, monospace)",
                    borderRadius: "3px",
                    border: `1px solid ${speed === s ? "#16a34a" : "var(--cc-border2)"}`,
                    background: speed === s ? "rgba(22,163,74,0.15)" : "transparent",
                    color: speed === s ? "#16a34a" : "var(--cc-muted)",
                    cursor: "pointer",
                  }}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {/* Track with event markers */}
          <div style={{ position: "relative", paddingTop: "18px" }}>
            {eventMarkers.map((ev) => (
              <div
                key={ev.date}
                style={{
                  position: "absolute",
                  left: `${ev.position * 100}%`,
                  top: 0,
                  transform: "translateX(-50%)",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  pointerEvents: "none", gap: "2px",
                }}
              >
                <span style={{
                  fontSize: "8px", color: ev.color,
                  whiteSpace: "nowrap", fontFamily: "var(--cc-mono, monospace)",
                }}>
                  {ev.label}
                </span>
                <div style={{ width: "1px", height: "5px", background: ev.color, opacity: 0.55 }} />
              </div>
            ))}

            <div
              role="slider"
              aria-valuemin={0}
              aria-valuemax={frames.length - 1}
              aria-valuenow={currentFrame}
              tabIndex={0}
              style={{
                width: "100%", height: "4px",
                background: "rgba(15,23,42,0.1)",
                borderRadius: "2px",
                cursor: "pointer",
                position: "relative",
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                seekTo(Math.round(pct * (frames.length - 1)));
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") seekTo(currentFrame + 1);
                if (e.key === "ArrowLeft") seekTo(currentFrame - 1);
              }}
            >
              <div style={{
                position: "absolute", left: 0, top: 0, height: "100%",
                width: `${progressPct}%`,
                background: accentColor,
                borderRadius: "2px",
                // Smooth scrubber fill advances with the playback interval
                transition: playing ? `width ${intervalMs * 0.6}ms linear` : "none",
              }} />
              <div style={{
                position: "absolute",
                left: `${progressPct}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "11px", height: "11px",
                borderRadius: "50%",
                background: accentColor,
                border: "2px solid #ffffff",
                boxShadow: `0 0 8px ${accentColor}55`,
                transition: playing ? `left ${intervalMs * 0.6}ms linear` : "none",
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
