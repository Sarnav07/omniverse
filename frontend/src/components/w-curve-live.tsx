import { useMemo } from "react";
import { motion } from "motion/react";

export type DataSource = "live" | "indexed" | "manifest" | "computed" | "unavailable";

interface WCurveLiveProps {
  price: number;           // 0..1
  lambdaWad?: bigint;
  source: DataSource;
  preAttackPrice?: number; // optional — mark pre-attack dot
}

export function WCurveLive({ price, lambdaWad, source, preAttackPrice }: WCurveLiveProps) {
  const W = 720;
  const H = 240;
  const pad = 28;

  // λ*(p) shape — memoized, only recomputes when lambdaWad changes (structural)
  const path = useMemo(() => {
    const pts: string[] = [];
    const N = 200;
    const lambdaScale = lambdaWad ? Math.max(0.5, Math.min(2, Number(lambdaWad) / 1e18)) : 1;
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      const lam =
        0.18 +
        0.85 * (Math.pow(2 * (p - 0.5), 2) * 0.6 * lambdaScale +
          Math.pow(Math.sin(p * Math.PI), 2) * -0.42 + 0.5);
      const x = pad + p * (W - 2 * pad);
      const y = H - pad - Math.max(0, Math.min(1, lam - 0.1)) * (H - 2 * pad);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lambdaWad]);

  const getDotY = (p: number) => {
    const lambdaScale = lambdaWad ? Math.max(0.5, Math.min(2, Number(lambdaWad) / 1e18)) : 1;
    const lam =
      0.18 +
      0.85 * (Math.pow(2 * (p - 0.5), 2) * 0.6 * lambdaScale +
        Math.pow(Math.sin(p * Math.PI), 2) * -0.42 + 0.5);
    return H - pad - Math.max(0, Math.min(1, lam - 0.1)) * (H - 2 * pad);
  };

  const clampedPrice = Math.max(0, Math.min(1, price));
  const dotX = pad + clampedPrice * (W - 2 * pad);
  const dotY = getDotY(clampedPrice);
  const lamAt = lambdaWad ? Number(lambdaWad) / 1e18 : 1;

  const preX = preAttackPrice !== undefined ? pad + Math.max(0, Math.min(1, preAttackPrice)) * (W - 2 * pad) : null;
  const preY = preAttackPrice !== undefined ? getDotY(Math.max(0, Math.min(1, preAttackPrice))) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
            optimal activeness λ*(p)
          </div>
          <div className="mt-1 text-[13px] text-white/55">
            Liquidity contracts as probability approaches 0 or 1 — bots find no edge.
          </div>
        </div>
        <div className="tabular text-right">
          <div className="text-[9px] uppercase tracking-[0.22em] text-white/35">current λ*</div>
          <div className="text-2xl font-extralight text-white">{lamAt.toFixed(3)}</div>
          {source !== "unavailable" && (
            <div className="text-[8px] uppercase tracking-[0.2em] text-white/30">{source}</div>
          )}
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-[240px] w-full">
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={`v${g}`}
              x1={pad + g * (W - 2 * pad)}
              x2={pad + g * (W - 2 * pad)}
              y1={pad}
              y2={H - pad}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          ))}

          {/* W Curve */}
          <motion.path
            d={path}
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="1.1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.18))" }}
          />

          {/* Pre-attack ghost dot */}
          {preX !== null && preY !== null && (
            <circle cx={preX} cy={preY} r="4" fill="rgba(255,255,255,0.2)" />
          )}

          {/* Live dot */}
          <motion.g
            animate={{ x: dotX, y: dotY }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          >
            <circle r="14" fill="rgba(255,255,255,0.06)">
              <animate attributeName="r" values="6;16;6" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle r="3.5" fill="white" />
          </motion.g>

          {/* Axis labels */}
          <text x={pad} y={H - 8} fill="rgba(255,255,255,0.3)" fontSize="9" letterSpacing="2">P=0</text>
          <text x={W / 2 - 8} y={H - 8} fill="rgba(255,255,255,0.3)" fontSize="9" letterSpacing="2">0.5</text>
          <text x={W - pad - 18} y={H - 8} fill="rgba(255,255,255,0.3)" fontSize="9" letterSpacing="2">P=1</text>
        </svg>
      </div>

      {source === "unavailable" && (
        <div className="rounded border border-white/10 bg-white/5 px-3 py-1 text-center text-[10px] text-white/40">
          Live data unavailable — showing last known state
        </div>
      )}
    </div>
  );
}
