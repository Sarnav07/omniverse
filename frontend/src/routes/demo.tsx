import { createFileRoute } from "@tanstack/react-router";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { PresentModeContext } from "./__root";
import { motion, AnimatePresence } from "motion/react";
import { NavBar } from "@/components/nav-bar";
import { useDemoManifest } from "@/hooks/useDemoManifest";
import { usePoolPrice, usePoolReserves } from "@/hooks/useLiveDemoReads";
import { useDemoTrades } from "@/hooks/useDemoTrades";
import { assembleDashboardData } from "@/lib/dashboardData";
import { WCurveLive } from "@/components/w-curve-live";
import { AttackTranscript } from "@/components/attack-transcript";
import { LpShieldPanel } from "@/components/lp-shield-panel";
import { DataSourceBadge } from "@/components/data-source-badge";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Live Demo — Omniverse" },
      {
        name: "description",
        content:
          "Live dashboard of dynamic-lambda protection: bot value saved, LP shield, risk-free borrowing.",
      },
    ],
  }),
  component: DemoPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

function DemoPage() {
  // ── Live data hooks ──────────────────────────────────────────────────────
  const presentMode = useContext(PresentModeContext);
  const { data: manifest } = useDemoManifest();
  const { price: livePrice } = usePoolPrice(manifest?.poolWeth);
  const { reserves } = usePoolReserves(manifest?.poolWeth);
  const { trades, isLoading: tradesLoading, refetch: refetchTrades } = useDemoTrades(manifest?.conditionId, "WETH");

  const dashboard = manifest
    ? assembleDashboardData(manifest, livePrice, reserves, trades)
    : null;

  const liveYes = dashboard ? dashboard.priceFloat : 0.5;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-abyss text-foreground">
      {/* very subtle blurred light source — single monochrome wash */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[60vh] opacity-[0.35]"
        style={{
          background: "radial-gradient(60% 60% at 50% 0%, rgba(255,255,255,0.08), transparent 70%)",
        }}
      />
      <div className="noise-overlay" />

      <NavBar />

      <main className="relative z-10 mx-auto w-full max-w-[1400px] px-8 pt-14 pb-32">
        <PageHeader />

        {/* ─── Live Proof Section (when demo manifest present) ─────────────── */}
        {manifest && dashboard && (
          <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-12">
            <Panel className="md:col-span-8 p-6" label="04 · dynamic market defenses · live">
              <div className="mb-2 flex items-center justify-between">
                {!presentMode && <DataSourceBadge source={dashboard.priceSource} />}
              </div>
              <WCurveLive
                price={dashboard.priceFloat}
                lambdaWad={dashboard.lambdaWad}
                source={dashboard.priceSource}
              />
            </Panel>

            <Panel className="md:col-span-4 p-6" label="02 · lp safety shield · live">
              <div className="mb-2">
                {!presentMode && <DataSourceBadge source={dashboard.reserveSource} />}
              </div>
              <LpShieldPanel reserves={reserves} source={dashboard.reserveSource} />
            </Panel>

            <Panel className="md:col-span-12 p-6" label="07 · attack transcript · indexed">
              <AttackTranscript
                trades={dashboard.attackTrades}
                isLoading={tradesLoading}
                source={dashboard.priceSource === "unavailable" ? "unavailable" : "indexed"}
              />
            </Panel>
          </div>
        )}

        {/* ─── Row 1 — Core ──────────────────────────────────────────────── */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
          <Panel className="md:col-span-5 p-6" label="01 · live activity">
            <LiveActivityFeed trades={dashboard?.allTrades.slice(0, 8) ?? []} price={liveYes} />
            {!presentMode && <DataSourceBadge source={dashboard ? "indexed" : "unavailable"} />}
          </Panel>

          {!manifest && (
            <Panel className="md:col-span-3 p-6" label="02 · lp safety shield">
              <SafetyShield shielded={0.96} />
            </Panel>
          )}

          <Panel className="md:col-span-4 p-6" label="03 · cumulative value saved">
            <ValueSaved total={dashboard ? Number(dashboard.allTrades.reduce((sum, t) => sum + t.size, 0n)) / 1e18 : 0} />
            {!presentMode && <DataSourceBadge source={dashboard ? "computed" : "unavailable"} />}
          </Panel>
        </div>

        {/* ─── Row 2 — Deep Dive (fallback when no manifest) ────────────── */}
        {!manifest && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
            <Panel className="md:col-span-8 p-6" label="04 · dynamic market defenses">
              <WCurve price={liveYes} />
            </Panel>

            <Panel className="md:col-span-4 p-6" label="05 · zero-liquidation lending">
              <RiskFreeBorrow />
            </Panel>
          </div>
        )}

        {/* ─── Verified Strip ───────────────────────────────────────────── */}
        <VerifiedStrip />
      </main>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
          / live demo · arbitrum stylus
        </span>
        <h1 className="mt-4 max-w-2xl text-balance text-4xl font-extralight leading-[1.05] tracking-[-0.035em] md:text-[2.75rem]">
          Stop losing money to bots.
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/50">
          A single market, observed live. Watch dynamic liquidity bound risk to zero as toxic flow
          arrives.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SyncDot />
        <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
          live · block #248,194,021
        </span>
      </div>
    </header>
  );
}

function SyncDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
      <span
        className="relative h-1.5 w-1.5 rounded-full bg-white"
        style={{ boxShadow: "0 0 10px rgba(255,255,255,0.6)" }}
      />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel primitive — strict monochrome frosted glass
// ─────────────────────────────────────────────────────────────────────────────

function Panel({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      className={`group relative overflow-hidden rounded-2xl ease-precision ${className}`}
      style={{
        background: "rgba(255,255,255,0.022)",
        backdropFilter: "blur(24px) saturate(140%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 30px 80px -40px rgba(0,0,0,0.8)",
        transition: "background 0.5s var(--ease-precision)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "rgba(255,255,255,0.012)" }}
      />
      {label && (
        <div className="tabular mb-5 text-[9px] uppercase tracking-[0.3em] text-white/35">
          / {label}
        </div>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 1 — Live Activity Feed + Thermometer
// ─────────────────────────────────────────────────────────────────────────────

function LiveActivityFeed({ trades, price }: { trades: any[]; price: number }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Thermometer */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
            market probability
          </span>
          <span className="tabular text-2xl font-extralight text-white">
            {(price * 100).toFixed(1)}
            <span className="text-white/40 text-sm">%</span>
          </span>
        </div>
        <div className="relative h-[5px] w-full overflow-hidden rounded-full bg-white/[0.05]">
          <motion.div
            animate={{ width: `${price * 100}%` }}
            transition={{ type: "spring", stiffness: 110, damping: 22 }}
            className="absolute left-0 top-0 h-full"
            style={{
              background: "linear-gradient(90deg, rgba(255,255,255,0.55), rgba(255,255,255,0.9))",
            }}
          />
          <motion.div
            animate={{ left: `${price * 100}%` }}
            transition={{ type: "spring", stiffness: 110, damping: 22 }}
            className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-white"
            style={{ boxShadow: "0 0 8px rgba(255,255,255,0.7)" }}
          />
        </div>
        <div className="tabular mt-1.5 flex justify-between text-[9px] uppercase tracking-[0.2em] text-white/25">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Feed */}
      <div className="flex flex-col">
        <div className="tabular mb-2 grid grid-cols-12 text-[9px] uppercase tracking-[0.2em] text-white/30">
          <span className="col-span-2">side</span>
          <span className="col-span-3 text-right">size</span>
          <span className="col-span-2 text-right">px</span>
          <span className="col-span-2 text-right">block</span>
          <span className="col-span-3 text-right">trader</span>
        </div>
        <div className="relative h-[260px] overflow-hidden">
          <AnimatePresence initial={false}>
            {trades.map((t, i) => (
              <motion.div
                key={t.id || i}
                initial={{ opacity: 0, y: -12 }}
                animate={{
                  opacity: Math.max(0.15, 1 - i * 0.08),
                  y: 0,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="tabular grid grid-cols-12 items-center border-b border-white/[0.04] py-2 text-[11px]"
              >
                <span
                  className={`col-span-2 uppercase tracking-[0.18em] text-[9px] ${
                    t.sideLabel === "BUY YES" || t.side === "YES" ? "text-white" : "text-white/50"
                  }`}
                >
                  {t.sideLabel || t.side || "YES"}
                </span>
                <span className="col-span-3 text-right text-white/85">
                  {t.size ? (Number(t.size) / 1e18).toFixed(0) : t.size?.toFixed?.(0) || "0"}
                </span>
                <span className="col-span-2 text-right text-white/55">
                  {t.priceAfter ? (Number(t.priceAfter) / 1e18).toFixed(3) : t.price?.toFixed?.(3) || "—"}
                </span>
                <span className="col-span-2 text-right text-white">
                  {t.blockNumber || "—"}
                </span>
                <span className="col-span-3 text-right text-white/40">
                  {t.trader ? `${t.trader.slice(0, 6)}...${t.trader.slice(-3)}` : t.trader || "—"}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
            style={{
              background: "linear-gradient(to bottom, transparent, var(--abyss))",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 2 — Monochrome donut "LP Safety Shield"
// ─────────────────────────────────────────────────────────────────────────────

function SafetyShield({ shielded }: { shielded: number }) {
  const R = 64;
  const C = 2 * Math.PI * R;
  const dash = shielded * C;
  return (
    <div className="flex h-full flex-col items-center justify-between">
      <div className="relative grid place-items-center">
        <svg width="170" height="170" viewBox="0 0 170 170">
          {/* track */}
          <circle
            cx="85"
            cy="85"
            r={R}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="6"
            fill="none"
          />
          {/* shielded arc */}
          <motion.circle
            cx="85"
            cy="85"
            r={R}
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            transform="rotate(-90 85 85)"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C - dash }}
            transition={{ type: "spring", stiffness: 90, damping: 22 }}
            style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.35))" }}
          />
          {/* inner shield icon */}
          <g
            transform="translate(85 85)"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1"
            fill="none"
          >
            <path
              d="M 0 -22 L 18 -14 L 18 6 C 18 16 10 22 0 26 C -10 22 -18 16 -18 6 L -18 -14 Z"
              strokeLinejoin="round"
            />
          </g>
        </svg>
        <div className="absolute -bottom-1 text-center">
          <div className="tabular text-[10px] uppercase tracking-[0.22em] text-white/40">
            protected
          </div>
        </div>
      </div>

      <div className="mt-4 w-full text-center">
        <div className="tabular text-4xl font-extralight tracking-tight text-white">
          {(shielded * 100).toFixed(1)}
          <span className="text-white/40 text-base">%</span>
        </div>
        <div className="tabular mt-1 text-[10px] uppercase tracking-[0.2em] text-white/40">
          of lp value insulated
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 3 — Cumulative Value Saved (massive number)
// ─────────────────────────────────────────────────────────────────────────────

function ValueSaved({ total }: { total: number }) {
  const display = useMemo(() => {
    return total.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [total]);

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
        usdc saved from toxic flow
      </div>
      <div className="my-6">
        <div className="flex items-baseline gap-1">
          <span className="text-white/45 text-2xl font-light">$</span>
          <span className="tabular text-[64px] font-extralight leading-none tracking-[-0.045em] text-white">
            {display}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-4">
        {[
          { k: "24h", v: "+184k" },
          { k: "7d", v: "+912k" },
          { k: "all", v: "$2.48m" },
        ].map((s) => (
          <div key={s.k}>
            <div className="tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
              {s.k}
            </div>
            <div className="tabular mt-1 text-[14px] font-light text-white/90">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 4 — W-Curve (single 1px white line)
// ─────────────────────────────────────────────────────────────────────────────

function WCurve({ price }: { price: number }) {
  // λ*(p) — high at edges, dip in middle. Synthesize a W-ish curve.
  const W = 720;
  const H = 240;
  const pad = 28;

  const path = useMemo(() => {
    const pts: string[] = [];
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      // W curve: two humps with central trough
      const lam =
        0.18 +
        0.85 *
          (Math.pow(2 * (p - 0.5), 2) * 0.6 + Math.pow(Math.sin(p * Math.PI), 2) * -0.42 + 0.5);
      const x = pad + p * (W - 2 * pad);
      const y = H - pad - Math.max(0, Math.min(1, lam - 0.1)) * (H - 2 * pad);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(" ");
  }, []);

  const dotX = pad + price * (W - 2 * pad);
  // approximate y at this price using the same formula
  const lamAt = useMemo(() => {
    const p = price;
    const lam =
      0.18 +
      0.85 * (Math.pow(2 * (p - 0.5), 2) * 0.6 + Math.pow(Math.sin(p * Math.PI), 2) * -0.42 + 0.5);
    return lam;
  }, [price]);
  const dotY = H - pad - Math.max(0, Math.min(1, lamAt - 0.1)) * (H - 2 * pad);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
            optimal activeness λ*(p)
          </div>
          <div className="mt-1 text-[13px] text-white/55">
            Liquidity contracts as probability approaches 0 or 1 — bots find no edge.
          </div>
        </div>
        <div className="tabular text-right">
          <div className="text-[9px] uppercase tracking-[0.22em] text-white/35">current λ*</div>
          <div className="text-2xl font-extralight text-white">{lamAt.toFixed(3)}</div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-[240px] w-full">
          {/* grid */}
          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={`v${g}`}
              x1={pad + g * (W - 2 * pad)}
              x2={pad + g * (W - 2 * pad)}
              y1={pad}
              y2={H - pad}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          ))}
          {[0.33, 0.66].map((g) => (
            <line
              key={`h${g}`}
              x1={pad}
              x2={W - pad}
              y1={pad + g * (H - 2 * pad)}
              y2={pad + g * (H - 2 * pad)}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          ))}
          {/* axes */}
          <line
            x1={pad}
            x2={W - pad}
            y1={H - pad}
            y2={H - pad}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
          <line
            x1={pad}
            x2={pad}
            y1={pad}
            y2={H - pad}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
          {/* the W curve */}
          <motion.path
            d={path}
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="1.1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.18))" }}
          />
          {/* current dot */}
          <motion.g
            animate={{ x: dotX, y: dotY }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          >
            <circle r="14" fill="rgba(255,255,255,0.06)">
              <animate attributeName="r" values="6;16;6" dur="2.4s" repeatCount="indefinite" />
              <animate
                attributeName="opacity"
                values="0.6;0;0.6"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </circle>
            <circle r="3.5" fill="white" />
          </motion.g>

          {/* axis labels */}
          <text x={pad} y={H - 8} fill="rgba(255,255,255,0.3)" fontSize="9" letterSpacing="2">
            P=0
          </text>
          <text x={W / 2 - 8} y={H - 8} fill="rgba(255,255,255,0.3)" fontSize="9" letterSpacing="2">
            0.5
          </text>
          <text
            x={W - pad - 18}
            y={H - 8}
            fill="rgba(255,255,255,0.3)"
            fontSize="9"
            letterSpacing="2"
          >
            P=1
          </text>
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 5 — Zero-Liquidation Lending (balance + lock)
// ─────────────────────────────────────────────────────────────────────────────

function RiskFreeBorrow() {
  return (
    <div className="flex h-full flex-col gap-6">
      {/* Thin line balance + lock */}
      <div className="relative mx-auto h-[120px] w-[200px]">
        <svg viewBox="0 0 200 120" className="h-full w-full">
          {/* pivot */}
          <line x1="100" y1="14" x2="100" y2="62" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
          {/* beam */}
          <line x1="30" y1="62" x2="170" y2="62" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
          {/* pans */}
          <line x1="30" y1="62" x2="30" y2="78" stroke="rgba(255,255,255,0.4)" />
          <line x1="170" y1="62" x2="170" y2="78" stroke="rgba(255,255,255,0.4)" />
          <path
            d="M 14 78 Q 30 96 46 78"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M 154 78 Q 170 96 186 78"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1"
            fill="none"
          />
          {/* lock icon center top */}
          <g transform="translate(100 8)" stroke="white" strokeWidth="1" fill="none">
            <rect x="-6" y="0" width="12" height="9" rx="1.5" />
            <path d="M -3.5 0 V -3 A 3.5 3.5 0 0 1 3.5 -3 V 0" />
          </g>
        </svg>
      </div>

      <div className="space-y-3">
        <Row k="collateral" v="$12,450.00" />
        <Row k="borrowed" v="$7,820.00" />
        <Row k="ltv" v="62.8%" />
        <div className="border-t border-white/[0.06] pt-3">
          <Row k="liquidations" v="0" emphasis />
        </div>
      </div>

      <div className="tabular mt-auto text-[10px] uppercase tracking-[0.22em] text-white/40">
        no forced exits · settled at maturity
      </div>
    </div>
  );
}

function Row({ k, v, emphasis = false }: { k: string; v: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/40">{k}</span>
      <span
        className={`tabular ${
          emphasis ? "text-white text-lg font-light" : "text-white/85 text-[13px]"
        }`}
      >
        {v}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Verified strip
// ─────────────────────────────────────────────────────────────────────────────

function VerifiedStrip() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group mt-3 flex w-full items-center justify-between rounded-xl px-6 py-4 text-left ease-precision"
        style={{
          background: "rgba(255,255,255,0.018)",
          backdropFilter: "blur(24px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex items-center gap-4">
          <span
            className="grid h-6 w-6 place-items-center rounded-full border border-white/40 text-[11px] text-white"
            style={{ boxShadow: "0 0 12px rgba(255,255,255,0.18)" }}
          >
            ✓
          </span>
          <span className="tabular text-[11px] uppercase tracking-[0.28em] text-white/85">
            Verified live on Arbitrum Stylus
          </span>
        </div>
        <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/40 ease-precision group-hover:text-white">
          view proof tables →
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: "spring", stiffness: 120, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[1400px] rounded-t-2xl p-8"
              style={{
                background: "rgba(10,10,10,0.85)",
                backdropFilter: "blur(40px) saturate(160%)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 -40px 80px -30px rgba(0,0,0,0.8)",
              }}
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="tabular text-[10px] uppercase tracking-[0.28em] text-white/45">
                    / on-chain proof
                  </div>
                  <h3 className="mt-2 text-xl font-extralight tracking-tight">
                    Raw trade & rebalance log
                  </h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="tabular rounded-full border border-white/15 px-4 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white/60 ease-precision hover:border-white/40 hover:text-white"
                >
                  close
                </button>
              </div>

              <div className="grid grid-cols-12 gap-4 border-b border-white/[0.06] pb-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
                <span className="col-span-2">block</span>
                <span className="col-span-2">type</span>
                <span className="col-span-3">tx hash</span>
                <span className="col-span-2 text-right">size</span>
                <span className="col-span-2 text-right">λ</span>
                <span className="col-span-1 text-right">ℓ</span>
              </div>
              <div className="max-h-[40vh] overflow-y-auto">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="tabular grid grid-cols-12 gap-4 border-b border-white/[0.04] py-2 text-[11px]"
                  >
                    <span className="col-span-2 text-white/55">
                      #{(248_194_021 - i).toLocaleString()}
                    </span>
                    <span className="col-span-2 text-white/70">
                      {i % 3 === 0 ? "rebalance" : "trade"}
                    </span>
                    <span className="col-span-3 text-white/45">
                      0x{Math.random().toString(16).slice(2, 14)}…
                    </span>
                    <span className="col-span-2 text-right text-white/85">
                      ${(120 + Math.random() * (4800 - 120)).toFixed(0)}
                    </span>
                    <span className="col-span-2 text-right text-white/85">
                      {(0.2 + Math.random() * (0.9 - 0.2)).toFixed(3)}
                    </span>
                    <span className="col-span-1 text-right text-white/85">
                      {(0.4 + Math.random() * (1.1 - 0.4)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
