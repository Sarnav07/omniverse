import React, { useRef } from "react";
import { motion } from "motion/react";
import type { DemoTrade } from "@/lib/dashboardData";
import { arbiscanTxUrl } from "@/lib/formatters";
import { DataSourceBadge } from "./data-source-badge";

export type { DemoTrade };

export type AttackTranscriptProps = {
  trades: DemoTrade[];
  isLoading: boolean;
  source?: string;
};

export function AttackTranscript({ trades, isLoading, source }: AttackTranscriptProps) {
  if (isLoading) return <ActivityLoadingState />;
  if (source === "unavailable" && trades.length === 0) return <UnavailableActivityState />;
  if (trades.length === 0) return <EmptyActivityState />;
  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <ActivityTableHeader />
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {trades.map((t) => (
          <ActivityRow key={t.id} trade={t} />
        ))}
      </div>
    </div>
  );
}

export function ActivityTableHeader() {
  return (
    <div className="grid grid-cols-[50px_1fr_1fr_60px_60px] gap-4 px-6 py-3 border-b border-white/5">
      {["Side", "Asset", "Status", "Size", "Block"].map((c, i) => (
        <span
          key={c}
          className={`text-[9px] text-[#8B8D98] uppercase tracking-widest ${
            i >= 3 ? "text-right" : ""
          }`}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export type ActivityRowProps = {
  trade: DemoTrade;
};

export function ActivityRow({ trade }: ActivityRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const sizeNum = Number(trade.size) / 1e18; // size is a WAD bigint
  const validSize = isNaN(sizeNum) ? 0 : sizeNum;

  return (
    <motion.div
      ref={rowRef}
      initial={{ opacity: 0, x: -6, backgroundColor: "rgba(16,185,129,0.06)" }}
      animate={{ opacity: 1, x: 0, backgroundColor: "rgba(255,255,255,0)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="grid grid-cols-[50px_1fr_1fr_60px_60px] gap-4 px-6 py-3 items-center border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer"
    >
      <SideBadge side={trade.side === 0 ? "YES" : "NO"} />
      <AssetCell symbol="WETH" />
      <StatusCell status="resolved" />
      <span
        className="text-xs font-mono text-white text-right"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {validSize.toFixed(2)}
      </span>
      <a
        href={arbiscanTxUrl(trade.txHash)}
        target="_blank"
        rel="noreferrer"
        title={`View tx ${trade.txHash} on Arbiscan`}
        className="text-[10px] font-mono text-[#8B8D98] text-right hover:text-white transition-colors"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        #{String(trade.blockNumber).slice(-5)}
      </a>
    </motion.div>
  );
}

export function UnavailableActivityState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      <div className="w-full h-full border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-3 bg-white/[0.01]">
        <span className="text-xs font-mono text-[#8B8D98] tracking-widest uppercase">
          indexer offline
        </span>
        <DataSourceBadge source="unavailable" />
      </div>
    </div>
  );
}

export type SideBadgeProps = {
  side: "YES" | "NO";
};

export function SideBadge({ side }: SideBadgeProps) {
  const cls =
    side === "YES"
      ? "bg-[#10B981]/10 text-[#10B981]"
      : "bg-[#EF4444]/10 text-[#EF4444]";
  return (
    <span
      className={`text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded w-fit flex items-center justify-center ${cls}`}
    >
      {side}
    </span>
  );
}

export type AssetCellProps = {
  symbol: string;
};

export function AssetCell({ symbol }: AssetCellProps) {
  const dot =
    symbol === "WETH"
      ? "bg-purple-500/20 border-purple-500/50"
      : "bg-blue-500/20 border-blue-500/50";
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full border ${dot}`} />
      <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">{symbol}</span>
    </div>
  );
}

export type StatusCellProps = {
  status: string;
  active?: boolean;
};

export function StatusCell({ status }: StatusCellProps) {
  const color = status === "pending" ? "#F59E0B" : "#10B981";
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-1 h-1 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span className="text-[10px] text-[#8B8D98] capitalize">{status}</span>
    </div>
  );
}

export function EmptyActivityState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full h-full border border-dashed border-white/10 rounded-xl flex items-center justify-center bg-white/[0.01]">
        <span className="text-xs font-mono text-[#8B8D98] tracking-widest uppercase">
          awaiting intent resolution...
        </span>
      </div>
    </div>
  );
}

export function ActivityLoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col w-full">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[50px_1fr_1fr_60px_60px] gap-4 px-6 py-4 border-b border-white/5"
        >
          <div className="h-3 bg-white/5 rounded animate-pulse w-full" />
          <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-white/5 rounded animate-pulse w-2/3" />
          <div className="h-3 bg-white/5 rounded animate-pulse w-full" />
          <div className="h-3 bg-white/5 rounded animate-pulse w-2/3" />
        </div>
      ))}
    </div>
  );
}
