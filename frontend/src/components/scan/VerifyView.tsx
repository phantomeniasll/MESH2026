"use client";
import { useEffect, useRef, useState } from "react";
import { simulateSession, type WaterSample } from "@/lib/mock/water";
import { MOISTURE_THRESHOLD, VERIFY_WINDOW_MS } from "@/lib/constants";

interface Props {
  treeId: string;
  onVerified: () => void;
  onRejected: (reason: string) => void;
}

export function VerifyView({ treeId, onVerified, onRejected }: Props) {
  const [samples, setSamples] = useState<WaterSample[]>([]);
  const doneRef = useRef(false);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    doneRef.current = false;

    (async () => {
      for await (const sample of simulateSession(treeId)) {
        if (abortRef.current) break;
        setSamples((prev) => [...prev, sample]);

        if (sample.raining && sample.t > 5000 && !doneRef.current) {
          doneRef.current = true;
          onRejected("It's raining citywide — credit suppressed.");
          return;
        }
        if (
          sample.moisture >= MOISTURE_THRESHOLD &&
          sample.t > VERIFY_WINDOW_MS * 0.6 &&
          !doneRef.current
        ) {
          doneRef.current = true;
          onVerified();
          return;
        }
      }
      if (!doneRef.current) {
        doneRef.current = true;
        onRejected("Insufficient moisture increase detected.");
      }
    })();

    return () => {
      abortRef.current = true;
    };
  }, [treeId, onVerified, onRejected]);

  const maxSamples = VERIFY_WINDOW_MS / 500;
  const width = 280;
  const height = 80;

  const points = samples.map((s, i) => {
    const x = (i / maxSamples) * width;
    const y = height - (s.moisture / 100) * height;
    return `${x},${y}`;
  });

  const thresholdY = height - (MOISTURE_THRESHOLD / 100) * height;
  const currentMoisture = samples[samples.length - 1]?.moisture ?? 0;
  const elapsed = samples[samples.length - 1]?.t ?? 0;
  const pct = Math.round((elapsed / VERIFY_WINDOW_MS) * 100);

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-4">
      <p className="text-sm text-muted-foreground text-center">
        Confirming watering…
      </p>

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

      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Moisture</span>
        <span className="font-heading font-semibold text-lg">{currentMoisture}%</span>
      </div>

      <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
