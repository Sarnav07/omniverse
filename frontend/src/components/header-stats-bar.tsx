import React from "react";

export type HeaderStatsBarProps = {
  tvl: string;
  volume: string;
  activeMarkets: string;
  latency: string;
  solverAgents: string;
};

export function HeaderStatsBar({
  tvl,
  volume,
  activeMarkets,
  latency,
  solverAgents,
}: HeaderStatsBarProps) {
  const metrics = [
    { label: "Total Value Locked", value: tvl },
    { label: "24h Intent Volume", value: volume },
    { label: "Active Markets", value: activeMarkets },
    { label: "Settlement Latency", value: latency, accent: true },
    { label: "Solver Agents", value: solverAgents },
  ];
  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 bg-[#0E0E11] border border-white/5 rounded-2xl p-6 mb-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] relative overflow-hidden">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className={i < metrics.length - 1 ? "border-r border-white/5" : ""}
        >
          <HeaderMetric {...m} first={i === 0} last={i === metrics.length - 1} />
        </div>
      ))}
    </div>
  );
}

export type HeaderMetricProps = {
  label: string;
  value: string;
  accent?: boolean;
  first?: boolean;
  last?: boolean;
};

export function HeaderMetric({
  label,
  value,
  accent,
  first,
  last,
}: HeaderMetricProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${first ? "pl-0" : "pl-4"} ${last ? "pr-0" : "pr-4"}`}>
      <span className="text-[10px] text-[#8B8D98] tracking-widest uppercase">{label}</span>
      <span
        className="text-xl font-mono text-white tracking-tight"
        style={{
          fontVariantNumeric: "tabular-nums",
          color: accent ? "#10B981" : undefined,
          textShadow: accent ? "0 0 12px rgba(16,185,129,0.35)" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
