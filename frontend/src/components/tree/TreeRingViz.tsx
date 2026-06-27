"use client";
import { useMemo } from "react";

interface Props {
  ageYears: number;
  treeId: string;
}

// Deterministic seedable RNG (Mulberry32)
function mulberry32(a: number) {
  let s = a;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// Smooth cubic bezier path through slightly perturbed ellipse points (Catmull-Rom)
function roughEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: () => number,
  roughness: number,
): string {
  const n = 20;
  const pts: [number, number][] = Array.from({ length: n }, (_, i) => {
    const θ = (i / n) * Math.PI * 2;
    const j = 1 + (rng() - 0.5) * roughness;
    return [cx + Math.cos(θ) * rx * j, cy + Math.sin(θ) * ry * j];
  });
  let d = `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const cp1: [number, number] = [
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
    ];
    const cp2: [number, number] = [
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
    ];
    d += ` C ${cp1[0].toFixed(2)},${cp1[1].toFixed(2)} ${cp2[0].toFixed(2)},${cp2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d + " Z";
}

// Heartwood (inner, darkest) → Sapwood (outer, lightest)
const WOOD = ["#4E2310", "#62311A", "#7A3F1E", "#945026", "#AC6630", "#C27C38", "#D49E54"];
const BARK = "#2A1408";

const CX = 100;
const CY = 100;
const BARK_RX = 88;
const BARK_RY = 81;

export function TreeRingViz({ ageYears, treeId }: Props) {
  const rings = Math.max(1, Math.min(ageYears, 120));

  const seed = useMemo(
    () => parseInt(treeId.replace(/\D/g, "") || "1", 10),
    [treeId],
  );

  const { barkPath, ringPaths } = useMemo(() => {
    const rng = mulberry32(seed);
    const barkPath = roughEllipse(CX, CY, BARK_RX, BARK_RY, rng, 0.055);
    const ringPaths = Array.from({ length: rings }, (_, i) => {
      const frac = (i + 1) / rings;
      const rx = BARK_RX * 0.9 * frac;
      const ry = BARK_RY * 0.9 * frac;
      return roughEllipse(CX, CY, rx, ry, rng, 0.025 + frac * 0.02);
    });
    return { barkPath, ringPaths };
  }, [seed, rings]);

  return (
    <svg
      viewBox="0 0 200 200"
      width="100%"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      {/* Dark bark background */}
      <path d={barkPath} fill={BARK} />

      {/* Wood rings — outermost (sapwood) first so heartwood renders on top */}
      {[...ringPaths].reverse().map((d, revI) => {
        const idx = rings - 1 - revI;
        const cIdx =
          rings === 1
            ? 3
            : Math.round((idx / (rings - 1)) * (WOOD.length - 1));
        return (
          <path key={idx} d={d} fill={WOOD[cIdx]} stroke={BARK} strokeWidth={rings > 30 ? 0.3 : 0.6} />
        );
      })}
    </svg>
  );
}
