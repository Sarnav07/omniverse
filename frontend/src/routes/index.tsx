import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { ParametricMesh } from "@/components/parametric-mesh";
import { SpotlightCard } from "@/components/spotlight-card";
import { NavBar } from "@/components/nav-bar";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OMNIVERSE — Institutional execution terminal" },
      {
        name: "description",
        content:
          "Zero-liquidation execution layer for active liquidity. Probability-bounded collateral curves, oracle-grade telemetry, and an execution desk built for funds.",
      },
      { property: "og:title", content: "OMNIVERSE — Institutional execution terminal" },
      {
        property: "og:description",
        content:
          "Zero-liquidation execution layer. Probability-bounded collateral curves and an institutional execution desk.",
      },
    ],
  }),
  component: Index,
});

const spring = { type: "spring" as const, stiffness: 320, damping: 32 };
const ease = [0.16, 1, 0.3, 1] as const;

function Index() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-abyss text-foreground">
      <div className="noise-overlay" />


      {/* NAV */}
      <NavBar hideWallet />

      {/* HERO */}
      <section className="relative z-10 mx-auto w-full max-w-[1400px] px-8 pt-32 pb-40">
        <ParametricMesh />
        {/* horizontal axis line anchoring floating data */}
        <div className="pointer-events-none absolute left-8 right-8 top-[55%] hidden h-px bg-white/[0.05] md:block" />

        <DataCallout
          className="absolute right-8 top-[52%] md:right-16"
          value="+65,210"
          label="positions opened"
        />
        <DataCallout
          className="absolute left-8 top-[52%] md:left-16"
          value="$1.524b"
          label="tvl protected"
          align="left"
        />

        <div className="relative mx-auto max-w-[1100px] text-center">
          <div className="tabular mb-12 text-[10px] uppercase tracking-[0.32em] text-white/70" style={{ textShadow: "0 0 18px rgba(3,3,3,0.9)" }}>
            / 01 · execution layer
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.05 }}
            className="font-display text-balance text-[14vw] font-light leading-[0.88] tracking-[-0.045em] md:text-[8.5rem]"
            style={{ textShadow: "0 0 40px rgba(3,3,3,0.85)" }}
          >
            protect <span className="italic font-extralight text-white/85">your</span> yields
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="mx-auto mt-12 max-w-md text-balance text-[14px] leading-relaxed text-white/80"
            style={{ textShadow: "0 0 24px rgba(3,3,3,0.95)" }}
          >
            a zero-liquidation execution layer for active liquidity. probability-bounded
            collateral, settled without forced exits.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.35 }}
            className="mt-14 flex items-center justify-center gap-3"
          >
            <button className="group relative overflow-hidden rounded-full border border-white/20 px-7 py-3 text-[12px] tracking-wide text-white transition-colors duration-500 ease-precision hover:text-abyss"
              style={{ backdropFilter: "blur(10px)" }}>
              <span className="absolute inset-0 -translate-x-full bg-white transition-transform duration-500 ease-precision group-hover:translate-x-0" />
              <span className="relative">enter terminal →</span>
            </button>
            <button className="rounded-full px-7 py-3 text-[12px] text-white/55 transition-colors duration-300 ease-precision hover:text-white">
              read whitepaper
            </button>
          </motion.div>
        </div>

        {/* corner technical brackets */}
        <CornerBracket className="left-8 top-24" pos="tl" />
        <CornerBracket className="right-8 top-24" pos="tr" />
      </section>

      {/* METRICS BAR — enclosed dashboard */}
      <section className="relative z-10 mx-auto w-full max-w-[1400px] px-8">
        <div className="omni-glass grid grid-cols-2 divide-x divide-white/5 rounded-xl md:grid-cols-4">
          {[
            { k: "active markets", v: "1,284", d: "+18 24h" },
            { k: "median apy", v: "12.43", u: "%", d: "γ-bounded" },
            { k: "oracle latency", v: "240", u: "ms", d: "p99 480" },
            { k: "liquidations", v: "0", d: "since genesis" },
          ].map((s) => (
            <div key={s.k} className="flex flex-col px-6 py-6">
              <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/35">
                {s.k}
              </span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="tabular text-[28px] font-light tracking-tight">{s.v}</span>
                {s.u && <span className="tabular text-sm text-white/40">{s.u}</span>}
              </div>
              <span className="tabular mt-1 text-[10px] uppercase tracking-[0.18em] text-white/30">
                {s.d}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* BENTO */}
      <section className="relative z-10 mx-auto w-full max-w-[1400px] px-8 py-32">
        <div className="mb-16 flex items-end justify-between">
          <div>
            <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
              / 02 · capabilities
            </span>
            <h2 className="mt-4 max-w-2xl text-balance text-4xl font-light leading-[1.05] tracking-[-0.035em] md:text-5xl">
              built for traders who survived the last cycle.
            </h2>
          </div>
          <a href="#" className="hidden text-[12px] text-white/50 ease-precision hover:text-white md:block">
            view all primitives →
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
          {/* THREAT DETECTION — radar sweep */}
          <SpotlightCard className="md:row-span-2 p-8">
            <CardIndex n="01" label="threat detection" />
            <h3 className="mt-5 text-[22px] font-light leading-tight tracking-[-0.02em]">
              proactive threat detection
            </h3>
            <p className="mt-3 max-w-[28ch] text-[13px] leading-relaxed text-white/50">
              continuous oracle-drift, mempool-sandwich and liquidity-flight monitoring.
              anomalies are quarantined before they touch reserves.
            </p>

            <div className="relative mt-12 aspect-square">
              <RadarSweep />
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="tabular font-display text-4xl font-light tracking-tight">
                    99.94<span className="text-white/30">%</span>
                  </div>
                  <div className="tabular mt-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
                    detection coverage
                  </div>
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* EXPERTISE — spline chart */}
          <SpotlightCard className="p-8">
            <CardIndex n="02" label="track record" />
            <h3 className="mt-5 text-[22px] font-light leading-tight tracking-[-0.02em]">
              fourteen years of quant track.
            </h3>
            <div className="tabular mt-6 flex items-baseline gap-2">
              <span className="font-display text-[64px] font-extralight leading-none tracking-[-0.04em]">
                14
              </span>
              <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                yrs · 4 cycles
              </span>
            </div>
            <SplineChart />
          </SpotlightCard>

          {/* ZERO LIQUIDATION — precision slider */}
          <SpotlightCard className="p-8">
            <CardIndex n="03" label="invariant" />
            <h3 className="mt-5 text-[22px] font-light leading-tight tracking-[-0.02em]">
              zero-liquidation logic
            </h3>
            <p className="mt-3 text-[13px] leading-relaxed text-white/50">
              probability-bounded collateral curves replace hard thresholds. crashes settle,
              not cascade.
            </p>
            <PrecisionSlider />
          </SpotlightCard>

          {/* EXECUTION DESK — connecting line */}
          <SpotlightCard className="p-8 md:col-span-2">
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              <div className="flex-1">
                <CardIndex n="04" label="execution desk" />
                <h3 className="mt-5 max-w-md text-[22px] font-light leading-tight tracking-[-0.02em]">
                  drag capital. drop intent. settle without typing a digit.
                </h3>
                <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/50">
                  same-leg validation rejects mismatched collateral physically on the canvas
                  — no modals, no toasts.
                </p>
              </div>
              <ExecutionDesk />
            </div>
          </SpotlightCard>
        </div>
      </section>


      {/* CTA */}
      <section className="relative z-10 mx-auto w-full max-w-[1400px] px-8 pb-32">
        <div className="omni-glass-heavy relative overflow-hidden rounded-2xl p-16 md:p-24">
          <ParticleMesh />
          <div className="relative z-10 grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div>
              <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
                / 05 · open
              </span>
              <h2 className="mt-6 text-balance text-5xl font-light leading-[1.02] tracking-[-0.04em] md:text-7xl">
                the terminal is open.
                <br />
                <span className="text-white/35">your capital decides.</span>
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              <button className="group relative overflow-hidden rounded-full border border-white/25 px-7 py-3.5 text-[12px] tracking-wide text-white transition-colors duration-500 ease-precision hover:text-abyss">
                <span className="absolute inset-0 -translate-x-full bg-white transition-transform duration-500 ease-precision group-hover:translate-x-0" />
                <span className="relative">enter terminal →</span>
              </button>
              <button className="rounded-full border border-white/10 px-7 py-3.5 text-[12px] text-white/65 ease-precision hover:border-white/25 hover:text-white">
                book a walkthrough
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 mx-auto w-full max-w-[1400px] border-t border-white/5 px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 tabular text-[11px] uppercase tracking-[0.18em] text-white/35">
          <span>© omniverse labs · execution layer v4.0</span>
          <div className="flex items-center gap-8">
            <span className="flex items-center gap-2">
              <span className="precision-pulse h-1.5 w-1.5 rounded-full bg-white" />
              all systems nominal
            </span>
            <a className="ease-precision hover:text-white" href="#">status</a>
            <a className="ease-precision hover:text-white" href="#">github</a>
            <a className="ease-precision hover:text-white" href="#">terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────── primitives ─────────────────────────── */

function CardIndex({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="tabular text-[10px] uppercase tracking-[0.28em] text-white/50">{n}</span>
      <span className="h-px w-8 bg-white/10" />
      <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/35">{label}</span>
    </div>
  );
}

function CornerBracket({ className = "", pos }: { className?: string; pos: "tl" | "tr" }) {
  const path =
    pos === "tl" ? "M0 24 L0 0 L24 0" : "M24 24 L24 0 L0 0";
  return (
    <svg
      className={`pointer-events-none absolute hidden h-6 w-6 md:block ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path d={path} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    </svg>
  );
}

function DataCallout({
  value,
  label,
  className = "",
  align = "right",
}: {
  value: string;
  label: string;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`pointer-events-none z-10 hidden md:block ${className}`}>
      <div
        className={`flex flex-col ${align === "left" ? "items-start" : "items-end"}`}
      >
        <div className="tabular text-2xl font-light tracking-[-0.02em]">{value}</div>
        <div className="tabular mt-1.5 text-[10px] uppercase tracking-[0.22em] text-white/40">
          {label}
        </div>
        <div className={`mt-3 flex items-center gap-1.5 ${align === "left" ? "" : "flex-row-reverse"}`}>
          <span className="h-1 w-1 rounded-full bg-white/60" />
          <span className="h-px w-10 bg-white/15" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── radar ─────────────────────────── */

function RadarSweep() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
      <defs>
        <radialGradient id="radar-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id="sweep-grad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(0,229,255,0)" />
          <stop offset="100%" stopColor="rgba(0,229,255,0.45)" />
        </linearGradient>
      </defs>
      {/* micro grid */}
      <g stroke="rgba(255,255,255,0.04)" strokeWidth="0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={200} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 20} x2={200} y2={i * 20} />
        ))}
      </g>
      {/* concentric rings */}
      {[30, 55, 80, 95].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" fill="none" />
      ))}
      {/* crosshair */}
      <line x1="100" y1="5" x2="100" y2="195" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      <line x1="5" y1="100" x2="195" y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="95" fill="url(#radar-grad)" />
      {/* sweep */}
      <g className="radar-sweep" style={{ transformOrigin: "100px 100px" }}>
        <path d="M 100 100 L 195 100 A 95 95 0 0 0 100 5 Z" fill="url(#sweep-grad)" />
      </g>
      {/* detection markers */}
      <circle cx="138" cy="68" r="1.5" fill="rgba(0,229,255,0.9)" />
      <circle cx="62" cy="142" r="1.5" fill="rgba(255,140,0,0.9)" />
      <circle cx="150" cy="130" r="1.5" fill="rgba(255,255,255,0.9)" />
    </svg>
  );
}

/* ─────────────────────────── spline ─────────────────────────── */

function SplineChart() {
  // 14-year monotone-ish upward path
  const points = [10, 18, 14, 26, 38, 32, 48, 60, 54, 72, 88, 82, 102, 120];
  const W = 280, H = 80;
  const max = Math.max(...points);
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - (p / max) * H;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;
  return (
    <div className="mt-6 -mx-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full">
        <defs>
          <linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <g stroke="rgba(255,255,255,0.04)" strokeWidth="0.5">
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={0} x2={W} y1={(i * H) / 3} y2={(i * H) / 3} />
          ))}
        </g>
        <path d={area} fill="url(#area-grad)" />
        <path d={path} stroke="white" strokeWidth="1" fill="none" />
        {points.map((p, i) => {
          const x = (i / (points.length - 1)) * W;
          const y = H - (p / max) * H;
          return <circle key={i} cx={x} cy={y} r="1" fill="white" opacity={i === points.length - 1 ? 1 : 0.4} />;
        })}
      </svg>
      <div className="tabular mt-3 flex justify-between text-[9px] uppercase tracking-[0.2em] text-white/30">
        <span>2011</span>
        <span>2018</span>
        <span>2025</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── precision slider ─────────────────────────── */

function PrecisionSlider() {
  const ticks = Array.from({ length: 21 });
  const pos = 0.74;
  return (
    <div className="mt-8">
      <div className="relative">
        {/* tick marks */}
        <div className="absolute inset-x-0 -top-3 flex justify-between">
          {ticks.map((_, i) => (
            <span
              key={i}
              className="w-px bg-white/20"
              style={{ height: i % 5 === 0 ? 6 : 3 }}
            />
          ))}
        </div>
        {/* track */}
        <div className="relative h-px w-full bg-white/10">
          <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${pos * 100}%` }} />
          {/* thumb */}
          <div
            className="absolute -top-[3px] h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-white"
            style={{
              left: `${pos * 100}%`,
              boxShadow: "0 0 12px rgba(255,255,255,0.85), 0 0 24px rgba(0,229,255,0.4)",
            }}
          />
        </div>
      </div>
      <div className="tabular mt-4 flex justify-between text-[10px] uppercase tracking-[0.22em] text-white/40">
        <span>γ 0.00</span>
        <span className="text-white/80">λ* = 0.74</span>
        <span>γ 1.00</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── execution desk ─────────────────────────── */

function ExecutionDesk() {
  const pills = ["wETH 12.4", "USDC 40k", "wBTC 0.8", "rETH 6.1"];
  return (
    <div className="omni-glass-soft w-full flex-1 rounded-xl p-5 md:max-w-md">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 tabular text-[10px] uppercase tracking-[0.22em] text-white/40">
        <span>active reserve</span>
        <span className="tabular text-white/70">$124,820.41</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((t) => (
          <motion.div
            key={t}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={spring}
            className="cursor-grab select-none rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5 tabular text-[11px] text-white/85"
          >
            {t}
          </motion.div>
        ))}
      </div>
      {/* connecting routing line */}
      <svg className="mt-4 h-10 w-full" viewBox="0 0 320 40" fill="none">
        <path
          d="M 30 8 C 30 30, 160 30, 160 20 C 160 10, 290 10, 290 32"
          stroke="rgba(0,229,255,0.5)"
          strokeWidth="1"
          strokeDasharray="3 3"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="1.4s" repeatCount="indefinite" />
        </path>
        <circle cx="30" cy="8" r="2" fill="white" />
        <circle cx="290" cy="32" r="2" fill="white" />
      </svg>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.015] px-3 py-4 text-center tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
          yes-pool
        </div>
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.015] px-3 py-4 text-center tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
          no-pool
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── math band ─────────────────────────── */

function MathBand() {
  const [hover, setHover] = useState(false);
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1400px] px-8 py-24">
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="omni-glass-heavy overflow-hidden rounded-2xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr]">
          <div className="border-b border-white/5 p-12 md:border-b-0 md:border-r">
            <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
              / 03 · invariant
            </span>
            <h3 className="mt-5 text-3xl font-light leading-[1.05] tracking-[-0.035em]">
              we publish the math. <br />
              <span className="text-white/45">the math holds.</span>
            </h3>
            <p className="mt-5 max-w-md text-[13px] leading-relaxed text-white/55">
              the optimal activeness λ* bounding lp risk for any gaussian volatility γ<sub>G</sub>.
              derivation and bounds are formally verified.
            </p>
            <div className="mt-8 flex items-center gap-2">
              <button className="rounded-full border border-white/15 px-4 py-2 tabular text-[11px] uppercase tracking-[0.18em] text-white/80 ease-precision hover:border-white/40">
                whitepaper
              </button>
              <button className="rounded-full px-4 py-2 tabular text-[11px] uppercase tracking-[0.18em] text-white/55 ease-precision hover:text-white">
                audits →
              </button>
            </div>
          </div>

          <div className="relative grid place-items-center p-12">
            {/* targeted white spotlight */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at center, rgba(255,255,255,0.06), transparent 70%)",
              }}
            />
            {/* gaussian curve */}
            <svg
              viewBox="0 0 400 160"
              className="pointer-events-none absolute inset-0 m-auto h-full w-full"
              fill="none"
            >
              <path
                d="M 20 140 C 80 140, 130 140, 170 60 C 190 20, 210 20, 230 60 C 270 140, 320 140, 380 140"
                stroke="rgba(0,229,255,0.5)"
                strokeWidth="1"
                strokeDasharray="600"
                strokeDashoffset={hover ? 0 : 600}
                style={{ transition: "stroke-dashoffset 1.4s var(--ease-precision)" }}
              />
              <line x1="20" y1="140" x2="380" y2="140" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            </svg>

            {/* formula */}
            <div className="relative tabular flex items-center gap-3 text-2xl text-white/95 md:text-[28px]">
              <span className="italic font-light">λ*</span>
              <span className="text-white/40">(P</span>
              <sub className="text-xs text-white/40">true</sub>
              <span className="text-white/40">)</span>
              <span className="text-white/60">=</span>
              <Fraction
                top={
                  <>
                    1 + <Sqrt>1 + 2γ<sub className="text-[0.6em]">G</sub></Sqrt>
                  </>
                }
                bot={
                  <>
                    1 + γ<sub className="text-[0.6em]">G</sub> + <Sqrt>1 + 2γ<sub className="text-[0.6em]">G</sub></Sqrt>
                  </>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Sqrt({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-start">
      <span className="mr-0.5 text-[0.85em] text-white/70">√</span>
      <span className="border-t border-white/60 pt-px">{children}</span>
    </span>
  );
}

function Fraction({ top, bot }: { top: React.ReactNode; bot: React.ReactNode }) {
  return (
    <span className="inline-flex flex-col items-center text-base md:text-lg">
      <span className="px-2 leading-tight">{top}</span>
      <span className="my-1 h-px w-full bg-white/50" />
      <span className="px-2 leading-tight">{bot}</span>
    </span>
  );
}

/* ─────────────────────────── particle mesh ─────────────────────────── */

function ParticleMesh() {
  // deterministic pseudo-random network nodes
  const nodes = Array.from({ length: 36 }).map((_, i) => {
    const x = ((i * 137.508) % 100);
    const y = (((i * 53.17) % 100));
    return { x, y };
  });
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <radialGradient id="mesh-fade" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="mesh-mask">
          <rect width="100" height="100" fill="url(#mesh-fade)" />
        </mask>
      </defs>
      <g mask="url(#mesh-mask)">
        {nodes.map((n, i) =>
          nodes
            .slice(i + 1)
            .filter((m) => Math.hypot(m.x - n.x, m.y - n.y) < 22)
            .map((m, j) => (
              <line
                key={`${i}-${j}`}
                x1={n.x}
                y1={n.y}
                x2={m.x}
                y2={m.y}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.08"
              />
            ))
        )}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r="0.25" fill="white">
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur={`${3 + (i % 5)}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>
    </svg>
  );
}
