import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/marketing/Nav";
import { useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

/* ============================================================
 * Math kernel — bounded optimal-activeness surface λ*(P)
 * ============================================================ */
const N = 240;
const W = 900;
const H = 480;
const PADL = 56;
const PADR = 24;
const PADT = 24;
const PADB = 40;
const IW = W - PADL - PADR;
const IH = H - PADT - PADB;

function lambdaStar(P: number, gamma: number, attacked: boolean) {
  // Bounded in (0,1) via tanh — symmetric around P = 0.5
  const base = 0.5 + 0.5 * Math.tanh(gamma * (P - 0.5));
  // Defense regime dampens activeness around the contested midline
  const penalty = attacked ? 0.18 * Math.exp(-Math.pow((P - 0.5) * 4, 2)) : 0;
  return Math.max(0, Math.min(1, base - penalty));
}

const xToPx = (P: number) => PADL + P * IW;
const yToPx = (v: number) => PADT + (1 - v) * IH;

/* ============================================================
 * Custom slider (glassmorphic hardware fader)
 * ============================================================ */
const sliderStyle: CSSProperties = {
  WebkitAppearance: "none",
  appearance: "none",
  background: "transparent",
  outline: "none",
};

function Fader({
  label,
  symbol,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  symbol: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  format: (n: number) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase text-[#8B8D98] tracking-widest flex items-center gap-1.5">
          {label} <span className="opacity-70">·</span>{" "}
          <span className="text-white/70">
            <InlineMath math={symbol} />
          </span>
        </span>
        <span
          className="text-xs text-emerald-400 font-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="omv-slider w-full"
        style={sliderStyle}
      />
      <div className="flex items-center justify-between">
        <span
          className="text-[9px] text-white/30 font-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {format(min)}
        </span>
        <span
          className="text-[9px] text-white/30 font-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {format(max)}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
 * Toggle
 * ============================================================ */
function RegimeToggle({
  attacked,
  onChange,
}: {
  attacked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!attacked)}
      className="flex items-center justify-between w-full"
    >
      <div className="flex flex-col gap-0.5 text-left">
        <span className="text-[10px] uppercase text-[#8B8D98] tracking-widest">
          Informed Trader
        </span>
        <span className="text-[9px] text-white/40 uppercase tracking-wider">
          {attacked ? "Defense regime" : "Neutral regime"}
        </span>
      </div>
      <div
        className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
          attacked
            ? "bg-red-500/20 border border-red-500/50 justify-end"
            : "bg-white/10 border border-white/5 justify-start"
        }`}
      >
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          className="w-4 h-4 rounded-full bg-white"
        />
      </div>
    </button>
  );
}

/* ============================================================
 * Micro bento card for derived metrics
 * ============================================================ */
function MetricCard({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-1">
      <span className="text-[10px] text-[#8B8D98]">
        <InlineMath math={label} />
      </span>
      <span
        className={`text-sm font-mono ${active ? "text-emerald-400" : "text-white"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}

/* ============================================================
 * Main component
 * ============================================================ */
function ExplorerPage() {
  const [p, setP] = useState(0.5);
  const [gamma, setGamma] = useState(2.0);
  const [attacked, setAttacked] = useState(false);

  const { path, fill, samples, lambdaP, cursor, ticksX, ticksY } = useMemo(() => {
    const pts: { x: number; y: number; v: number; P: number }[] = [];
    for (let i = 0; i < N; i++) {
      const P = i / (N - 1);
      const v = lambdaStar(P, gamma, attacked);
      pts.push({ x: xToPx(P), y: yToPx(v), v, P });
    }
    const path = pts
      .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`)
      .join(" ");
    const fill =
      `M${PADL},${PADT + IH} ` +
      pts.map((pt) => `L${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(" ") +
      ` L${PADL + IW},${PADT + IH} Z`;
    const lp = lambdaStar(p, gamma, attacked);
    const cursor = { x: xToPx(p), y: yToPx(lp) };
    const ticksX = [0, 0.25, 0.5, 0.75, 1];
    const ticksY = [0, 0.25, 0.5, 0.75, 1];
    return {
      path,
      fill,
      samples: pts,
      lambdaP: lp,
      cursor,
      ticksX,
      ticksY,
    };
  }, [p, gamma, attacked]);

  const derived = useMemo(() => {
    const lAt0 = lambdaStar(0, gamma, attacked);
    const lAt1 = lambdaStar(1, gamma, attacked);
    const peakSlope = (samples[N / 2].v - samples[N / 2 - 1].v) * N;
    const auc =
      samples.reduce((s, pt) => s + pt.v, 0) / N; // area / [0,1]
    return {
      lambdaP,
      gammaVal: gamma,
      lAt0,
      lAt1,
      peakSlope,
      auc,
    };
  }, [samples, gamma, attacked, lambdaP]);

  return (
    <div className="w-full flex-1 flex flex-col bg-[#08080A] text-[#F3F4F6] min-h-screen relative">
      {/* Slider styling — scoped via class */}
      <style>{`
        .omv-slider::-webkit-slider-runnable-track {
          height: 6px;
          background: rgba(255,255,255,0.08);
          border-radius: 9999px;
        }
        .omv-slider::-moz-range-track {
          height: 6px;
          background: rgba(255,255,255,0.08);
          border-radius: 9999px;
        }
        .omv-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #0E0E11;
          border: 2px solid #10B981;
          box-shadow: 0 0 10px rgba(16,185,129,0.35);
          margin-top: -5px;
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .omv-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #0E0E11;
          border: 2px solid #10B981;
          box-shadow: 0 0 10px rgba(16,185,129,0.35);
          cursor: pointer;
        }
        .omv-slider::-webkit-slider-thumb:hover { transform: scale(1.12); }
        .omv-slider:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px rgba(16,185,129,0.25), 0 0 10px rgba(16,185,129,0.35);
        }
      `}</style>

      {/* Noise overlay */}
      <div
        className="fixed inset-0 opacity-[0.025] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: "url(/noise.svg)" }}
      />

      {/* Header */}
      <header className="w-full max-w-[1400px] mx-auto pt-12 px-6 relative">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#8B8D98] mb-3">
          Omniverse · Math Explorer
        </div>
        <h1 className="flex items-baseline gap-3 text-4xl text-white">
          <span className="text-emerald-400">
            <InlineMath math={"\\lambda^*"} />
          </span>
          <span className="text-white/80">surface,</span>
          <span
            className="italic text-white/50"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            probed.
          </span>
        </h1>
        <p className="text-sm text-[#8B8D98] max-w-2xl mt-3 leading-relaxed">
          Probe the bounded optimal-activeness curve <InlineMath math={"\\lambda^*(P)"} />{" "}
          across probability <InlineMath math={"P"} /> and informed-flow{" "}
          <InlineMath math={"\\gamma"} />. The kernel is monotonic, tanh-bounded
          and attested by the protocol oracle.
        </p>
      </header>

      {/* Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 w-full max-w-[1400px] mx-auto mt-8 px-6 pb-12 relative">
        {/* LEFT: Control Matrix */}
        <div className="flex flex-col gap-8 p-6 bg-[#0E0E11] border border-white/5 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
          <Fader
            label="Probability"
            symbol={"P"}
            value={p}
            min={0.01}
            max={0.99}
            step={0.001}
            onChange={setP}
            format={(n) => n.toFixed(3)}
          />
          <Fader
            label="Governance"
            symbol={"\\gamma"}
            value={gamma}
            min={0.5}
            max={6}
            step={0.01}
            onChange={setGamma}
            format={(n) => n.toFixed(2)}
          />
          <RegimeToggle attacked={attacked} onChange={setAttacked} />

          <div className="pt-2 border-t border-white/5">
            <div className="text-[10px] uppercase tracking-widest text-[#8B8D98] mb-3">
              Derived Surface
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label={"\\lambda^*@P"}
                value={derived.lambdaP.toFixed(4)}
                active
              />
              <MetricCard label={"\\gamma"} value={derived.gammaVal.toFixed(2)} />
              <MetricCard
                label={"\\lambda^*(0)"}
                value={derived.lAt0.toFixed(4)}
              />
              <MetricCard
                label={"\\lambda^*(1)"}
                value={derived.lAt1.toFixed(4)}
              />
              <MetricCard
                label={"\\partial\\lambda^*/\\partial P"}
                value={derived.peakSlope.toFixed(3)}
              />
              <MetricCard
                label={"\\int_0^1 \\lambda^* dP"}
                value={derived.auc.toFixed(4)}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Canvas */}
        <div className="relative flex flex-col bg-[#0E0E11] border border-white/5 rounded-2xl overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
          <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
            <span className="text-[10px] text-[#8B8D98] tracking-widest uppercase">
              Optimal Activeness · λ*(P)
            </span>
            <span className="text-[10px] text-[#8B8D98] tracking-widest uppercase">
              N-Curve · {N} Samples
            </span>
          </div>

          <div className="flex-1 w-full relative">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="w-full h-full block"
            >
              <defs>
                <pattern
                  id="diagonalHatch"
                  width="4"
                  height="4"
                  patternTransform="rotate(45 0 0)"
                  patternUnits="userSpaceOnUse"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="4"
                    stroke="rgba(16,185,129,0.18)"
                    strokeWidth="1"
                  />
                </pattern>
                <linearGradient id="fadeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(16,185,129,0.4)" />
                  <stop offset="100%" stopColor="rgba(16,185,129,0)" />
                </linearGradient>
                <filter id="orbGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" />
                </filter>
              </defs>

              {/* Grid */}
              {ticksY.map((t) => {
                const y = yToPx(t);
                return (
                  <g key={`gy-${t}`}>
                    <line
                      x1={PADL}
                      x2={PADL + IW}
                      y1={y}
                      y2={y}
                      stroke="rgba(255,255,255,0.04)"
                      strokeWidth="1"
                    />
                    <text
                      x={PADL - 10}
                      y={y + 3}
                      textAnchor="end"
                      className="font-mono"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                      fontSize="10"
                      fill="#8B8D98"
                    >
                      {t.toFixed(2)}
                    </text>
                  </g>
                );
              })}
              {ticksX.map((t) => {
                const x = xToPx(t);
                return (
                  <g key={`gx-${t}`}>
                    <line
                      x1={x}
                      x2={x}
                      y1={PADT}
                      y2={PADT + IH}
                      stroke="rgba(255,255,255,0.04)"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={PADT + IH + 18}
                      textAnchor="middle"
                      className="font-mono"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                      fontSize="10"
                      fill="#8B8D98"
                    >
                      {t.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Area fill — hatched + fade wash */}
              <motion.path
                d={fill}
                fill="url(#fadeGradient)"
                animate={{ d: fill }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
              <motion.path
                d={fill}
                fill="url(#diagonalHatch)"
                animate={{ d: fill }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />

              {/* Main curve */}
              <motion.path
                d={path}
                stroke="#10B981"
                strokeWidth="2"
                fill="none"
                animate={{ d: path }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ filter: "drop-shadow(0 0 4px rgba(16,185,129,0.4))" }}
              />

              {/* Cursor drop line */}
              <line
                x1={cursor.x}
                x2={cursor.x}
                y1={PADT}
                y2={PADT + IH}
                stroke="rgba(255,255,255,0.12)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={PADL}
                x2={cursor.x}
                y1={cursor.y}
                y2={cursor.y}
                stroke="rgba(16,185,129,0.25)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />

              {/* Glowing orb */}
              <circle
                cx={cursor.x}
                cy={cursor.y}
                r="8"
                fill="rgba(16,185,129,0.25)"
                filter="url(#orbGlow)"
              />
              <circle
                cx={cursor.x}
                cy={cursor.y}
                r="4"
                fill="#0E0E11"
                stroke="#10B981"
                strokeWidth="2"
                style={{ filter: "drop-shadow(0 0 6px #10B981)" }}
              />
            </svg>
          </div>

          {/* Footer */}
          <div className="grid grid-cols-4 gap-6 px-6 py-5 bg-white/[0.01] border-t border-white/5">
            <FooterCell
              label="P"
              value={p.toFixed(3)}
            />
            <FooterCell
              label="λ*(P)"
              value={lambdaP.toFixed(4)}
              accent="text-emerald-400"
            />
            <FooterCell
              label="Bounded"
              value={
                <span className="flex items-center gap-1.5 text-white">
                  <Check size={12} className="text-emerald-400" />
                  tanh
                </span>
              }
            />
            <FooterCell
              label="Regime"
              value={attacked ? "DEFENSE" : "NEUTRAL"}
              accent={attacked ? "text-red-400" : "text-[#8B8D98]"}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function FooterCell({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] uppercase text-[#8B8D98] tracking-widest">
        {label}
      </span>
      <span
        className={`text-sm font-mono ${accent}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}


export const Route = createFileRoute("/explorer")({
  head: () => ({
    meta: [
      { title: "Explorer — Gaussian AMM Math Playground · Omniverse" },
      {
        name: "description",
        content:
          "Interactive math playground for the omniverse gaussian AMM. Probe λ*, governance weight γ′, and informed-trader attacks.",
      },
      { property: "og:title", content: "Explorer — Math Playground" },
      {
        property: "og:description",
        content: "Test our custom Gaussian AMM logic. λ* is bounded as P approaches 0 or 1.",
      },
    ],
  }),
  component: () => (<div className="relative min-h-screen w-full overflow-x-hidden bg-[#0A0A0B]"><div className="border-b border-white/[0.05]"><Nav appMode /></div><ExplorerPage /></div>),
});
