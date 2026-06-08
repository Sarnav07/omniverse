import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { NavBar } from "@/components/nav-bar";

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
  component: ExplorerPage,
});

/* ─────────────────────────────── math ─────────────────────────────── */

// Synthetic λ*(p) producing the desired "W" curve:
// high at edges, dipping in middle, with two soft humps shaped by γ.
function lambdaStar(p: number, gamma: number, attacked: boolean): number {
  // base U: high at 0 & 1, low at 0.5
  const u = Math.pow(2 * p - 1, 2); // 1 at edges, 0 at p=0.5
  // two humps centered ~0.28 and ~0.72 — produces "W" with a central dip
  const w1 = Math.exp(-Math.pow(p - 0.28, 2) / (2 * 0.04));
  const w2 = Math.exp(-Math.pow(p - 0.72, 2) / (2 * 0.04));
  const humps = 0.35 * (w1 + w2);
  // edge boundedness: never exceed cap as p→0,1 — clamp via tanh
  const raw = 0.18 + 0.55 * u + humps / gamma;
  const attack = attacked ? 0.18 * Math.exp(-Math.pow(p - 0.5, 2) / 0.02) : 0;
  return Math.tanh(raw + attack) * (0.55 + 0.18 * Math.log(gamma + 0.1));
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

function ExplorerPage() {
  const [p, setP] = useState(0.5);
  const [gamma, setGamma] = useState(2.0);
  const [attacked, setAttacked] = useState(false);

  const W = 760;
  const H = 360;
  const padL = 64;
  const padR = 28;
  const padT = 36;
  const padB = 56;

  const { path, fill, samples, max } = useMemo(() => {
    const N = 240;
    const pts: { x: number; y: number; p: number; l: number }[] = [];
    let m = 0;
    const raw: { p: number; l: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const pp = i / N;
      const l = lambdaStar(pp, gamma, attacked);
      if (l > m) m = l;
      raw.push({ p: pp, l });
    }
    const yScale = (l: number) => padT + (1 - l / Math.max(0.6, m * 1.1)) * (H - padT - padB);
    const xScale = (pp: number) => padL + pp * (W - padL - padR);
    for (const r of raw) pts.push({ x: xScale(r.p), y: yScale(r.l), p: r.p, l: r.l });

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const cx = (a.x + b.x) / 2;
      d += ` Q ${cx} ${a.y}, ${b.x} ${b.y}`;
    }
    const f = `${d} L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z`;
    return { path: d, fill: f, samples: pts, max: m };
  }, [gamma, attacked]);

  const cursorIdx = Math.round(p * (samples.length - 1));
  const cursor = samples[cursorIdx];
  const lambdaP = lambdaStar(p, gamma, attacked);
  const edge0 = lambdaStar(0.01, gamma, attacked);
  const edge1 = lambdaStar(0.99, gamma, attacked);
  const midDip = lambdaStar(0.5, gamma, attacked);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-abyss text-foreground">
      <div className="noise-overlay" />

      {/* NAV */}
      <NavBar />

      {/* HEADER */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.05 }}
        className="relative z-10 mx-auto mt-20 w-full max-w-[1400px] px-8"
      >
        <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
          / 05 · math explorer
        </span>
        <h1 className="mt-4 font-display text-[56px] font-light leading-[0.95] tracking-[-0.04em]">
          λ* surface, <span className="italic font-extralight text-white/55">probed.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-white/55">
          a probability-bounded gaussian AMM. drag the controls. active liquidity stays bounded as p
          approaches 0 or 1 — by construction.
        </p>
      </motion.section>

      {/* LAYOUT */}
      <section className="relative z-10 mx-auto mt-12 grid w-full max-w-[1400px] grid-cols-1 gap-6 px-8 pb-24 lg:grid-cols-[320px_1fr]">
        {/* sidebar */}
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.15 }}
          className="omni-glass-heavy h-fit rounded-2xl p-6"
        >
          <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
            controls
          </span>

          <SliderRow
            label="probability · p"
            value={p}
            min={0.01}
            max={0.99}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={setP}
          />
          <SliderRow
            label="governance · γ′"
            value={gamma}
            min={1.0}
            max={5.0}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={setGamma}
          />

          <div className="mt-7 border-t border-white/5 pt-5">
            <label className="flex items-center justify-between">
              <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/55">
                informed trader attack
              </span>
              <button
                onClick={() => setAttacked((a) => !a)}
                className={`relative h-5 w-9 rounded-full border ease-precision ${
                  attacked
                    ? "border-[#ff8c00]/60 bg-[#ff8c00]/20"
                    : "border-white/15 bg-white/[0.03]"
                }`}
                style={attacked ? { boxShadow: "0 0 12px rgba(255,140,0,0.4)" } : undefined}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform duration-300 ease-precision ${
                    attacked ? "translate-x-4 bg-[#ff8c00]" : "translate-x-0 bg-white/70"
                  }`}
                  style={attacked ? { boxShadow: "0 0 8px rgba(255,140,0,0.7)" } : undefined}
                />
              </button>
            </label>
            <p className="mt-2 tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
              {attacked ? "adversarial flow injected at p=0.5" : "neutral flow"}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/5 pt-5">
            <Mini label="λ* @ p" value={lambdaP.toFixed(3)} accent="#00FFAA" />
            <Mini label="λ_max" value={max.toFixed(3)} />
            <Mini label="λ* @ p=0.01" value={edge0.toFixed(3)} />
            <Mini label="λ* @ p=0.99" value={edge1.toFixed(3)} />
            <Mini label="λ* @ p=0.5" value={midDip.toFixed(3)} />
            <Mini label="γ′" value={gamma.toFixed(2)} />
          </div>

          <p className="mt-5 tabular text-[9px] uppercase tracking-[0.22em] leading-relaxed text-white/35">
            note · λ* ≤ tanh(·) ⇒ <span className="text-[#00FFAA]">bounded</span> ∀ p ∈ [0,1]
          </p>
        </motion.aside>

        {/* canvas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.25 }}
          className="omni-glass-heavy relative overflow-hidden rounded-2xl p-6"
        >
          <div className="flex items-center justify-between">
            <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
              optimal activeness · λ*(p)
            </span>
            <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
              w-curve · 240 samples
            </span>
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[360px] w-full">
            <defs>
              <linearGradient id="exp-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(0,255,170,0.18)" />
                <stop offset="100%" stopColor="rgba(0,255,170,0)" />
              </linearGradient>
              <linearGradient id="exp-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(0,229,255,0.85)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.95)" />
                <stop offset="100%" stopColor="rgba(0,255,170,0.95)" />
              </linearGradient>
            </defs>

            {/* grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((g) => {
              const y = padT + (1 - g) * (H - padT - padB);
              return (
                <g key={`gy-${g}`}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.04)" />
                  <text
                    x={padL - 10}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="rgba(255,255,255,0.35)"
                    fontFamily="Geist Mono, monospace"
                    letterSpacing="0.16em"
                  >
                    {g.toFixed(2)}
                  </text>
                </g>
              );
            })}
            {[0, 0.25, 0.5, 0.75, 1].map((g) => {
              const x = padL + g * (W - padL - padR);
              return (
                <g key={`gx-${g}`}>
                  <line x1={x} y1={padT} x2={x} y2={H - padB} stroke="rgba(255,255,255,0.04)" />
                  <text
                    x={x}
                    y={H - padB + 18}
                    textAnchor="middle"
                    fontSize="10"
                    fill="rgba(255,255,255,0.35)"
                    fontFamily="Geist Mono, monospace"
                    letterSpacing="0.16em"
                  >
                    {g.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* axis labels */}
            <text
              x={W / 2}
              y={H - 12}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(255,255,255,0.4)"
              fontFamily="Geist Mono, monospace"
              letterSpacing="0.22em"
            >
              PROBABILITY · P
            </text>
            <text
              x={16}
              y={H / 2}
              transform={`rotate(-90 16 ${H / 2})`}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(255,255,255,0.4)"
              fontFamily="Geist Mono, monospace"
              letterSpacing="0.22em"
            >
              λ*
            </text>

            {/* fill + line */}
            <path d={fill} fill="url(#exp-fill)" />
            <path d={path} stroke="url(#exp-stroke)" strokeWidth="1.5" fill="none" />

            {/* cursor */}
            {cursor && (
              <g>
                <line
                  x1={cursor.x}
                  y1={padT}
                  x2={cursor.x}
                  y2={H - padB}
                  stroke="rgba(255,255,255,0.25)"
                  strokeDasharray="2 4"
                />
                <circle
                  cx={cursor.x}
                  cy={cursor.y}
                  r="4"
                  fill="#00FFAA"
                  style={{ filter: "drop-shadow(0 0 6px rgba(0,255,170,0.7))" }}
                />
              </g>
            )}
          </svg>

          <div className="mt-4 grid grid-cols-4 gap-3 border-t border-white/5 pt-5">
            <Readout label="p" value={p.toFixed(3)} />
            <Readout label="λ*(p)" value={lambdaP.toFixed(4)} accent="#00FFAA" />
            <Readout label="bounded" value="✓ tanh" />
            <Readout
              label="regime"
              value={attacked ? "attacked" : "neutral"}
              accent={attacked ? "#ff8c00" : undefined}
            />
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/55">
          {label}
        </span>
        <span
          className="tabular text-[13px] font-light text-[#00FFAA]"
          style={{ textShadow: "0 0 10px rgba(0,255,170,0.35)" }}
        >
          {format(value)}
        </span>
      </div>
      <div className="relative mt-3 h-6 select-none">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
        <div
          className="absolute top-1/2 h-px -translate-y-1/2"
          style={{
            left: 0,
            width: `${pct}%`,
            background: "linear-gradient(90deg,rgba(0,229,255,0.7),rgba(0,255,170,0.95))",
            boxShadow: "0 0 8px rgba(0,255,170,0.4)",
          }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-abyss"
          style={{
            left: `${pct}%`,
            boxShadow: "0 0 10px rgba(0,255,170,0.45), inset 0 0 4px rgba(255,255,255,0.3)",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
        />
      </div>
      <div className="mt-1 flex items-center justify-between tabular text-[9px] uppercase tracking-[0.22em] text-white/30">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-white/5 bg-white/[0.012] p-2.5">
      <span className="tabular text-[8px] uppercase tracking-[0.22em] text-white/35">{label}</span>
      <span
        className="tabular mt-0.5 text-[12px] font-light text-white/90"
        style={accent ? { color: accent, textShadow: `0 0 8px ${accent}55` } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/35">{label}</span>
      <span
        className="tabular mt-1 text-[16px] font-light text-white/95"
        style={accent ? { color: accent, textShadow: `0 0 10px ${accent}55` } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
