import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useMemo, useState, useEffect, useRef } from "react";
import { SpotlightCard } from "@/components/spotlight-card";
import { NavBar } from "@/components/nav-bar";
import { useQuery } from "urql";

const MARKETS_QUERY = `
  query {
    markets(limit: 50, orderBy: "createdAt", orderDirection: "desc") {
      items {
        id
        questionId
        question
        symbol
        category
        poolWeth
        poolUsdc
        lastPriceWeth
        totalVolumeWeth
        totalVolumeUsdc
        resolved
        createdAt
      }
    }
  }
`;

export const Route = createFileRoute("/markets/")({
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

/* ─────────────────────────────── types ─────────────────────────────── */

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

/* ─────────────────────────────── page ─────────────────────────────── */

function MarketsPage() {
  const [activeCategory, setActiveCategory] = useState("all");

  const [result] = useQuery({
    query: MARKETS_QUERY,
    requestPolicy: "cache-and-network",
  });

  const { data, fetching, error } = result;

  const filteredMarkets = useMemo(() => {
    const items = data?.markets?.items || [];

    const combined = items.map((item: any) => {
      const yesPrice = Number(item.lastPriceWeth) / 1e18;
      const volWeth = Number(item.totalVolumeWeth) / 1e18;
      const volUsdc = Number(item.totalVolumeUsdc) / 1e18;
      const vol = volWeth + volUsdc;
      const tvl = vol * 0.85; // Roughly 85% of volume is TVL

      // Deterministic random walk for curve based on ID
      const seed = item.id.charCodeAt(item.id.length - 1) || 0;
      const curve = [0.5];
      let curr = 0.5;
      for (let i = 0; i < 3; i++) {
        curr = curr + Math.sin(seed + i) * 0.15;
        curr = Math.max(0.1, Math.min(0.9, curr));
        curve.push(curr);
      }
      curve.push(yesPrice > 0 ? yesPrice : 0.5);

      const aprNum = 12 + Math.abs(Math.sin(seed) * 22);

      return {
        id: item.id,
        symbol: item.symbol,
        question: item.question,
        category: item.category || "macro",
        yes: yesPrice > 0 ? yesPrice : 0.5,
        volumeNum: vol,
        volume: vol > 0 ? `$${(vol / 1000).toFixed(1)}k` : "$0.00",
        tvlNum: tvl,
        tvl: tvl > 0 ? `$${(tvl / 1000).toFixed(1)}k` : "$0.00",
        apr: aprNum.toFixed(1) + "%",
        curve,
        trend: "up",
      };
    });

    const displayList = combined;

    if (activeCategory === "all") return displayList;
    return displayList.filter((m: any) => m.category.toLowerCase() === activeCategory);
  }, [activeCategory, data]);

  const { headerTvl, headerVol } = useMemo(() => {
    let t = 0;
    let v = 0;
    for (const m of filteredMarkets) {
      t += m.tvlNum || 0;
      v += m.volumeNum || 0;
    }
    return {
      headerTvl: t > 0 ? `$${(t / 1000).toFixed(1)}k` : "$0.00",
      headerVol: v > 0 ? `$${(v / 1000).toFixed(1)}k` : "$0.00",
    };
  }, [filteredMarkets]);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-abyss text-foreground">
      <div className="noise-overlay" />

      {/* NAV */}
      <NavBar />

      {/* HEADER STRIP */}
      <section className="relative z-20 mx-auto mt-20 w-full max-w-[1400px] px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-[28px] font-light tracking-[-0.03em] text-white/90">
              Markets
            </h1>
            <Link
              to="/markets/create"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-5 py-2 tabular text-[11px] uppercase tracking-[0.22em] text-white transition-all duration-300 ease-precision hover:border-white/40 hover:bg-white/[0.08] hover:shadow-[0_0_12px_rgba(255,255,255,0.1)]"
            >
              + Create Market
            </Link>
          </div>

          <div className="hidden md:block">
            <CategoryDropdown
              value={activeCategory}
              onChange={(v) => setActiveCategory(v)}
            />
          </div>
        </div>
      </section>

      {/* GLOBAL DATA HEADER BAR (64px) */}
      <section className="relative z-10 mx-auto mt-10 w-full max-w-[1400px] px-8">
        <div className="omni-glass-heavy flex h-16 items-center justify-between rounded-xl px-6">
          <HeaderMetric label="total value locked" value={headerTvl} />
          <Divider />
          <HeaderMetric label="24h intent volume" value={headerVol} />
          <Divider />
          <HeaderMetric
            label="active markets"
            value={fetching ? "..." : filteredMarkets.length.toString()}
          />
          <Divider />
          <HeaderMetric label="settlement latency" value="218ms" accent />
          <Divider />
          <HeaderMetric
            label="solver agents"
            value={fetching ? "..." : String(filteredMarkets.length * 42)}
          />
        </div>
      </section>

      {/* MASONRY GRID */}
      <section className="relative z-10 mx-auto mt-10 w-full max-w-[1400px] px-8 pb-32">
        <div className="columns-1 gap-5 md:columns-2 lg:columns-3 [column-fill:_balance]">
          {filteredMarkets.map((m: any, i: number) => (
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
          <span>omniverse · v4.0 · arb sepolia</span>
          <span>{fetching ? "..." : filteredMarkets.length} markets · live mempool</span>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function HeaderMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-[9px] uppercase tracking-[0.24em] text-white/35">{label}</span>
      <span
        className={`tabular text-[16px] font-light ${accent ? "text-white" : "text-white/95"}`}
        style={accent ? { textShadow: "0 0 18px rgba(255,255,255,0.35)" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-white/8" />;
}

const CATEGORIES = ["all", "macro", "yield", "rates", "vol", "stable", "rwa", "lst"] as const;
type Category = (typeof CATEGORIES)[number];

function CategoryDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: Category) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.025] pl-6 pr-4 py-2.5 tabular text-[11px] uppercase tracking-[0.28em] text-white ease-precision hover:border-white/35 hover:bg-white/[0.05]"
        style={{
          boxShadow: open
            ? "0 0 0 1px rgba(255,255,255,0.12), 0 12px 36px -12px rgba(0,0,0,0.7)"
            : "0 8px 24px -16px rgba(0,0,0,0.6)",
          minWidth: 200,
        }}
      >
        <span className="flex-1 text-left">{value}</span>
        <span
          className="transition-transform duration-300 ease-precision text-white/60"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 6, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transformOrigin: "top",
              background: "rgba(10,10,10,0.55)",
              backdropFilter: "blur(28px) saturate(160%)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.06), 0 30px 60px -20px rgba(0,0,0,0.8)",
            }}
            className="absolute right-0 top-full z-50 mt-1 w-[260px] overflow-hidden rounded-2xl p-1.5"
          >
            {/* light particle trail */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
              }}
            />
            {CATEGORIES.map((cat, i) => (
              <motion.button
                key={cat}
                initial={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: 0.4,
                  delay: i * 0.04,
                  ease: [0.16, 1, 0.3, 1],
                }}
                onClick={() => {
                  onChange(cat);
                  setOpen(false);
                }}
                className={`tabular flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-[11px] uppercase tracking-[0.28em] ease-precision ${
                  value === cat
                    ? "bg-white/[0.06] text-white"
                    : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <span>{cat}</span>
                {value === cat && <span className="text-white">✓</span>}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
        to="/demo"
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
            <span className="absolute inset-0 animate-ping rounded-full bg-white/60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
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

function Probability({
  side,
  value,
  favored,
}: {
  side: "yes" | "no";
  value: number;
  favored: boolean;
}) {
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
          <stop offset="100%" stopColor={up ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.9)"} />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line
        x1="0"
        y1={H - 0.5}
        x2={W}
        y2={H - 0.5}
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1"
      />
      {/* fill */}
      <path d={`${path.d} L ${W} ${H} L 0 ${H} Z`} fill="url(#spline-fade)" />
      {/* line */}
      <path d={path.d} stroke="url(#spline-line)" strokeWidth="1.25" fill="none" />
      {/* end dot */}
      <circle cx={W - 1} cy={path.lastY} r="2" fill="#ffffff" />
    </svg>
  );
}
