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
      <div className="relative grid place-items-center mt-4">
        <svg width="170" height="170" viewBox="0 0 170 170">
          {/* track — active (dim) */}
          <circle cx="85" cy="85" r={R} stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" />
          {/* shielded arc (passive) — bright */}
          <motion.circle
            cx="85"
            cy="85"
            r={R}
            stroke="rgba(255,255,255,1)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            transform="rotate(-90 85 85)"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C - dash }}
            transition={{ type: "spring", stiffness: 90, damping: 22 }}
            style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.8))" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="tabular text-4xl font-extralight tracking-tight text-white">
            {passivePct.toFixed(1)}
            <span className="text-base text-white/40">%</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="w-full">
        <div className="tabular text-[10px] uppercase tracking-[0.2em] text-white/40 text-center mb-4">
          of lp value insulated
        </div>
        <div className="flex justify-between border-t border-white/[0.06] pt-3 text-xs tabular">
          <div>
            <div className="text-white/40">active</div>
            <div className="text-white font-mono">{activePct.toFixed(1)}%</div>
          </div>
          <div className="text-right">
            <div className="text-white/40">passive (shielded)</div>
            <div className="text-white font-mono">{passivePct.toFixed(1)}%</div>
          </div>
        </div>
        <div className="mt-4 text-center text-[8px] uppercase tracking-[0.2em] text-white/30">{source}</div>
      </div>
    </div>
  );
}
