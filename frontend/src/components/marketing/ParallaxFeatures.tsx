"use client";
import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";

function IntentTerminal() {
  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <div className="grid grid-cols-3 bg-white/[0.03] border border-white/10 rounded-full p-1 text-[10px] font-mono uppercase tracking-widest">
        {["Swap", "Borrow", "Manage"].map((t, i) => (
          <div
            key={t}
            className={`text-center py-2 rounded-full ${
              i === 1 ? "bg-white/10 text-white" : "text-[#8B8D98]"
            }`}
          >
            {t}
          </div>
        ))}
      </div>

      <div className="relative space-y-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#8B8D98] mb-1">
            Collateral · WETH
          </div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-mono tabular text-[#F3F4F6]">1000</span>
            <span className="text-[11px] font-mono text-[#8B8D98]">≈ $3,210,400</span>
          </div>
        </div>

        <svg
          className="absolute left-6 top-[78px] pointer-events-none"
          width="20"
          height="46"
        >
          <path
            d="M 10 0 C 10 20, 0 26, 10 46"
            stroke="#10B981"
            strokeWidth="1.5"
            fill="none"
            className="dash-flow"
          />
        </svg>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#8B8D98] mb-1">
            Debt · YES @ 0.62
          </div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-mono tabular text-[#F3F4F6]">500</span>
            <span className="text-[11px] font-mono text-[#10B981]">SAME-LEG ✓</span>
          </div>
        </div>
      </div>

      <button className="bg-white/10 border border-white/20 rounded-full w-full py-3 text-center text-[10px] font-bold tracking-[0.25em] uppercase text-white hover:bg-white hover:text-black transition-all">
        Approve WETH
      </button>
    </div>
  );
}

function MathExplorer() {
  const W = 600;
  const H = 280;
  const sigma = 0.16;
  const top = 0.12;
  const N = 100;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = t * W;
    const z = (t - 0.5) / sigma;
    const y = top + (1 - top) * (1 - Math.exp(-0.5 * z * z));
    pts.push([x, y * H]);
  }
  const curve = pts
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(" ");
  const peakX = W / 2;
  const peakY = top * H;

  return (
    <div className="w-full relative">
      <div className="absolute top-0 left-0 font-mono text-[11px] text-[#8B8D98] bg-[#08080A]/80 border border-white/10 rounded px-2 py-1 z-10">
        λ*(p) = λ₀ + α(2p − 1)²
      </div>
      <div className="absolute top-0 right-0 font-mono text-[10px] text-[#8B8D98] uppercase tracking-widest z-10">
        p = 0.50
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <pattern id="diagLines" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#3B82F6" strokeWidth="1" opacity="0.25" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Array.from({ length: 6 }).map((_, i) => (
          <line
            key={i}
            x1="0"
            x2={W}
            y1={(i + 1) * 40}
            y2={(i + 1) * 40}
            stroke="rgba(255,255,255,0.04)"
          />
        ))}

        <path d={`${curve} L ${W} ${H} L 0 ${H} Z`} fill="url(#diagLines)" />
        <path
          d={curve}
          stroke="#3B82F6"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
          filter="url(#glow)"
        />
        <line
          x1={peakX}
          y1={peakY}
          x2={peakX}
          y2={H}
          stroke="rgba(59,130,246,0.4)"
          strokeDasharray="3 4"
        />
        <circle cx={peakX} cy={peakY} r="5" fill="#3B82F6" />
      </svg>
      <div className="grid grid-cols-3 gap-4 mt-4 font-mono text-[10px] uppercase tracking-widest text-[#8B8D98]">
        <div>p = 0 <span className="text-[#F3F4F6] tabular">λ = 0.04</span></div>
        <div className="text-center">p = 0.5 <span className="text-[#F3F4F6] tabular">λ = 0.42</span></div>
        <div className="text-right">p = 1 <span className="text-[#F3F4F6] tabular">λ = 0.04</span></div>
      </div>
    </div>
  );
}

function ActivityLedger() {
  const rows = [
    ["YES", "ETH-USD > 4k", "1,200", "Filled"],
    ["NO", "BTC-Halv 2028", "850", "Filled"],
    ["YES", "FED Cut JUN", "3,420", "Filled"],
    ["NO", "ETH-USD > 4k", "2,100", "Pending"],
    ["YES", "GPT-6 2026", "640", "Filled"],
  ];
  return (
    <div className="w-full font-mono text-xs">
      <div className="grid grid-cols-[60px_1fr_100px_90px] gap-4 pb-3 border-b border-white/10 text-[10px] uppercase tracking-widest text-[#8B8D98]">
        <span>Side</span>
        <span>Asset</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Status</span>
      </div>
      <div className="divide-y divide-white/5">
        {rows.map(([side, asset, amt, status], i) => (
          <div key={i} className="grid grid-cols-[60px_1fr_100px_90px] gap-4 py-3 items-center">
            <span className={side === "YES" ? "text-[#10B981]" : "text-[#EF4444]"}>{side}</span>
            <span className="text-[#F3F4F6]">{asset}</span>
            <span className="text-right text-[#F3F4F6] tabular">{amt}</span>
            <span className="flex items-center justify-end gap-2 text-[#8B8D98]">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  status === "Filled" ? "bg-[#10B981]" : "bg-amber-400"
                } pulse-live`}
              />
              {status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SECTIONS = [
  {
    id: 1,
    title: "Drag Capital. Drop Intent.",
    description:
      "The Execution Terminal abstracts complex AMM routing. You simply specify your collateral and desired exposure. Same-leg validation ensures cryptographic safety before the transaction reaches the solver mesh.",
    visual: <IntentTerminal />,
  },
  {
    id: 2,
    title: "Probability-Bounded Defense.",
    description:
      "Probe the surface of the Gaussian band in real time. Watch as the optimal activeness formula constricts liquidity when certainty approaches 0 or 1, mathematically neutralizing toxic flow.",
    visual: <MathExplorer />,
  },
  {
    id: 3,
    title: "Transparent Settlement.",
    description:
      "Every solver route, fee extraction, and symmetric cancellation is indexed and verified. Institutional capital requires institutional transparency.",
    visual: <ActivityLedger />,
  },
];

export function ParallaxFeatures() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollRange, setScrollRange] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    if (!scrollRef.current) return;
    const update = () => {
      setScrollRange(scrollRef.current!.scrollWidth);
      setViewportWidth(window.innerWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { scrollYProgress } = useScroll({ target: containerRef });
  
  // Transform horizontal translation to end right when the last card is fully visible
  const transform = useTransform(scrollYProgress, [0, 1], [0, -scrollRange + viewportWidth]);
  const spring = useSpring(transform, { damping: 60, mass: 1, stiffness: 500 });

  return (
    <section ref={containerRef} className="relative w-full bg-[#08080A]" style={{ height: scrollRange ? scrollRange + 200 : "300vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden flex items-center pt-24 pb-12">
        
        {/* Fixed Title that stays on screen while cards scroll past */}
        <div className="absolute top-32 left-16 md:left-32 z-20 pointer-events-none">
          <p className="text-[10px] font-mono text-[#8B8D98] uppercase tracking-[0.3em] mb-6">
            / 04 · Architecture
          </p>
          <h2 className="text-4xl md:text-5xl font-medium text-[#F3F4F6] tracking-tight max-w-2xl">
            Symmetric execution <span className="font-serif italic text-[#8B8D98]">at scale.</span>
          </h2>
        </div>

        <motion.div ref={scrollRef} style={{ x: spring }} className="flex gap-40 px-16 md:px-32 pt-40 w-max">
          {SECTIONS.map((s, idx) => (
            <div 
              key={s.id} 
              className="flex flex-col lg:flex-row items-center w-[85vw] max-w-6xl shrink-0 gap-12 lg:gap-24 rounded-3xl border border-white/10 bg-[#0A0A0C] p-12 lg:p-16 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
            >
              
              <div className="w-full lg:w-1/2 space-y-6">
                <p className="text-[10px] font-mono text-[#8B8D98] uppercase tracking-[0.3em]">
                  / 03 · Feature {idx + 1}
                </p>
                <h3 className="text-3xl md:text-5xl font-serif italic text-[#F3F4F6] tracking-tight">{s.title}</h3>
                <p className="text-[#8B8D98] leading-relaxed md:text-lg">{s.description}</p>
              </div>

              <div className="w-full lg:w-1/2 rounded-2xl border border-white/5 bg-white/[0.02] p-8 min-h-[380px] flex items-center justify-center">
                {s.visual}
              </div>

            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
