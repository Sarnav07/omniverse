import { arbiscanTxUrl } from "@/lib/formatters";
import { DemoTrade } from "@/lib/dashboardData";

export function AttackTranscript({ trades, isLoading, source }: { trades: DemoTrade[], isLoading: boolean, source: string }) {
  return (
    <div className="flex h-full flex-col bg-card-bg">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="tabular grid grid-cols-12 border-b border-white/[0.04] px-6 pb-2 pt-4 text-[10px] font-medium uppercase tracking-widest text-text-secondary">
          <span className="col-span-2">Side</span>
          <span className="col-span-2">Asset</span>
          <span className="col-span-3 pr-6 text-right">Amount</span>
          <span className="col-span-3 pl-6">Status</span>
          <span className="col-span-2 text-right">Block</span>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {isLoading ? (
            <div className="space-y-2 px-4 py-2">
              <div className="h-6 w-full animate-pulse rounded bg-white/5" />
              <div className="h-6 w-full animate-pulse rounded bg-white/5" />
              <div className="h-6 w-full animate-pulse rounded bg-white/5" />
            </div>
          ) : trades.length > 0 ? (
            trades.map((t) => {
              const isYes = t.sideLabel === "YES" || t.side === 0;
              const sideClass = isYes 
                ? "bg-accent-green/10 text-accent-green border-accent-green/20" 
                : "bg-red-500/10 text-red-500 border-red-500/20";
              const sideText = isYes ? "Buy" : "Sell";

              return (
                <div 
                  key={t.id} 
                  className="group tabular grid grid-cols-12 items-center rounded-lg px-4 py-2.5 text-[12px] transition-colors hover:bg-white/[0.03]"
                >
                  <span className="col-span-2">
                    <span className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${sideClass}`}>
                      {sideText}
                    </span>
                  </span>
                  <span className="col-span-2 flex items-center gap-1.5 font-medium text-white">
                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/20 bg-white/10 p-0.5">
                      <div className="h-full w-full rounded-full bg-white" />
                    </div>
                    WETH
                  </span>
                  <span className="col-span-3 pr-6 text-right font-mono text-white/90">
                    {(Number(t.size) / 1e18).toFixed(4)}
                  </span>
                  <span className="col-span-3 flex items-center gap-2 pl-6">
                    <span className="relative flex h-[4px] w-[4px]">
                      <span className="absolute inset-0 animate-ping rounded-full bg-accent-green" />
                      <span className="relative h-full w-full rounded-full bg-accent-green" style={{ filter: "drop-shadow(0 0 4px var(--accent-green))" }} />
                    </span>
                    <span className="text-[11px] text-text-secondary">Filled</span>
                  </span>
                  <span className="col-span-2 text-right text-[10px] text-text-secondary">
                    <a href={arbiscanTxUrl(t.txHash)} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                      {t.blockNumber}
                    </a>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-[12px] text-text-secondary border border-white/[0.04] border-dashed rounded-lg mx-4 mt-4">
              Awaiting intent resolution...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
