import { useMemo } from "react";

export type MacroDashboardProps = {
  savedTotal: number;
  shielded: number;
  lambdaWad?: bigint;
  price: number;
};

export function MacroDashboard({ savedTotal, shielded, lambdaWad, price }: MacroDashboardProps) {
  const savedDisplay = useMemo(() => {
    return savedTotal.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }, [savedTotal]);

  const lamAt = lambdaWad ? Number(lambdaWad) / 1e18 : 1;

  const cards: MacroCardProps[] = [
    {
      label: "CAPITAL SHIELDED",
      value: `${savedDisplay} WETH`,
      delta: "Passive Reserves",
      deltaPositive: savedTotal > 0 ? true : null,
      sparkline: true,
      seed: [4, 6, 5, 8, 10, 9, 13, 16, 14, 18, 22, 28],
    },
    {
      label: "LP SHIELD STATUS",
      value: `${(shielded * 100).toFixed(1)}%`,
      delta: "Insulated",
      deltaPositive: null,
      sparkline: false,
    },
    {
      label: "CURRENT λ*",
      value: lamAt.toFixed(3),
      delta: "Dynamic Defense",
      deltaPositive: null,
      sparkline: false,
    },
    {
      label: "MARKET PROBABILITY",
      value: `${(price * 100).toFixed(1)}%`,
      delta: "Live Activity",
      deltaPositive: null,
      sparkline: false,
    },
  ];

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      {cards.map((c) => (
        <MacroCard key={c.label} {...c} />
      ))}
    </section>
  );
}

export type MacroCardProps = {
  label: string;
  value: string;
  delta: string | null;
  deltaPositive?: boolean | null;
  sparkline?: boolean;
  seed?: number[];
};

export function MacroCard({ label, value, delta, deltaPositive, sparkline, seed }: MacroCardProps) {
  const deltaColor =
    deltaPositive === true ? "#10B981" : deltaPositive === false ? "#EF4444" : "#8B8D98";
  return (
    <div className="relative flex flex-col justify-between p-6 bg-[#0E0E11] border border-white/5 rounded-2xl overflow-hidden group hover:border-white/10 transition-colors min-h-[180px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
      <span className="text-[10px] text-[#8B8D98] tracking-widest uppercase relative z-10">
        {label}
      </span>
      <div
        className="text-3xl font-mono text-white tracking-tight mt-4 relative z-10"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <div
        className="text-xs font-mono mt-2 z-10 relative"
        style={{ fontVariantNumeric: "tabular-nums", color: deltaColor }}
      >
        {delta}
      </div>
      {sparkline && seed && <Sparkline data={seed} positive={deltaPositive !== false} />}
    </div>
  );
}

export type SparklineProps = {
  data: number[];
  positive: boolean;
};

export function Sparkline({ data, positive }: SparklineProps) {
  const w = 280;
  const h = 60;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 4) - 2] as const);
  const line = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} Q ${cx} ${py} ${x} ${y}`;
  }, "");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  const color = positive ? "#10B981" : "#EF4444";
  const gid = `spk-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="absolute bottom-0 left-0 w-full h-1/2 opacity-60 group-hover:opacity-100 transition-opacity"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        style={{ vectorEffect: "non-scaling-stroke" }}
      />
    </svg>
  );
}
