"use client";
import { useEffect, useRef, useState } from "react";
import { simulateSession, type WaterSample } from "@/lib/mock/water";
import { fetchTreeReadings } from "@/lib/api/sensors";
import {
  MOISTURE_THRESHOLD,
  VERIFY_WINDOW_MS,
  LIVE_VERIFY_WINDOW_MS,
  LIVE_RISE_DELTA,
  LIVE_POLL_MS,
  VERIFY_SUSTAIN_MS,
} from "@/lib/constants";

interface Props {
  treeId: string;
  /** When true, poll the real sensor instead of running the simulation. */
  live?: boolean;
  onVerified: () => void;
  onRejected: (reason: string) => void;
}

export function VerifyView({ treeId, live = false, onVerified, onRejected }: Props) {
  const [samples, setSamples] = useState<WaterSample[]>([]);
  const [goal, setGoal] = useState(MOISTURE_THRESHOLD);
  const [startValue, setStartValue] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);

  // Keep callback identities out of the effect deps so a parent re-render
  // can't restart the simulation / spawn a second poll interval.
  const onVerifiedRef = useRef(onVerified);
  const onRejectedRef = useRef(onRejected);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
    onRejectedRef.current = onRejected;
  });

  const windowMs = live ? LIVE_VERIFY_WINDOW_MS : VERIFY_WINDOW_MS;

  // Fire verification once, but DON'T stop sampling — we keep the line moving
  // so the overshoot is visible behind the congrats animation for a moment.
  const verify = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
    onVerifiedRef.current();
  };

  useEffect(() => {
    doneRef.current = false;

    // ── Simulated watering (the original demo) ──
    if (!live) {
      let aborted = false;
      let captured = false;
      let prevT = 0;
      let overMs = 0; // cumulative time above the goal
      (async () => {
        for await (const sample of simulateSession(treeId)) {
          if (aborted) break;
          if (!captured) {
            captured = true;
            setStartValue(sample.moisture);
          }
          setSamples((prev) => [...prev, sample]);
          if (sample.raining && sample.t > 5000 && !doneRef.current) {
            doneRef.current = true;
            onRejectedRef.current("It's raining citywide — credit suppressed.");
            return;
          }
          const dt = sample.t - prevT;
          prevT = sample.t;
          if (sample.moisture >= MOISTURE_THRESHOLD) overMs += dt;
          if (overMs >= VERIFY_SUSTAIN_MS) {
            verify(); // keeps looping afterward so the line climbs further
          }
        }
        if (!doneRef.current) {
          doneRef.current = true;
          onRejectedRef.current("Insufficient moisture increase detected.");
        }
      })();
      return () => {
        aborted = true;
      };
    }

    // ── Live watering: poll the real sensor and detect a moisture rise ──
    const start = Date.now();
    let baseline: number | null = null;
    let liveGoal = MOISTURE_THRESHOLD;
    let prevElapsed = 0;
    let overMs = 0; // cumulative time the sensor reads above the goal

    const tick = async () => {
      const elapsed = Date.now() - start;
      const dt = elapsed - prevElapsed;
      prevElapsed = elapsed;
      try {
        // First read pulls a short history to average a stable start value.
        const readings = await fetchTreeReadings(treeId, baseline === null ? 10 : 1);
        const latest = readings[0]?.moisture;
        if (latest != null) {
          if (baseline === null) {
            const vals = readings
              .map((r) => r.moisture)
              .filter((v): v is number => v != null);
            const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : latest;
            baseline = avg;
            liveGoal = Math.min(95, Math.round(avg + LIVE_RISE_DELTA));
            setStartValue(Math.round(avg));
            setGoal(liveGoal);
          }
          setSamples((prev) => [...prev, { moisture: Math.round(latest), t: elapsed, raining: false }]);
          if (baseline !== null && latest >= liveGoal) overMs += dt;
          if (overMs >= VERIFY_SUSTAIN_MS) {
            verify(); // keep polling afterward to show the overshoot
          }
        }
      } catch {
        // transient network error — keep polling until the window elapses
      }
      if (!doneRef.current && elapsed > windowMs) {
        doneRef.current = true;
        clearInterval(iv);
        onRejectedRef.current("No moisture rise detected from the sensor.");
      }
    };

    const iv = setInterval(tick, LIVE_POLL_MS);
    tick(); // immediate first read
    return () => clearInterval(iv);
  }, [treeId, live, windowMs]);

  // ── Rendering (x is time-based so sim & live both fit the chart) ──
  const width = 280;
  const height = 80;
  const points = samples.map((s) => {
    const x = Math.min(1, s.t / windowMs) * width;
    const y = height - (s.moisture / 100) * height;
    return `${x},${y}`;
  });
  const thresholdY = height - (goal / 100) * height;
  const currentMoisture = samples[samples.length - 1]?.moisture ?? 0;
  const elapsed = samples[samples.length - 1]?.t ?? 0;
  const pct = Math.min(100, Math.round((elapsed / windowMs) * 100));
  const delta = startValue != null ? currentMoisture - startValue : 0;

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-4">
      {!done && (
        <p className="text-sm text-muted-foreground text-center">
          {live ? "Reading live sensor — water the tree…" : "Confirming watering…"}
        </p>
      )}

      <div className="relative w-[280px] h-[80px] bg-muted rounded-xl overflow-hidden">
        <svg width={width} height={height} className="absolute inset-0">
          <line
            x1={0}
            y1={thresholdY}
            x2={width}
            y2={thresholdY}
            stroke="#2E9E63"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          {points.length > 1 && (
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke="#1B5732"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        <div
          className="absolute right-1 text-[9px] text-[var(--verified)]"
          style={{ top: thresholdY - 12 }}
        >
          Goal
        </div>
      </div>

      {/* Start → Now, so the numbers are unambiguous */}
      <div className="flex items-end gap-3 text-sm">
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Start</span>
          <span className="font-heading font-semibold tabular-nums">
            {startValue != null ? `${startValue}%` : "–"}
          </span>
        </div>
        <span className="text-muted-foreground pb-0.5">→</span>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {done ? "End" : "Now"}
          </span>
          <span className="font-heading font-semibold text-lg tabular-nums text-[var(--verified)]">
            {currentMoisture}%
          </span>
        </div>
        {delta > 0 && (
          <span className="text-xs font-semibold text-[var(--verified)] pb-1">+{delta}</span>
        )}
        {live && !done && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--verified)] pb-1">
            ● live
          </span>
        )}
      </div>

      {!done && (
        <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
