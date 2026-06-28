/**
 * IDW (Inverse Distance Weighting) heatmap raster generator.
 * Extracted from MapView.tsx so both the citizen map and the city dashboard
 * can reuse the same algorithm.
 */

export interface HeatPoint {
  lng: number;
  lat: number;
  value: number;
}

export type ColorFn = (t: number) => [number, number, number];

export interface IdwRasterResult {
  url: string;
  coords: [[number, number], [number, number], [number, number], [number, number]];
}

export function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function heatRgb(t: number): [number, number, number] {
  const green: [number, number, number] = [34, 197, 94];
  const orange: [number, number, number] = [249, 115, 22];
  const red: [number, number, number] = [220, 38, 38];
  return t < 0.5 ? lerpColor(green, orange, t * 2) : lerpColor(orange, red, (t - 0.5) * 2);
}

export function moistureRgb(t: number): [number, number, number] {
  const tan: [number, number, number] = [200, 180, 140];
  const mid: [number, number, number] = [125, 175, 220];
  const blue: [number, number, number] = [29, 78, 216];
  return t < 0.5 ? lerpColor(tan, mid, t * 2) : lerpColor(mid, blue, (t - 0.5) * 2);
}

/** Green (quiet/cool) → amber → red (loud/hot). Used for noise and heat. */
export function noiseRgb(t: number): [number, number, number] {
  const calm: [number, number, number] = [52, 211, 153];   // teal-green
  const warn: [number, number, number] = [251, 191, 36];   // amber
  const hot: [number, number, number] = [239, 68, 68];     // red
  return t < 0.5 ? lerpColor(calm, warn, t * 2) : lerpColor(warn, hot, (t - 0.5) * 2);
}

/** Dark (low) → cyan → white (high). Used for pedestrian activity. */
export function activityRgb(t: number): [number, number, number] {
  const low: [number, number, number] = [15, 23, 42];      // dark navy
  const mid: [number, number, number] = [6, 182, 212];     // cyan
  const high: [number, number, number] = [240, 249, 255];  // near-white
  return t < 0.5 ? lerpColor(low, mid, t * 2) : lerpColor(mid, high, (t - 0.5) * 2);
}

export function colorFnFor(metric: "noise" | "activity" | "heat" | "moisture"): ColorFn {
  switch (metric) {
    case "noise": return noiseRgb;
    case "activity": return activityRgb;
    case "heat": return heatRgb;
    case "moisture": return moistureRgb;
  }
}

/** Bin raw points into spatial cells (≈90m grid) and average their values. */
export function binToCentroids(points: HeatPoint[]): HeatPoint[] {
  const cells = new Map<string, { sumLng: number; sumLat: number; sumVal: number; count: number }>();
  for (const p of points) {
    const key = `${Math.round(p.lat / 0.0008)},${Math.round(p.lng / 0.0008)}`;
    const cell = cells.get(key);
    if (cell) {
      cell.sumLng += p.lng;
      cell.sumLat += p.lat;
      cell.sumVal += p.value;
      cell.count++;
    } else {
      cells.set(key, { sumLng: p.lng, sumLat: p.lat, sumVal: p.value, count: 1 });
    }
  }
  return Array.from(cells.values()).map(({ sumLng, sumLat, sumVal, count }) => ({
    lng: sumLng / count,
    lat: sumLat / count,
    value: sumVal / count,
  }));
}

/**
 * Build an IDW raster canvas and return a data URL + geographic corner coordinates
 * suitable for use as a MapLibre `image` source.
 *
 * Pass `globalMinV` / `globalMaxV` to normalize all frames on the same scale so
 * the color represents absolute value (e.g. heatwave frames look uniformly redder).
 */
export function buildIdwRaster(
  points: HeatPoint[],
  colorFn: ColorFn,
  opts: {
    size?: number;
    pad?: number;
    blurPx?: number;
    alpha?: number;
    globalMinV?: number;
    globalMaxV?: number;
  } = {},
): IdwRasterResult | null {
  if (typeof document === "undefined" || points.length === 0) return null;

  const SIZE = opts.size ?? 240;
  const pad = opts.pad ?? 0.014;
  const blurPx = opts.blurPx ?? 3;
  const alpha = opts.alpha ?? 210;

  const pts = binToCentroids(points);

  const lngs = pts.map((p) => p.lng);
  const lats = pts.map((p) => p.lat);
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;

  const vals = new Float32Array(SIZE * SIZE);
  let localMinV = Infinity, localMaxV = -Infinity;
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
      if (v < localMinV) localMinV = v;
      if (v > localMaxV) localMaxV = v;
    }
  }

  // Use caller-supplied global range if provided (keeps color consistent across frames)
  const minV = opts.globalMinV !== undefined ? opts.globalMinV : localMinV;
  const maxV = opts.globalMaxV !== undefined ? opts.globalMaxV : localMaxV;

  const raw = document.createElement("canvas");
  raw.width = SIZE;
  raw.height = SIZE;
  const ctx = raw.getContext("2d")!;
  const img = ctx.createImageData(SIZE, SIZE);
  const range = maxV - minV || 1;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const t = Math.max(0, Math.min(1, (vals[i] - minV) / range));
    const [r, g, b] = colorFn(t);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);

  const blurred = document.createElement("canvas");
  blurred.width = SIZE;
  blurred.height = SIZE;
  const bctx = blurred.getContext("2d")!;
  bctx.filter = `blur(${blurPx}px)`;
  bctx.drawImage(raw, 0, 0);
  bctx.filter = "none";

  // Soft-feather the edges (they sit ~0.5·SIZE from centre) while keeping a wide
  // opaque core, so it fades out at the borders without collapsing into a blob.
  const cx = SIZE / 2, cy = SIZE / 2;
  const grad = bctx.createRadialGradient(cx, cy, SIZE * 0.40, cx, cy, SIZE * 0.72);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.85)");
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
    ],
  };
}
