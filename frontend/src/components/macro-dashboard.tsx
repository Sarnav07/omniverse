import { useMemo } from "react";
import { motion } from "motion/react";

interface MacroDashboardProps {
  savedTotal: number;
  shielded: number;
  lambdaWad: bigint | undefined;
  price: number;
}

export function MacroDashboard({ savedTotal, shielded, lambdaWad, price }: MacroDashboardProps) {
  const savedDisplay = useMemo(() => {
    return savedTotal.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }, [savedTotal]);

  const lamAt = lambdaWad ? Number(lambdaWad) / 1e18 : 1;

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <MacroCard 
        label="CUMULATIVE SAVED" 
        value={`$${savedDisplay}`} 
        delta="+184k in 24h" 
        deltaPositive 
        sparkline 
      />
      <MacroCard 
        label="LP SHIELD STATUS" 
        value={`${(shielded * 100).toFixed(1)}%`} 
        delta="Insulated" 
      />
      <MacroCard 
        label="CURRENT λ*" 
        value={lamAt.toFixed(3)} 
        delta="Dynamic Defense" 
      />
      <MacroCard 
        label="MARKET PROBABILITY" 
        value={`${(price * 100).toFixed(1)}%`} 
        delta="Live Activity" 
      />
    </div>
  );
}

function MacroCard({ label, value, delta, deltaPositive = false, sparkline = false }: { label: string; value: string; delta: string; deltaPositive?: boolean; sparkline?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/[0.03] bg-gradient-to-br from-white/[0.015] to-transparent p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] backdrop-blur-2xl">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-widest text-text-secondary">
        {label}
      </div>
      <div className="mb-2 tabular text-[32px] font-medium leading-none tracking-tight text-white">
        {value}
      </div>
      <div className={`tabular text-[12px] font-mono ${deltaPositive ? "text-accent-green" : "text-text-secondary"}`}>
        {delta}
      </div>
      
      {sparkline && (
        <div className="absolute bottom-0 right-0 h-1/2 w-2/3 opacity-40 pointer-events-none">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="sparkGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path 
              d="M 0 40 L 0 25 Q 10 30 20 20 T 40 15 T 60 22 T 80 5 L 100 0 L 100 40 Z" 
              fill="url(#sparkGradient)" 
            />
            <path 
              d="M 0 25 Q 10 30 20 20 T 40 15 T 60 22 T 80 5 L 100 0" 
              fill="none" 
              stroke="var(--accent-green)" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>
        </div>
      )}
    </div>
  );
}
