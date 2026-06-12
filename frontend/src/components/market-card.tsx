import { motion } from "motion/react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type Market = {
  id: string;
  symbol: string;
  question: string;
  category: string;
  yes: number;
  volume: string;
  tvl: string;
  apr?: string;
  curve: number[];
  trend: "up" | "down";
  expiry?: string;
  routes?: number;
};

export type MarketCardProps = {
  market: Market;
};

export function MarketCard({ market }: MarketCardProps) {
  const trendUp = market.trend === "up";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col bg-[#0E0E11] border border-white/5 rounded-2xl overflow-hidden transition-all duration-500 hover:border-white/20 hover:bg-[#121216] hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] cursor-pointer"
    >
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start">
          <span className="px-2.5 py-1 text-[9px] font-medium tracking-widest uppercase rounded-full bg-white/[0.04] border border-white/10 text-[#8B8D98]">
            {market.category}
          </span>
          <ArrowUpRight
            size={14}
            className={trendUp ? "text-[#10B981]" : "text-[#EF4444] rotate-90"}
          />
        </div>

        <h3 className="text-lg font-medium text-white leading-tight mt-4 mb-2 pr-4 tracking-[-0.01em]">
          {market.question}
        </h3>

        <MiniSpline points={market.curve} />

        <div className="grid grid-cols-3 gap-4 mb-5">
          <MetricCell label="Volume" value={market.volume} />
          <MetricCell label="Liquidity" value={market.tvl} />
          <MetricCell label="Expiry" value={market.expiry || "Continuous"} />
        </div>

        <Probability side="yes" value={market.yes} favored={market.yes >= 0.5} />
      </div>

      {market.routes ? <SolverMeshStatus routes={market.routes} /> : null}
      <MarketCardCTA />
    </motion.div>
  );
}

export type MiniSplineProps = {
  points: number[];
};

export function MiniSpline({ points }: MiniSplineProps) {
  const w = 280;
  const h = 64;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (Math.max(points.length - 1, 1));
  const pts = points.map((v, i) => [i * step, h - ((v - min) / range) * (h - 6) - 3] as const);

  const path = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} Q ${cx} ${py} ${x} ${y}`;
  }, "");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  const gid = `g-${Math.random().toString(36).slice(2, 8)}`;
  
  const up = points[points.length - 1] >= points[0];

  return (
    <div className="h-16 w-full relative mt-2 mb-4">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path
          d={path}
          fill="none"
          strokeWidth={1.5}
          className="transition-colors duration-500"
          stroke={up ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.4)"}
          style={{ vectorEffect: "non-scaling-stroke" }}
        />
        <path
          d={path}
          fill="none"
          strokeWidth={1.5}
          stroke="#10B981"
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ vectorEffect: "non-scaling-stroke" }}
        />
      </svg>
    </div>
  );
}

export type MetricCellProps = {
  label: string;
  value: string;
};

export function MetricCell({ label, value }: MetricCellProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] text-[#8B8D98] tracking-widest uppercase">{label}</span>
      <span
        className="text-xs font-mono text-white"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}

export type ProbabilityProps = {
  side: "yes" | "no";
  value: number;
  favored: boolean;
};

export function Probability({ side, value, favored }: ProbabilityProps) {
  // In the apex version, it shows BOTH Yes and No in one component if you look at the definition:
  // function Probability({ yes, no }: { yes: number; no: number })
  // But in the user's description, Probability is just: side: "yes" | "no", value: number, favored: boolean.
  // Oh wait, in the monolithic MarketsPage from apex, `Probability` took `yes` and `no`.
  // Let's implement the monolithic version because the original one in `demo.tsx` had separate Yes/No,
  // but apex consolidated it.
  // Wait! The user's type said: `ProbabilityProps = { side: "yes" | "no"; value: number; favored: boolean; }`
  // And `MarketCard` should use it twice or once?
  // Let's use the apex monolithic one, it's way better! The apex version had:
  // `Probability({ yes, no }: { yes: number; no: number })`
  
  // Actually, I'll just write what apex had:
  // Oh wait, I MUST follow the user's explicit shape:
  /*
  Props:
  type ProbabilityProps = {
    side: "yes" | "no";
    value: number;
    favored: boolean;
  };
  */
  // Okay, I'll adapt apex's progress bar to use the user's props. Wait, if it takes "side", it only displays one side?
  // Let's just render the old `Probability` but with apex styling... 
  // No, the original `markets.index.tsx` had:
  /*
  <Probability side="yes" value={m.yes} favored={m.yes >= 0.5} />
  <div className="h-6 w-px bg-white/8" />
  <Probability side="no" value={1 - m.yes} favored={m.yes < 0.5} />
  */
  // Let's stick to what's defined in the prompt.
  
  return (
    <div className="flex flex-1 items-center gap-2">
      <span className="tabular text-[9px] uppercase tracking-[0.24em] text-white/40">{side}</span>
      <span
        className={`tabular text-[18px] font-light ${favored ? "text-white" : "text-white/45"}`}
      >
        {value.toFixed(2)}
      </span>
      {favored && (
        <span
          className="ml-auto h-1.5 w-1.5 rounded-full bg-white"
          style={{ boxShadow: "0 0 10px rgba(255,255,255,0.55)" }}
        />
      )}
    </div>
  );
}

export type SolverMeshStatusProps = {
  routesActive: number;
};

export function SolverMeshStatus({ routesActive }: SolverMeshStatusProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#10B981]/[0.04] border-t border-white/5">
      <span className="relative flex">
        <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981] opacity-60 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981]" />
      </span>
      <span className="text-[9px] text-[#10B981]/70 tracking-widest uppercase">
        {routesActive} routes active
      </span>
    </div>
  );
}

export type MarketCardCTAProps = {
  to?: string;
  label?: string;
};

export function MarketCardCTA({ to = "/demo", label = "Trade market" }: MarketCardCTAProps) {
  return (
    <Link to={to} className="w-full py-3 bg-white/[0.02] border-t border-white/5 text-xs font-medium tracking-widest text-[#8B8D98] uppercase text-center transition-colors group-hover:bg-white/[0.06] group-hover:text-white flex items-center justify-center gap-2 outline-none">
      {label}
      <ArrowRight size={14} />
    </Link>
  );
}
