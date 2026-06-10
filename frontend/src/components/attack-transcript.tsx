import { arbiscanTxUrl } from "@/lib/formatters";
import { DemoTrade } from "@/lib/dashboardData";

export function AttackTranscript({ trades, isLoading, source }: { trades: DemoTrade[], isLoading: boolean, source: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Attack Transcript</h3>
        <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
          Source: {source}
        </span>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <>
            <div className="h-10 w-full animate-pulse rounded bg-white/5" />
            <div className="h-10 w-full animate-pulse rounded bg-white/5" />
            <div className="h-10 w-full animate-pulse rounded bg-white/5" />
          </>
        ) : trades.length > 0 ? (
          trades.map((t, i) => (
            <div key={t.id} className="flex items-center justify-between rounded bg-white/[0.02] p-3 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-white/50">Block {t.blockNumber}</span>
                <a 
                  href={arbiscanTxUrl(t.txHash)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="font-mono text-blue-400 hover:underline"
                >
                  {t.txHash.slice(0, 8)}...{t.txHash.slice(-6)}
                </a>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-mono text-white">{Number(t.size) / 1e18} WETH</span>
                <span className="text-white/50">P: {(Number(t.priceAfter) / 1e16).toFixed(1)}%</span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-4 text-center text-sm text-white/30">No trades yet</div>
        )}
      </div>
    </div>
  );
}
