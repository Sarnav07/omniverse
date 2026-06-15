import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import katex from "katex";
import "katex/dist/katex.min.css";

/* ════════════════════════════════════════════════════════════════════════
   OMNIVERSE — Protocol Docs
   An editorial, pinned-scroll story. The whole protocol explains itself on
   one morphing stage: a flat "100% exposed" line (a standard AMM) bends down
   into the Gaussian λ* W-curve — the dynamic shield that pulls LP capital out
   of harm's way exactly as a market approaches certainty.

   All numbers are from the live build: market AI2030-DYN on Arbitrum Sepolia,
   the Stylus math kernel (0x78e5…7c14), and the Gaussian λ* whitepaper.
   ════════════════════════════════════════════════════════════════════════ */

/* ── palette (mirrors styles.css tokens, inlined for SVG) ──────────────── */
const EM = "#10B981";
const EM_LT = "#34D399";
const CR = "#EF4444";
const CREAM = "#F3F4F6";
const MUT = "#8B8D98";
const AXIS = "rgba(255,255,255,0.16)";
const GRID = "rgba(255,255,255,0.06)";

/* ── Gaussian math (the real curve, computed on the client) ────────────── */
const SQRT2PI = Math.sqrt(2 * Math.PI);
const phi = (z: number) => Math.exp(-0.5 * z * z) / SQRT2PI;

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t) *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

// inverse CDF (Acklam) — maps probability back to a z-score
function phiInv(p: number): number {
  if (p <= 0) return -8;
  if (p >= 1) return 8;
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// optimal activeness λ*(P) — the W-curve, γ' = 2
function lambdaStar(P: number, gammaPrime = 2): number {
  const p = Math.min(0.998, Math.max(0.002, P));
  const z = phiInv(p);
  const v = phi(z) + z * (2 * Phi(z) - 1);
  const gammaG = gammaPrime / (2 * Math.max(v * phi(z), 1e-6));
  const s = Math.sqrt(1 + 2 * gammaG);
  return (1 + s) / (1 + gammaG + s);
}

/* ── stage geometry ────────────────────────────────────────────────────── */
const VB_W = 1000;
const VB_H = 560;
const PLOT = { left: 66, right: 66, top: 66, bottom: 86 };
const PW = VB_W - PLOT.left - PLOT.right;
const PH = VB_H - PLOT.top - PLOT.bottom;
const BASE_Y = VB_H - PLOT.bottom;
const TOP_Y = BASE_Y - PH; // λ = 1 line

const xToPx = (P: number) => PLOT.left + P * PW;
const yToPx = (lam: number) => BASE_Y - lam * PH;

// displayed activeness: morph 0 = flat 1.0 (standard AMM), 1 = λ*(P) W-curve
const disp = (P: number, m: number) => 1 - m * (1 - lambdaStar(P));

function curvePath(m: number): string {
  const n = 140;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const P = i / n;
    d += `${i === 0 ? "M" : "L"}${xToPx(P).toFixed(1)},${yToPx(disp(P, m)).toFixed(1)}`;
  }
  return d;
}
// active liquidity = area UNDER the curve (emerald)
function activeArea(m: number): string {
  const n = 140;
  let d = `M${PLOT.left},${BASE_Y}`;
  for (let i = 0; i <= n; i++) {
    const P = i / n;
    d += `L${xToPx(P).toFixed(1)},${yToPx(disp(P, m)).toFixed(1)}`;
  }
  return d + `L${(PLOT.left + PW).toFixed(1)},${BASE_Y}Z`;
}
// shielded liquidity = band between the curve and λ = 1 (muted)
function shieldArea(m: number): string {
  // band between the λ = 1 line (top) and the curve
  const n = 140;
  let d = `M${PLOT.left},${TOP_Y}L${(PLOT.left + PW).toFixed(1)},${TOP_Y}`;
  for (let i = n; i >= 0; i--) {
    const P = i / n;
    d += `L${xToPx(P).toFixed(1)},${yToPx(disp(P, m)).toFixed(1)}`;
  }
  return d + "Z";
}

const P_TICKS = [0, 0.25, 0.5, 0.75, 1];

/* ════════════════════════════════════════════════════════════════════════
   Caption — one crossfading card per chapter (dark editorial)
   ════════════════════════════════════════════════════════════════════════ */
function Caption({
  t,
  win,
  num,
  title,
  children,
  foot,
}: {
  t: MotionValue<number>;
  win: [number, number, number, number];
  num: string;
  title: string;
  children: React.ReactNode;
  foot?: string;
}) {
  const opacity = useTransform(t, win, [0, 1, 1, 0]);
  const y = useTransform(t, win, [28, 0, 0, -18]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute left-4 right-4 bottom-6 sm:left-10 sm:right-auto sm:bottom-10 sm:max-w-md rounded-xl border border-white/10 bg-[#0E0E11]/95 p-5 sm:p-6 shadow-2xl backdrop-blur pointer-events-none"
    >
      <p className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#10B981] mb-2">
        {num}
      </p>
      <h3 className="font-serif text-2xl sm:text-[28px] leading-tight mb-2 text-[#F3F4F6]">
        {title}
      </h3>
      <p className="text-sm sm:text-[15px] leading-relaxed text-[#8B8D98]">
        {children}
      </p>
      {foot && (
        <p className="font-mono text-[10px] leading-relaxed mt-3 pt-3 border-t border-white/10 text-[#8B8D98]/80">
          {foot}
        </p>
      )}
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   The pinned scroll story — six chapters on one morphing λ-stage
   ════════════════════════════════════════════════════════════════════════ */
function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // wheel steps → continuous glide; every transform inherits the smoothing.
  const t = useSpring(scrollYProgress, { stiffness: 110, damping: 28, restDelta: 0.0001 });

  /* morph: flat (standard AMM) → λ* W-curve */
  const morph = useTransform(t, [0.42, 0.6], [0, 1]);
  const curveD = useTransform(morph, (m) => curvePath(m));
  const activeD = useTransform(morph, (m) => activeArea(m));
  const shieldD = useTransform(morph, (m) => shieldArea(m));
  const shieldOpacity = useTransform(t, [0.45, 0.6], [0, 1]);

  /* the price marker walks: parks at 0.95 (problem), back to 0.5, then the attack to 0.89 */
  const priceP = useTransform(
    t,
    [0, 0.12, 0.42, 0.62, 0.7, 0.78],
    [0.95, 0.95, 0.5, 0.5, 0.72, 0.89],
  );
  const priceX = useTransform(priceP, xToPx);
  const priceY = useTransform([priceP, morph], (v: number[]) => yToPx(disp(v[0], v[1])));
  const priceMarkerO = useTransform(t, [0.06, 0.12], [0, 1]);

  /* tail danger zones (chapter 03) */
  const dangerO = useTransform(t, [0.3, 0.36, 0.56, 0.62], [0, 1, 1, 0.35]);

  /* lending overlay (chapter 06) */
  const lendO = useTransform(t, [0.82, 0.87], [0, 1]);
  const collapse = useTransform(t, [0.88, 0.96], [1, 0]);
  const collapseH = useTransform(collapse, (c) => 150 * c);
  const collapseY = useTransform(collapse, (c) => BASE_Y - 60 - 150 * c);

  /* HUD */
  const hudO = useTransform(t, [0.45, 0.52], [0, 1]);
  const passiveText = useTransform([priceP, morph], (v: number[]) =>
    `${Math.round((1 - disp(v[0], v[1])) * 100)}%`,
  );
  const lambdaText = useTransform([priceP, morph], (v: number[]) => disp(v[0], v[1]).toFixed(3));
  const priceText = useTransform(priceP, (p) => p.toFixed(2));

  const phaseText = useTransform(t, (v): string => {
    if (v < 0.12) return "01 — THE WIPEOUT";
    if (v < 0.3) return "02 — PRICE IS A PROBABILITY";
    if (v < 0.42) return "03 — RISK ISN'T UNIFORM";
    if (v < 0.62) return "04 — THE λ* SHIELD";
    if (v < 0.8) return "05 — THE ATTACK";
    return "06 — NO LIQUIDATIONS";
  });

  return (
    <div ref={ref} className="relative h-[640vh]">
      <div className="sticky top-0 h-screen overflow-hidden flex items-start justify-center lg:justify-end px-1 lg:pr-12">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full max-w-6xl h-[78%] mt-10 px-2"
        >
          {/* gridlines */}
          {[0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1={PLOT.left} x2={VB_W - PLOT.right} y1={yToPx(g)} y2={yToPx(g)} stroke={GRID} strokeWidth={1} />
          ))}
          <line x1={PLOT.left} x2={VB_W - PLOT.right} y1={BASE_Y} y2={BASE_Y} stroke={AXIS} strokeWidth={1} />
          {P_TICKS.map((v) => (
            <g key={v}>
              <line x1={xToPx(v)} x2={xToPx(v)} y1={BASE_Y} y2={BASE_Y + 5} stroke={AXIS} strokeWidth={1} />
              <text x={xToPx(v)} y={BASE_Y + 22} textAnchor="middle" fontSize={11} fontFamily="'Geist Mono', monospace" fill={MUT}>
                {v === 0.5 ? "P = 0.5" : v.toFixed(2)}
              </text>
            </g>
          ))}
          <text x={PLOT.left - 14} y={TOP_Y + 4} textAnchor="end" fontSize={11} fontFamily="'Geist Mono', monospace" fill={MUT}>λ 1.0</text>
          <text x={PLOT.left - 14} y={BASE_Y} textAnchor="end" fontSize={11} fontFamily="'Geist Mono', monospace" fill={MUT}>0</text>

          {/* tail danger zones */}
          <motion.g style={{ opacity: dangerO }}>
            <rect x={xToPx(0)} y={TOP_Y} width={xToPx(0.1) - xToPx(0)} height={PH} fill="rgba(239,68,68,0.10)" />
            <rect x={xToPx(0.9)} y={TOP_Y} width={xToPx(1) - xToPx(0.9)} height={PH} fill="rgba(239,68,68,0.10)" />
            <text x={xToPx(0.05)} y={TOP_Y - 8} textAnchor="middle" fontSize={9.5} fontFamily="'Geist Mono', monospace" fill={CR}>adverse selection ↑</text>
            <text x={xToPx(0.95)} y={TOP_Y - 8} textAnchor="middle" fontSize={9.5} fontFamily="'Geist Mono', monospace" fill={CR}>adverse selection ↑</text>
          </motion.g>

          {/* shielded band (passive reserves) */}
          <motion.path d={shieldD} style={{ opacity: shieldOpacity }} fill="rgba(139,141,152,0.12)" />
          {/* active liquidity area */}
          <motion.path d={activeD} fill="rgba(16,185,129,0.14)" />
          {/* the curve */}
          <motion.path
            d={curveD}
            fill="none"
            stroke="url(#omniGrad)"
            strokeWidth={2.6}
            style={{ filter: "drop-shadow(0 0 8px rgba(16,185,129,0.45))" }}
          />
          <defs>
            <linearGradient id="omniGrad" x1={PLOT.left} y1="0" x2={VB_W - PLOT.right} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={EM_LT} />
              <stop offset="0.5" stopColor={EM} />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
          </defs>

          {/* price marker + dot on the curve */}
          <motion.g style={{ opacity: priceMarkerO }}>
            <motion.line x1={priceX} x2={priceX} y1={TOP_Y - 18} y2={BASE_Y} stroke={CR} strokeWidth={1.5} strokeDasharray="4 3" />
            <motion.text x={priceX} dx={8} y={TOP_Y - 6} fontSize={11} fontFamily="'Geist Mono', monospace" fill={CR}>P</motion.text>
            <motion.circle cx={priceX} cy={priceY} r={6.5} fill={EM_LT} stroke="#08080A" strokeWidth={3} />
          </motion.g>

          {/* lending overlay (ch 06) — collateral & debt collapse together */}
          <motion.g style={{ opacity: lendO }}>
            <motion.rect x={xToPx(0.55) - 70} width={56} height={collapseH} y={collapseY} rx={3} fill="rgba(16,185,129,0.22)" stroke={EM} strokeWidth={1} />
            <motion.rect x={xToPx(0.55) + 14} width={56} height={collapseH} y={collapseY} rx={3} fill="rgba(239,68,68,0.20)" stroke={CR} strokeWidth={1} />
            <text x={xToPx(0.55) - 42} y={BASE_Y + 40} textAnchor="middle" fontSize={10} fontFamily="'Geist Mono', monospace" fill={EM}>YES-collateral</text>
            <text x={xToPx(0.55) + 42} y={BASE_Y + 40} textAnchor="middle" fontSize={10} fontFamily="'Geist Mono', monospace" fill={CR}>YES-debt</text>
            <text x={xToPx(0.55)} y={TOP_Y + 30} textAnchor="middle" fontSize={12} fontFamily="'Geist Mono', monospace" fill={CREAM}>both → 0 on resolution</text>
          </motion.g>
        </svg>

        {/* phase indicator — top left */}
        <div className="absolute top-6 left-4 sm:left-10 pointer-events-none rounded-lg border border-white/10 bg-[#0E0E11]/90 px-3.5 py-2.5 backdrop-blur">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#8B8D98]">How it works</p>
          <motion.p className="font-mono text-xs tracking-[0.2em] uppercase text-[#10B981] mt-1.5">{phaseText}</motion.p>
        </div>

        {/* live HUD — top right */}
        <motion.div
          style={{ opacity: hudO }}
          className="absolute top-6 right-4 sm:right-10 hidden sm:block rounded-lg border border-white/10 bg-[#0E0E11]/95 px-4 py-3 font-mono text-xs pointer-events-none backdrop-blur"
        >
          <div className="flex items-center justify-between gap-6">
            <span className="text-[#8B8D98]">P</span>
            <motion.span className="text-[#F3F4F6]">{priceText}</motion.span>
          </div>
          <div className="flex items-center justify-between gap-6 mt-1">
            <span className="text-[#8B8D98]">λ*(P)</span>
            <motion.span className="text-[#34D399]">{lambdaText}</motion.span>
          </div>
          <div className="flex items-center justify-between gap-6 mt-2 pt-2 border-t border-white/10">
            <span className="text-[#8B8D98]">shielded</span>
            <motion.span className="text-[#10B981]">{passiveText}</motion.span>
          </div>
        </motion.div>

        {/* scroll progress rail */}
        <div className="absolute right-1.5 sm:right-3 top-[14%] bottom-[14%] w-px bg-white/10">
          <motion.div style={{ scaleY: t, transformOrigin: "top" }} className="absolute inset-0 bg-[#10B981]" />
        </div>

        {/* captions */}
        <Caption t={t} win={[0.01, 0.04, 0.1, 0.13]} num="01 / 06" title="The wipeout"
          foot="A standard AMM keeps 100% of LP capital tradeable — even at P = 0.95.">
          A prediction market sits at 95% YES. In a normal AMM every dollar of LP money is
          still tradeable, so the instant the event resolves, informed traders drain the
          winning side in a single block. The liquidity provider is left holding the worthless
          token. Not impermanent loss — permanent.
        </Caption>
        <Caption t={t} win={[0.14, 0.18, 0.26, 0.3]} num="02 / 06" title="Price is a probability">
          OMNIVERSE prices with a Gaussian invariant. The marginal price <em className="text-[#F3F4F6] not-italic font-mono">P = Φ((y−x)/L)</em> is
          literally the market's probability of YES — the standard-normal CDF of the reserve
          imbalance, computed entirely on-chain.
        </Caption>
        <Caption t={t} win={[0.31, 0.35, 0.39, 0.42]} num="03 / 06" title="Risk isn't uniform">
          The danger to LPs is a curve, not a constant. As price nears 0 or 1, the pool's
          price-sensitivity collapses and the adverse-selection cost weight <em className="text-[#F3F4F6] not-italic font-mono">γ_G(P)</em> diverges.
          The edges are where LPs bleed.
        </Caption>
        <Caption t={t} win={[0.45, 0.49, 0.57, 0.61]} num="04 / 06" title="The λ* shield">
          So shield capital dynamically. Each block, OMNIVERSE splits reserves into an{" "}
          <span className="text-[#10B981]">active</span> fraction λ*(P) that trades and a{" "}
          <span className="text-[#8B8D98]">passive</span> fraction (1−λ*) that's hidden from
          informed flow. λ* is W-shaped — full near 50/50, collapsing toward the tails.
        </Caption>
        <Caption t={t} win={[0.63, 0.67, 0.77, 0.8]} num="05 / 06" title="The attack"
          foot="Live on Arbitrum Sepolia · market AI2030-DYN · three escalating buy orders.">
          Watch a real attack. Three buys walk the probability 0.50 → 0.89. As it climbs the
          curve, the active fraction λ*(P) shrinks and the shielded share of LP capital climbs
          past half — automatically, with no oracle and no governance vote.
        </Caption>
        <Caption t={t} win={[0.82, 0.86, 0.96, 0.995]} num="06 / 06" title="No liquidations">
          The same Gaussian secures borrowing. If your collateral and your loan are tied to the
          same outcome, they fall to zero together when the event resolves against you. There is
          no price at which you get liquidated — the position simply nets out.
        </Caption>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Hero — self-drawing curve
   ════════════════════════════════════════════════════════════════════════ */
const HERO_W = (() => {
  let d = "";
  for (let i = 0; i <= 120; i++) {
    const P = i / 120;
    const lam = lambdaStar(P);
    const x = 20 + 680 * P;
    const y = 200 - 150 * lam;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
})();

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      <div className="absolute inset-0 noise-overlay opacity-[0.4] pointer-events-none" />
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="font-mono text-[10px] sm:text-xs tracking-[0.42em] uppercase text-[#10B981] mb-7"
      >
        Protocol Documentation · Arbitrum Stylus
      </motion.p>
      <h1
        className="font-serif tracking-tight leading-[0.95] text-center text-[#F3F4F6]"
        style={{ fontSize: "clamp(2.9rem, 8vw, 6rem)" }}
      >
        <MaskLines
          delay={0.12}
          lines={["Liquidity is a", <span key="l2" className="text-[#10B981]">risk surface.</span>]}
        />
      </h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="font-serif italic text-base sm:text-lg max-w-xl text-center leading-relaxed mt-6 text-[#8B8D98]"
      >
        A Gaussian prices every outcome, and a closed-form curve pulls LP capital out of harm's
        way as the market approaches certainty. Scroll — the protocol explains itself.
      </motion.p>

      <svg viewBox="0 0 720 220" className="w-full max-w-2xl mt-12" fill="none">
        <motion.path
          d={HERO_W}
          stroke="#10B981"
          strokeWidth={2.5}
          style={{ filter: "drop-shadow(0 0 8px rgba(16,185,129,0.5))" }}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 1.9, ease: "easeInOut" }}
        />
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 0.6 }}>
          <line x1={20} x2={700} y1={200} y2={200} stroke={AXIS} strokeWidth={1} />
          <text x={20 + 680 * 0.16} y={28} fontSize={12} fontFamily="'Geist Mono', monospace" fill="#34D399" textAnchor="middle">peak</text>
          <text x={360} y={216} fontSize={11} fontFamily="'Geist Mono', monospace" fill={MUT} textAnchor="middle">P = 0.5</text>
        </motion.g>
      </svg>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 0.8 }}
        className="absolute bottom-8 flex flex-col items-center gap-2"
      >
        <span className="font-mono text-[10px] tracking-[0.35em] uppercase text-[#8B8D98]">Scroll</span>
        <motion.span animate={{ y: [0, 7, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }} className="block w-px h-8 bg-[#10B981]" />
      </motion.div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Reveal + editorial line-mask helpers
   ════════════════════════════════════════════════════════════════════════ */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const maskLineVariant = {
  hidden: { y: "112%" },
  show: { y: "0%", transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] as const } },
};

function MaskLines({ lines, className = "", lineClassName = "", delay = 0 }: { lines: React.ReactNode[]; className?: string; lineClassName?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-70px" }}
      custom={delay}
      variants={{ hidden: {}, show: (d: number) => ({ transition: { staggerChildren: 0.09, delayChildren: d } }) }}
    >
      {lines.map((l, i) => (
        <span key={i} className="block overflow-hidden">
          <motion.span variants={maskLineVariant} className={`block ${lineClassName}`}>
            {l}
          </motion.span>
        </span>
      ))}
    </motion.div>
  );
}

function SectionHead({ num, title, sub }: { num: string; title: string; sub?: string }) {
  return (
    <div className="mb-10">
      <Reveal>
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#10B981] mb-3">{num}</p>
      </Reveal>
      <MaskLines lines={[title]} delay={0.05} className="font-serif text-4xl sm:text-5xl tracking-tight text-[#F3F4F6]" />
      {sub && (
        <Reveal delay={0.18}>
          <p className="font-serif italic text-base mt-3 max-w-xl text-[#8B8D98]">{sub}</p>
        </Reveal>
      )}
    </div>
  );
}

/* ── stats wall — multi-speed parallax ─────────────────────────────────── */
const STAT_COLUMNS: { v: string; label: string }[][] = [
  [
    { v: "Φ", label: "one Gaussian prices every outcome — P = Φ((y−x)/L)" },
    { v: "W", label: "λ*(P) is W-shaped: peaks at 0.16 / 0.84, collapses at the tails" },
  ],
  [
    { v: "73%", label: "less LP exposure at the tail (P = 0.999) vs a constant policy" },
    { v: "AR(1)", label: "gap dynamics exact at all orders — variance ratio 1.001 ± 0.028" },
  ],
  [
    { v: "<$0.001", label: "cost per block for the whole λ*(P) pipeline, in Rust/WASM on Arbitrum" },
    { v: "0", label: "oracles, and 0 liquidations in outcome-matched lending" },
  ],
];

function StatCell({ v, label }: { v: string; label: string }) {
  return (
    <div className="border-t border-white/10 pt-5 pb-14">
      <p className="font-serif text-[#10B981] leading-none" style={{ fontSize: "clamp(3.4rem, 7.5vw, 6.5rem)" }}>{v}</p>
      <p className="font-mono text-[11px] leading-relaxed mt-5 max-w-[28ch] text-[#8B8D98]">{label}</p>
    </div>
  );
}

function StatsWall() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y0 = useTransform(scrollYProgress, [0, 1], [30, -40]);
  const y1 = useTransform(scrollYProgress, [0, 1], [80, -90]);
  const y2 = useTransform(scrollYProgress, [0, 1], [130, -60]);
  return (
    <section ref={ref} className="max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-16 overflow-visible">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 items-start">
        <motion.div style={{ y: y0 }}>
          <Reveal>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#10B981] mb-3">The protocol, in numbers</p>
            <p className="font-serif text-[15px] leading-relaxed text-[#8B8D98] max-w-[30ch] mb-14">
              One curve carries the market; one closed-form λ* carries the defense. Everything
              else reduces to a handful of constants.
            </p>
          </Reveal>
          {STAT_COLUMNS[0].map((s) => <StatCell key={s.v} {...s} />)}
        </motion.div>
        <motion.div style={{ y: y1 }} className="md:pt-24">{STAT_COLUMNS[1].map((s) => <StatCell key={s.v} {...s} />)}</motion.div>
        <motion.div style={{ y: y2 }} className="md:pt-48">{STAT_COLUMNS[2].map((s) => <StatCell key={s.v} {...s} />)}</motion.div>
      </div>
    </section>
  );
}

/* ── interactive playground — drag P, read λ* and the shield ───────────── */
function Playground() {
  const [p, setP] = useState(0.5);
  const lam = lambdaStar(p);
  const shielded = (1 - lam) * 100;
  // draw curve + marker in a compact svg
  const W = 560, H = 230, pad = 34;
  const X = (P: number) => pad + P * (W - 2 * pad);
  const Y = (l: number) => H - 26 - l * (H - 60);
  let d = "";
  for (let i = 0; i <= 120; i++) {
    const P = i / 120;
    d += `${i === 0 ? "M" : "L"}${X(P).toFixed(1)},${Y(lambdaStar(P)).toFixed(1)}`;
  }
  return (
    <Reveal>
      <div className="rounded-xl border border-white/10 bg-[#0E0E11] p-5 sm:p-7 space-y-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" fill="none">
          <line x1={pad} x2={W - pad} y1={H - 26} y2={H - 26} stroke={AXIS} />
          <path d={`M${pad},${H - 26}L${d.slice(1)}L${W - pad},${H - 26}Z`} fill="rgba(16,185,129,0.12)" />
          <path d={d} stroke="#10B981" strokeWidth={2.4} style={{ filter: "drop-shadow(0 0 6px rgba(16,185,129,0.4))" }} />
          <line x1={X(p)} x2={X(p)} y1={10} y2={H - 26} stroke={CR} strokeWidth={1.4} strokeDasharray="4 3" />
          <circle cx={X(p)} cy={Y(lam)} r={6} fill="#34D399" stroke="#08080A" strokeWidth={3} />
        </svg>
        <div>
          <div className="flex items-center justify-between font-mono text-xs mb-2">
            <span className="text-[#8B8D98]">market probability P</span>
            <span className="text-[#F3F4F6]">{p.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0.01} max={0.99} step={0.01} value={p}
            onChange={(e) => setP(parseFloat(e.target.value))}
            className="w-full accent-[#10B981] cursor-pointer"
            aria-label="Market probability"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/[0.07] p-4">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1 text-[#10B981]/70">active λ*(P)</p>
            <p className="font-mono text-2xl text-[#34D399]">{(lam * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1 text-[#8B8D98]">shielded (passive)</p>
            <p className="font-mono text-2xl text-[#F3F4F6]">{shielded.toFixed(1)}%</p>
          </div>
        </div>
        <p className="font-mono text-xs text-center pt-1 text-[#8B8D98]">
          Push P toward the tails and watch the shield grow — the same λ* the Stylus kernel
          computes on-chain for less than $0.001.
        </p>
      </div>
    </Reveal>
  );
}

/* ── the math (four plates) ─────────────────────────────────────────────── */
const MATH_PLATES = [
  { label: "The invariant", latex: "(y-x)\\cdot\\Phi\\!\\left(\\frac{y-x}{L}\\right) + L\\cdot\\varphi\\!\\left(\\frac{y-x}{L}\\right) - y = 0", sub: "P = \\Phi\\!\\left(\\frac{y-x}{L}\\right)", note: "A Gaussian constant-function market maker. The marginal price is the event probability — no off-chain math, no oracle." },
  { label: "Optimal activeness", latex: "\\lambda^*(P) = \\frac{1+\\sqrt{1+2\\gamma_G}}{1+\\gamma_G+\\sqrt{1+2\\gamma_G}}", sub: "z = \\Phi^{-1}(P)", note: "Closed-form λ*. W-shaped in P: maximal near 0.5, collapsing toward 0 as the market approaches certainty." },
  { label: "Why it diverges", latex: "\\gamma_G(P) = \\frac{\\gamma'}{2\\cdot v(z)\\cdot\\varphi(z)}", sub: "v(z) = \\varphi(z) + z\\bigl(2\\Phi(z)-1\\bigr)", note: "The cost weight is endogenously probability-dependent: as P→0 or 1, φ(z)→0 and γ_G→∞, so λ*→0." },
  { label: "Three-layer defence", latex: "\\ell_{\\text{active}}(\\tau, P) = \\lambda^*(P)\\cdot L_0\\cdot\\sqrt{T-\\tau}", sub: "", note: "Time-decay × constant PA-AMM λ × Gaussian λ*(P). Each layer bounds a different timescale of LP loss." },
];

/* ── resolution lifecycle fan ───────────────────────────────────────────── */
const LIFECYCLE = [
  { fn: "solveSwap", title: "Price the trade", desc: "The Stylus kernel solves the Gaussian invariant for the output, against the active reserves only." },
  { fn: "lambdaStar", title: "Re-shield", desc: "Each block λ*(P) re-partitions reserves into active and passive — automatically, no governance call." },
  { fn: "resolve", title: "Settle on reality", desc: "The resolver records the observed outcome behind a dispute window. Trading halts." },
  { fn: "redeem", title: "Pay out", desc: "Winning tokens redeem 1:1 against collateral; losing-side capital returns to LPs." },
];
const FAN_ANGLES = [-9, -3, 3, 9];

function FanCard({ step, i, spread }: { step: (typeof LIFECYCLE)[number]; i: number; spread: MotionValue<number> }) {
  const angle = FAN_ANGLES[i] ?? 0;
  const arcDrop = Math.abs(angle) * 2.4;
  const rotate = useTransform(spread, [0, 1], [0, angle]);
  const y = useTransform(spread, [0, 1], [70, arcDrop]);
  const opacity = useTransform(spread, [0, 0.25 + i * 0.12, 0.55 + i * 0.12], [0, 0, 1]);
  return (
    <motion.div style={{ rotate, y, opacity, transformOrigin: "bottom center" }}>
      <div className="rounded-xl border border-white/10 bg-[#0E0E11] p-5 h-full shadow-2xl">
        <span className="font-mono text-[10px] text-[#8B8D98]">STEP 0{i + 1}</span>
        <p className="font-mono text-[13px] text-[#10B981] mt-2 break-all">{step.fn}()</p>
        <p className="font-serif text-lg mt-2 text-[#F3F4F6]">{step.title}</p>
        <p className="text-[13px] leading-relaxed mt-2 text-[#8B8D98]">{step.desc}</p>
      </div>
    </motion.div>
  );
}

function LifecycleFan() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "start 0.35"] });
  const spread = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  return (
    <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {LIFECYCLE.map((s, i) => <FanCard key={s.fn} step={s} i={i} spread={spread} />)}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Route
   ════════════════════════════════════════════════════════════════════════ */
export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — OMNIVERSE" },
      { name: "description", content: "How OMNIVERSE prices prediction markets with a Gaussian invariant and shields LPs with the closed-form λ* W-curve, on Arbitrum Stylus." },
    ],
  }),
  component: Docs,
});

function Docs() {
  return (
    <div className="bg-[#08080A] text-[#F3F4F6] overflow-x-clip">
      <Hero />
      <ScrollStory />
      <StatsWall />

      {/* TRY IT */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead num="07 / Try it" title="Run your own probability" sub="The same λ*(P) the Stylus kernel computes on-chain, live under your cursor. Drag P toward a tail and watch the shield grow." />
        <Playground />
      </section>

      {/* THE MATH */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead num="08 / The math" title="Four formulas, no oracle" sub="Everything the protocol believes, charges, and defends reduces to these." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MATH_PLATES.map((p, i) => (
            <Reveal key={p.label} delay={i * 0.08}>
              <div className="rounded-xl border border-white/10 bg-[#0E0E11] p-5 h-full">
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#10B981] mb-3">{p.label}</p>
                <div className="overflow-x-auto py-2">
                  <div dangerouslySetInnerHTML={{ __html: katex.renderToString(p.latex, { displayMode: true, throwOnError: false }) }} />
                  {p.sub && <div className="mt-1" dangerouslySetInnerHTML={{ __html: katex.renderToString(p.sub, { displayMode: true, throwOnError: false }) }} />}
                </div>
                <p className="text-sm leading-relaxed mt-3 text-[#8B8D98]">{p.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* TWO ROLES */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead num="09 / Two sides" title="Attackers steer. LPs survive." sub="The whole point: directional pressure moves the price, but the shield decides how much LP capital it can ever touch." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Reveal>
            <div className="rounded-xl border border-[#EF4444]/30 bg-[#0E0E11] p-6 h-full">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#EF4444] mb-4">The attacker</p>
              <ol className="space-y-3.5">
                {["Buy one side to push the probability toward an extreme.", "Each marginal dollar moves P less — the Gaussian curve flattens at the edges.", "Near certainty, the active pool is tiny, so price impact costs the most exactly where it matters.", "Manipulation is bounded by construction: moving the market always costs capital at risk."].map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="font-mono text-xs text-[#EF4444] mt-0.5 shrink-0">0{i + 1}</span>
                    <span className="text-sm leading-relaxed text-[#8B8D98]">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-xl border border-[#10B981]/30 bg-[#0E0E11] p-6 h-full">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#10B981] mb-4">The liquidity provider</p>
              <ol className="space-y-3.5">
                {["Deposit collateral into the single pool; only λ*(P) of it is ever exposed.", "As the market leans, passive reserves rise — up to 63% shielded in the live demo.", "Lifetime LVR is bounded by the time-decay layer, independent of volatility.", "No manual freeze, no oracle: the Gaussian curvature does the shielding every block."].map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="font-mono text-xs text-[#10B981] mt-0.5 shrink-0">0{i + 1}</span>
                    <span className="text-sm leading-relaxed text-[#8B8D98]">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </section>

      {/* LIFECYCLE */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead num="10 / Lifecycle" title="One block, end to end" sub="Price, re-shield, settle, redeem — the loop every market runs." />
        <LifecycleFan />
      </section>

      {/* ARCHITECTURE */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead num="11 / Architecture" title="Rust on Stylus, priced on-chain" sub="The Gaussian engine would be prohibitively expensive in Solidity. Stylus runs it as WASM for less than $0.001 a block." />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-stretch">
          <Reveal className="md:col-span-2">
            <div className="h-full flex flex-col justify-center space-y-4">
              <p className="text-[15px] leading-relaxed text-[#8B8D98]">
                The math kernel <strong className="text-[#F3F4F6]">OmniverseMath</strong> is written in{" "}
                <strong className="text-[#F3F4F6]">Rust</strong>, compiled to{" "}
                <strong className="text-[#F3F4F6]">WASM</strong> via Arbitrum Stylus. It exposes φ, Φ, Φ⁻¹,
                λ* and a Newton-Raphson swap solver in 18-decimal fixed point.
              </p>
              <p className="text-[15px] leading-relaxed text-[#8B8D98]">
                The Solidity layer — factory, PA-AMM pool, ERC-1155 conditional tokens, and
                outcome-matched lending — calls into the kernel; a Ponder indexer streams every
                trade to this frontend.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.12} className="md:col-span-3">
            <div className="rounded-xl border border-white/10 bg-[#0E0E11] p-5 font-mono text-xs leading-loose text-[#8B8D98] overflow-x-auto">
              <p className="text-[#10B981]">MarketFactory.createEvent()</p>
              <p className="pl-3">├─ PmAmmPool ──CALL──▶ OmniverseMath (WASM)</p>
              <p className="pl-3">├─ ConditionalTokens (ERC-1155 YES / NO)</p>
              <p className="pl-3">├─ MultiverseLending (outcome-matched)</p>
              <p className="pl-3">├─ Resolver (dispute window)</p>
              <p className="pl-3">└─ Ponder indexer ──GraphQL──▶ frontend</p>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.2}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-8 font-mono text-[10px] tracking-[0.15em] uppercase text-[#8B8D98]">
            {["Arbitrum Stylus", "Rust → WASM", "WAD fixed-point", "exactly AR(1)", "<$0.001 / block", "no oracle"].map((s, i) => (
              <span key={s} className="flex items-center gap-5">
                {i > 0 && <span className="text-[#10B981]">·</span>}
                {s}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ROAD AHEAD */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead num="12 / The road ahead" title="An AI oracle for resolution" sub="Today the resolver is owner-controlled. Next: a panel of diverse models that debate, vote with calibrated weights, and abstain below a confidence threshold — handing the contract a single final price, never touching the math." />
        <Reveal>
          <div className="rounded-xl border border-white/10 bg-[#0E0E11] p-6 font-mono text-xs leading-loose text-[#8B8D98]">
            <p className="text-[#10B981]">question → evidence → debate → weighted consensus</p>
            <p className="pl-3">└─ if confidence ≥ τ: <span className="text-[#34D399]">Resolver.setFinalPrice()</span></p>
            <p className="pl-3 text-[#8B8D98]/70">   else: abstain → 24h dispute window keeps control</p>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <Reveal>
          <div className="rounded-2xl border border-white/10 bg-[#0E0E11] px-6 py-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 noise-overlay opacity-30 pointer-events-none" />
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#10B981] mb-4 relative">End of transmission</p>
            <h2 className="font-serif text-4xl sm:text-5xl tracking-tight text-[#F3F4F6] relative">Attack the pool.</h2>
            <p className="font-serif italic text-base mt-4 max-w-md mx-auto text-[#8B8D98] relative">
              Market AI2030-DYN is live on Arbitrum Sepolia — push the probability and watch the
              shield defend the LPs in real time.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8 relative">
              <Link to="/markets" className="inline-flex items-center justify-center px-8 py-3.5 bg-[#10B981] text-[#08080A] font-semibold text-sm tracking-wide rounded-lg hover:bg-[#34D399] active:scale-[0.98] transition-all" style={{ boxShadow: "0 0 28px rgba(16,185,129,0.35)" }}>
                Enter Markets →
              </Link>
              <button onClick={() => typeof window !== "undefined" && window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex items-center justify-center px-8 py-3.5 border border-white/15 font-medium text-sm tracking-wide rounded-lg text-[#8B8D98] hover:text-[#F3F4F6] hover:border-[#10B981] transition-all">
                Replay the story ↑
              </button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
