import { PoolReserves } from "@/hooks/useLiveDemoReads";
import { DataSource } from "./w-curve-live";
import { motion } from "motion/react";

interface LpShieldPanelProps {
  reserves?: PoolReserves;
  source: DataSource;
}

export function LpShieldPanel({ reserves, source }: LpShieldPanelProps) {
  if (!reserves || source === "unavailable") {
    return (
      <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-6">
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/30">
          Reserves unavailable
        </span>
      </div>
    );
  }

  const activeTotal = reserves.xActive + reserves.yActive;
  const totalReserves = activeTotal + reserves.xPassive + reserves.yPassive;
  const activePct = totalReserves > 0n ? Number((activeTotal * 100n) / totalReserves) : 0;
  const passivePct = 100 - activePct;

  const R = 64;
  const C = 2 * Math.PI * R;
  const shieldedFrac = passivePct / 100;
  const dash = shieldedFrac * C;

  return (
    <div className="flex flex-col items-center gap-6 rounded-lg border border-white/10 bg-white/5 p-6">
      {/* Donut */}
      <div className="relative grid place-items-center">
        <svg width="170" height="170" viewBox="0 0 170 170">
          {/* track — active (dim) */}
          <circle cx="85" cy="85" r={R} stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
          {/* shielded arc (passive) — bright */}
          <motion.circle
            cx="85"
            cy="85"
            r={R}
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            transform="rotate(-90 85 85)"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C - dash }}
            transition={{ type: "spring", stiffness: 90, damping: 22 }}
            style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.35))" }}
          />
          {/* shield icon */}
          <g transform="translate(85 85)" stroke="rgba(255,255,255,0.85)" strokeWidth="1" fill="none">
            <path d="M 0 -22 L 18 -14 L 18 6 C 18 16 10 22 0 26 C -10 22 -18 16 -18 6 L -18 -14 Z" strokeLinejoin="round" />
          </g>
        </svg>
        <div className="absolute -bottom-1 text-center">
          <div className="tabular text-[10px] uppercase tracking-[0.22em] text-white/40">shielded</div>
        </div>
      </div>

      {/* Stats */}
      <div className="w-full space-y-2 text-center">
        <div className="tabular text-4xl font-extralight tracking-tight text-white">
          {passivePct.toFixed(1)}
          <span className="text-base text-white/40">%</span>
        </div>
        <div className="tabular text-[10px] uppercase tracking-[0.2em] text-white/40">
          of lp value insulated
        </div>
        <div className="flex justify-between border-t border-white/[0.06] pt-3 text-xs">
          <div>
            <div className="text-white/40">active</div>
            <div className="text-white">{activePct.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-white/40">passive (shielded)</div>
            <div className="text-white">{passivePct.toFixed(1)}%</div>
          </div>
        </div>
        <div className="text-[8px] uppercase tracking-[0.2em] text-white/30">{source}</div>
      </div>
    </div>
  );
}
