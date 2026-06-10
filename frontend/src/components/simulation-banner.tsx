interface SimulationBannerProps {
  className?: string;
}

export function SimulationBanner({ className = "" }: SimulationBannerProps) {
  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-amber-400">⚠</span>
        <div className="flex-1">
          <p className="font-medium text-amber-300">
            SIMULATION · Client-side only · No on-chain transactions
          </p>
          <p className="mt-1 text-sm text-amber-400/70">
            Resolving the market live would destroy the demo pool. This simulation shows the mathematical
            outcome of resolution — it does not submit any transaction to the blockchain.
          </p>
        </div>
      </div>
    </div>
  );
}
