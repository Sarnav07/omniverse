import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { SpotlightCard } from "@/components/spotlight-card";
import { NavBar } from "@/components/nav-bar";
import { useQuery } from 'urql';

const MARKETS_QUERY = `
  query {
    markets(limit: 50, orderBy: "createdAt", orderDirection: "desc") {
      items {
        id
        questionId
        lastPriceWeth
        totalVolumeWeth
        resolved
        createdAt
      }
    }
  }
`;

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets — Omniverse" },
      {
        name: "description",
        content:
          "Prediction markets and yield pools. Probability-bounded liquidity with zero-liquidation execution.",
      },
      { property: "og:title", content: "Markets — Omniverse" },
      {
        property: "og:description",
        content:
          "Prediction markets and yield pools. Probability-bounded liquidity with zero-liquidation execution.",
      },
    ],
  }),
  component: MarketsPage,
});

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

/* ───────────────────────────── mock data ───────────────────────────── */

type Market = {
  id: string;
  symbol: string;
  question: string;
  category: string;
  yes: number;
  volume: string;
  tvl: string;
  apr?: string;
  // 7-day spline points, 0..1
  curve: number[];
  trend: "up" | "down";
};

const MOCK_MARKETS: Market[] = [
  { id: "btc-100k", symbol: "BTC≥100k", question: "btc settles above 100k by q4", category: "macro", yes: 0.84, volume: "$24.8m", tvl: "$182.4m", apr: "12.4%", trend: "up",
    curve: [0.42, 0.48, 0.51, 0.55, 0.62, 0.71, 0.78, 0.81, 0.84] },
  { id: "eth-merge", symbol: "ETH·yield", question: "eth staking yield ≥ 5.2% next epoch", category: "yield", yes: 0.71, volume: "$12.1m", tvl: "$94.2m", apr: "8.7%", trend: "up",
    curve: [0.55, 0.52, 0.58, 0.61, 0.64, 0.66, 0.69, 0.70, 0.71] },
  { id: "sol-tvl", symbol: "SOL·tvl", question: "sol tvl crosses $8b before nov", category: "macro", yes: 0.42, volume: "$8.4m", tvl: "$41.0m", trend: "down",
    curve: [0.62, 0.58, 0.54, 0.51, 0.49, 0.46, 0.44, 0.43, 0.42] },
  { id: "fed-cuts", symbol: "FED·25bp", question: "fed cuts 25bp at next fomc", category: "rates", yes: 0.62, volume: "$31.4m", tvl: "$224.8m", apr: "9.1%", trend: "up",
    curve: [0.48, 0.50, 0.51, 0.54, 0.56, 0.59, 0.60, 0.61, 0.62] },
  { id: "stables-depeg", symbol: "USDC·peg", question: "usdc maintains peg ±10bp through epoch", category: "stable", yes: 0.94, volume: "$48.2m", tvl: "$612.1m", apr: "4.2%", trend: "up",
    curve: [0.91, 0.93, 0.92, 0.93, 0.94, 0.94, 0.94, 0.94, 0.94] },
  { id: "options-iv", symbol: "IV·vol", question: "30d iv compresses below 48 by friday", category: "vol", yes: 0.38, volume: "$6.2m", tvl: "$28.4m", trend: "down",
    curve: [0.58, 0.55, 0.52, 0.48, 0.45, 0.42, 0.40, 0.39, 0.38] },
  { id: "rwa-yield", symbol: "RWA·t", question: "tokenized treasuries clear 5.3% apr", category: "rwa", yes: 0.78, volume: "$14.8m", tvl: "$108.6m", apr: "5.3%", trend: "up",
    curve: [0.62, 0.65, 0.68, 0.71, 0.73, 0.75, 0.76, 0.77, 0.78] },
  { id: "ai-tokens", symbol: "AI·idx", question: "ai sector outperforms l1s on 30d basis", category: "thematic", yes: 0.56, volume: "$9.6m", tvl: "$52.8m", trend: "up",
    curve: [0.42, 0.45, 0.48, 0.50, 0.52, 0.53, 0.54, 0.55, 0.56] },
  { id: "lst-discount", symbol: "stETH·d", question: "stETH discount narrows under 5bp", category: "lst", yes: 0.69, volume: "$11.2m", tvl: "$78.4m", apr: "6.8%", trend: "up",
    curve: [0.51, 0.54, 0.57, 0.60, 0.63, 0.65, 0.67, 0.68, 0.69] },
];

/* ─────────────────────────────── page ─────────────────────────────── */

function MarketsPage() {
  const [activeCategory, setActiveCategory] = useState("all");

  const [result] = useQuery({ query: MARKETS_QUERY });
  const { data, fetching, error } = result;

  const filteredMarkets = useMemo(() => {
    const items = data?.markets?.items || [];
    
    // Map Ponder data to UI shape, fallback to MOCK_MARKETS
    const combined = items.map((item: any) => {
      const mock = MOCK_MARKETS.find(m => m.id === item.id) || MOCK_MARKETS[0];
      const yesPrice = Number(item.lastPriceWeth) / 1e18;
      const vol = Number(item.totalVolumeWeth) / 1e18;
      
      return {
        ...mock,
        id: item.id,
        yes: yesPrice > 0 ? yesPrice : mock.yes, // use real price if > 0
        volume: vol > 0 ? `$${(vol / 1000000).toFixed(1)}m` : mock.volume,
      };
    });

    const displayList = combined.length > 0 ? combined : MOCK_MARKETS;

    if (activeCategory === "all") return displayList;
    return displayList.filter((m) => m.category === activeCategory);
  }, [activeCategory, data]);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-abyss text-foreground">
      <div className="noise-overlay" />

      {/* NAV */}
      <NavBar />

      {/* HEADER STRIP */}
      <section className="relative z-10 mx-auto mt-20 w-full max-w-[1400px] px-8">
        <div className="flex items-end justify-between">
          <div>
            <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
              / 02 · markets array
            </span>
            <h1 className="mt-4 font-display text-[64px] font-light leading-[0.92] tracking-[-0.04em]">
              liquidity, <span className="italic font-extralight text-white/55">bounded.</span>
            </h1>
            <p className="mt-5 max-w-md text-[13px] leading-relaxed text-white/55">
              every market settles probabilistically. no forced exits, no cascading liquidations.
              drop intent, route through the solver mesh.
            </p>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {(["all", "macro", "yield", "rates", "vol", "stable", "rwa", "lst"] as const).map((cat) => (
              <FilterPill
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* GLOBAL DATA HEADER BAR (64px) */}
      <section className="relative z-10 mx-auto mt-10 w-full max-w-[1400px] px-8">
        <div className="omni-glass-heavy flex h-16 items-center justify-between rounded-xl px-6">
          <HeaderMetric label="total value locked" value="$1.524b" />
          <Divider />
          <HeaderMetric label="24h intent volume" value="$184.2m" />
          <Divider />
          <HeaderMetric label="active markets" value="184" />
          <Divider />
          <HeaderMetric label="settlement latency" value="218ms" accent />
          <Divider />
          <HeaderMetric label="solver agents" value="42" />
        </div>
      </section>

      {/* MASONRY GRID */}
      <section className="relative z-10 mx-auto mt-10 w-full max-w-[1400px] px-8 pb-32">
        <div className="columns-1 gap-5 md:columns-2 lg:columns-3 [column-fill:_balance]">
          {filteredMarkets.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.04 }}
              className="mb-5 break-inside-avoid"
            >
              <MarketCard m={m} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 mx-auto w-full max-w-[1400px] px-8 pb-14">
        <div className="flex items-center justify-between border-t border-white/5 pt-6 tabular text-[10px] uppercase tracking-[0.22em] text-white/35">
          <span>omniverse · v4.0 · mainnet</span>
          <span>{fetching ? '...' : filteredMarkets.length} markets · live mempool</span>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function HeaderMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-[9px] uppercase tracking-[0.24em] text-white/35">{label}</span>
      <span
        className={`tabular text-[16px] font-light ${accent ? "text-[#00FFAA]" : "text-white/95"}`}
        style={accent ? { textShadow: "0 0 18px rgba(0,255,170,0.35)" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-white/8" />;
}

function FilterPill({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-5 py-2.5 tabular text-[11px] uppercase tracking-[0.22em] font-medium ease-precision ${
        active
          ? "border-[#00FFAA]/50 bg-[#00FFAA]/[0.08] text-[#00FFAA] shadow-[0_0_12px_rgba(0,255,170,0.15)]"
          : "border-white/20 bg-white/[0.02] text-white/60 hover:border-white/40 hover:bg-white/[0.05] hover:text-white/90"
      }`}
    >
      {label}
    </button>
  );
}

function MarketCard({ m }: { m: Market }) {
  // Variable card height for masonry feel
  const tall = m.yes >= 0.7 || m.category === "macro";

  return (
    <SpotlightCard className="p-6">
      {/* head */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-sm border border-white/15 bg-white/[0.02]">
            <span className="h-1 w-1 rounded-full bg-white/70" />
          </span>
          <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/55">
            {m.symbol}
          </span>
        </div>
        <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/30">
          {m.category}
        </span>
      </div>

      {/* question */}
      <h3 className="mt-5 text-[15px] font-light leading-snug tracking-[-0.01em] text-white/90">
        {m.question}
      </h3>

      {/* spline chart */}
      <div className="mt-5">
        <MiniSpline points={m.curve} />
      </div>

      {/* metrics row */}
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
        <MetricCell label="volume" value={m.volume} />
        <MetricCell label="tvl" value={m.tvl} />
        <MetricCell label="apr" value={m.apr ?? "—"} />
      </div>

      {/* probability row */}
      <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
        <Probability side="yes" value={m.yes} favored={m.yes >= 0.5} />
        <div className="h-6 w-px bg-white/8" />
        <Probability side="no" value={1 - m.yes} favored={m.yes < 0.5} />
      </div>

      {/* CTA - sign intent */}
      <Link
        to="/markets/$id"
        params={{ id: m.id }}
        className="mt-5 group/btn flex w-full items-center justify-between rounded-full border border-white/10 bg-white/[0.015] px-4 py-2.5 ease-precision hover:border-white/25 hover:bg-white/[0.03]"
      >
        <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/65 group-hover/btn:text-white">
          sign intent
        </span>
        <span className="tabular text-[10px] text-white/40 transition-transform duration-300 ease-precision group-hover/btn:translate-x-1 group-hover/btn:text-white">
          →
        </span>
      </Link>


      {tall && (
        <div className="mt-5 flex items-center gap-2 border-t border-white/5 pt-4">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#00FFAA]/60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-[#00FFAA]" />
          </span>
          <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/40">
            solver mesh · {Math.floor(8 + m.yes * 30)} routes active
          </span>
        </div>
      )}
    </SpotlightCard>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-[9px] uppercase tracking-[0.2em] text-white/35">{label}</span>
      <span className="tabular mt-1 text-[13px] font-light text-white/90">{value}</span>
    </div>
  );
}

function Probability({ side, value, favored }: { side: "yes" | "no"; value: number; favored: boolean }) {
  return (
    <div className="flex flex-1 items-center gap-2">
      <span className="tabular text-[9px] uppercase tracking-[0.24em] text-white/40">{side}</span>
      <span className={`tabular text-[18px] font-light ${favored ? "text-white" : "text-white/45"}`}>
        {value.toFixed(2)}
      </span>
      {favored && (
        <span
          className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00FFAA]"
          style={{ boxShadow: "0 0 10px rgba(0,255,170,0.55)" }}
        />
      )}
    </div>
  );
}

function MiniSpline({ points }: { points: number[] }) {
  const W = 260;
  const H = 56;
  const path = useMemo(() => {
    const step = W / (points.length - 1);
    const ys = points.map((p) => H - p * (H - 6) - 3);
    let d = `M 0 ${ys[0].toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      const px = (i - 1) * step;
      const x = i * step;
      const cx1 = px + step / 2;
      const cx2 = px + step / 2;
      d += ` C ${cx1.toFixed(2)} ${ys[i - 1].toFixed(2)}, ${cx2.toFixed(2)} ${ys[i].toFixed(2)}, ${x.toFixed(2)} ${ys[i].toFixed(2)}`;
    }
    return { d, lastY: ys[ys.length - 1], firstY: ys[0] };
  }, [points]);

  const last = points[points.length - 1];
  const up = last >= points[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spline-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="spline-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor={up ? "rgba(0,255,170,0.95)" : "rgba(255,255,255,0.9)"} />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      {/* fill */}
      <path d={`${path.d} L ${W} ${H} L 0 ${H} Z`} fill="url(#spline-fade)" />
      {/* line */}
      <path d={path.d} stroke="url(#spline-line)" strokeWidth="1.25" fill="none" />
      {/* end dot */}
      <circle cx={W - 1} cy={path.lastY} r="2" fill={up ? "#00FFAA" : "#ffffff"} />
    </svg>
  );
}
