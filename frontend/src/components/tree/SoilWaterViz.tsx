"use client";

interface Props {
  moisture: number;
  isWatered: boolean;
  litersPerDay: number;
}

const GOAL_PCT = 60;
const GOAL_CLR = "#1B5732";

export function SoilWaterViz({ moisture, isWatered, litersPerDay }: Props) {
  const W = 100;
  const H = 160;
  const pct = isWatered ? Math.max(moisture, 62) : moisture;
  // Liters at goal = litersPerDay; scale linearly from 0
  const currentLiters = Math.round((pct / GOAL_PCT) * litersPerDay);
  const goalReached = pct >= GOAL_PCT;

  // Non-linear fill so low-but-nonzero moisture still shows a readable water
  // body (a thin linear sliver was unreadable). Applied to the goal line too so
  // the surface and the goal stay visually consistent.
  const disp = (p: number) => Math.pow(Math.max(0, Math.min(100, p)) / 100, 0.6);
  const waterTopY = H - disp(pct) * H;
  const goalY = H - disp(GOAL_PCT) * H;

  // Soil layer boundaries (from top)
  const L1 = 24;   // humus → topsoil
  const L2 = 65;   // topsoil → subsoil
  const L3 = 110;  // subsoil → sandy clay

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block" }}
      aria-hidden="true"
    >
          {/* Soil layers + texture — reduced opacity so background doesn't overpower water */}
          <g opacity={0.62}>
            {/* Rendered bottom-to-top so upper rects cover lower ones */}
            <rect x={0} y={0} width={W} height={H} fill="#8E6035" />
            <rect x={0} y={0} width={W} height={L3} fill="#6B4020" />
            <rect x={0} y={0} width={W} height={L2} fill="#3D1E0A" />
            <rect x={0} y={0} width={W} height={L1} fill="#1A0C06" />

            {/* Wavy layer dividers */}
            <path
              d={`M 0,${L1} Q 22,${L1 - 2} 45,${L1 + 1.5} Q 70,${L1 - 1} 100,${L1}`}
              fill="none" stroke="#0D0604" strokeWidth={2.5}
            />
            <path
              d={`M 0,${L2} Q 28,${L2 + 2} 52,${L2 - 1.5} Q 75,${L2 + 1} 100,${L2}`}
              fill="none" stroke="#2A1208" strokeWidth={2}
            />
            <path
              d={`M 0,${L3} Q 30,${L3 - 1.5} 58,${L3 + 2} Q 80,${L3 - 1} 100,${L3}`}
              fill="none" stroke="#4A2C10" strokeWidth={2}
            />

            {/* Root-like marks in topsoil */}
            <line x1={18} y1={L1 + 4} x2={15} y2={L2 - 6} stroke="#120804" strokeWidth={1} opacity={0.5} />
            <line x1={72} y1={L1 + 2} x2={70} y2={L2 - 10} stroke="#120804" strokeWidth={0.8} opacity={0.4} />
            <line x1={42} y1={L1 + 8} x2={45} y2={L2 - 4} stroke="#120804" strokeWidth={0.7} opacity={0.35} />
          </g>

          {/* Water body */}
          {pct > 0.5 && (
            <rect
              x={0}
              y={waterTopY}
              width={W}
              height={H - waterTopY}
              fill="rgba(56,189,248,0.30)"
            />
          )}

          {/* Wave at water surface */}
          {pct > 2 && (
            <path
              d={`M -5,${waterTopY} Q 25,${waterTopY - 3} 50,${waterTopY} Q 78,${waterTopY + 3} 105,${waterTopY} L 105,${H + 2} L -5,${H + 2} Z`}
              fill="rgba(14,165,233,0.42)"
            />
          )}

          {/* Goal dashed line */}
          <line
            x1={0} y1={goalY}
            x2={W} y2={goalY}
            stroke={GOAL_CLR}
            strokeWidth={1.5}
            strokeDasharray="4 2.5"
            opacity={0.88}
          />

          {/* Goal line label */}
          <text
            x={W - 3}
            y={goalY - 3}
            textAnchor="end"
            fontSize={6.5}
            fontWeight="700"
            fill={GOAL_CLR}
            opacity={0.9}
          >
            Goal {litersPerDay} L
          </text>

          {/* Current liters in water body, or "0 L" at bottom when dry */}
          {pct > 4 ? (
            <text
              x={W / 2}
              y={Math.min(waterTopY + 17, H - 5)}
              textAnchor="middle"
              fontSize={13}
              fontWeight="800"
              fill="#ffffff"
              stroke="rgba(8,47,73,0.65)"
              strokeWidth={0.8}
              style={{ fontFamily: "system-ui, sans-serif", paintOrder: "stroke" }}
            >
              {goalReached ? `✓ ${currentLiters} L` : `${currentLiters} L`}
            </text>
          ) : (
            <text
              x={W / 2}
              y={H - 7}
              textAnchor="middle"
              fontSize={9}
              fontWeight="700"
              fill="rgba(14,165,233,0.65)"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              0 L
            </text>
          )}
    </svg>
  );
}
