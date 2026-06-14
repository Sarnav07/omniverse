"use client";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { apexSpring } from "@/lib/motion";

import { useRef, useState } from "react";

function Card({
  span,
  header,
  body,
  children,
}: {
  span: string;
  header: string;
  body: string;
  children: ReactNode;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 100;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 100;
    
    setTilt({ x: -(y / 50) * 12, y: (x / 50) * 12 });
    setGlare({ x: 50 + x / 2, y: 50 + y / 2 });
  };

  return (
    <div className={span} style={{ perspective: "1000px" }}>
      <motion.div
        ref={ref}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setTilt({ x: 0, y: 0 }); }}
        onMouseMove={handleMouseMove}
        animate={{ 
          rotateX: tilt.x, 
          rotateY: tilt.y, 
          scale: isHovered ? 1.02 : 1 
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.5 }}
        style={{ transformStyle: "preserve-3d" }}
        className="h-full bg-white/[0.02] bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col gap-6 relative overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_10px_30px_rgba(0,0,0,0.5)] transition-colors duration-500 hover:border-white/20 hover:bg-white/[0.04]"
      >
        <div 
          className="flex-1 min-h-[200px] flex items-center justify-center relative z-10"
          style={{ transform: "translateZ(30px)" }}
        >
          {children}
        </div>
        <div className="relative z-10" style={{ transform: "translateZ(20px)" }}>
          <h3 className="text-xl md:text-[22px] font-medium text-[#F3F4F6] tracking-[-0.02em] leading-tight">
            {header}
          </h3>
          <p className="text-[13px] md:text-sm text-[#8B8D98] leading-relaxed mt-2.5 max-w-[44ch]">
            {body}
          </p>
        </div>

        {/* Glare effect */}
        <motion.div 
          className="absolute inset-0 z-20 pointer-events-none mix-blend-screen rounded-3xl"
          animate={{ opacity: isHovered ? 1 : 0 }}
          style={{
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.08) 0%, transparent 60%)`
          }}
        />
      </motion.div>
    </div>
  );
}

/* === Visuals === */

// Real Gaussian sampler -> SVG path
function gaussPath(width: number, height: number, sigma = 0.18, top = 0.12) {
  const N = 80;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0..1
    const x = t * width;
    const z = (t - 0.5) / sigma;
    const y = top + (1 - top) * (1 - Math.exp(-0.5 * z * z));
    pts.push([x, y * height]);
  }
  return pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");
}

function BellVisual() {
  const W = 460;
  const H = 180;
  const curve = gaussPath(W, H, 0.16, 0.08);
  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bellfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${curve} L ${W} ${H} L 0 ${H} Z`} fill="url(#bellfill)" />
        <path
          d={curve}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <line
          x1="0"
          y1={H * 0.6}
          x2={W}
          y2={H * 0.6}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1"
          strokeDasharray="3 5"
        />
      </svg>
      <div className="absolute top-3 left-3 font-mono text-[11px] text-[#8B8D98] bg-[#08080A]/80 border border-white/10 rounded px-2 py-1 backdrop-blur">
        λ*(p) = λ₀ + α(2p − 1)²
      </div>
    </div>
  );
}

function LedgerVisual() {
  const steps = ["USER INTENT", "SOLVER MESH", "SETTLEMENT"];
  return (
    <div className="flex flex-col items-stretch gap-3 w-full">
      {steps.map((s, i) => (
        <div key={s}>
          <div className="font-mono text-[10px] tracking-widest text-[#F3F4F6] bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 text-center">
            {s}
          </div>
          {i < steps.length - 1 && (
            <div className="flex justify-center my-1">
              <svg width="12" height="14">
                <path d="M 6 0 L 6 12 M 2 8 L 6 12 L 10 8" stroke="#8B8D98" fill="none" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LinkedVisual() {
  return (
    <div className="relative w-full max-w-[260px]">
      <div className="space-y-4 ml-8">
        <div className="bg-white/5 border border-white/10 rounded-lg h-12 w-full flex items-center px-4 font-mono text-[11px] text-[#8B8D98]">
          LEG · YES · 0xA1…
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg h-12 w-full flex items-center px-4 font-mono text-[11px] text-[#8B8D98]">
          LEG · NO · 0xA1…
        </div>
      </div>
      <svg className="absolute left-0 top-0 h-full" width="32" viewBox="0 0 32 80" preserveAspectRatio="none">
        <path
          d="M 16 14 L 16 66"
          stroke="#10B981"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          fill="none"
        />
      </svg>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-[#0E0E11] border border-[#10B981]/50 text-[#10B981] font-mono text-[9px] tracking-widest rounded-full px-2 py-1">
        LINKED
      </div>
    </div>
  );
}

function StylusTable() {
  const rows = [
    ["Gaussian CDF", "<$0.001"],
    ["Invariant Solve", "<$0.003"],
    ["Full Trade", "<$0.01"],
  ];
  return (
    <div className="w-full flex flex-col divide-y divide-white/5 font-mono text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between py-3">
          <span className="text-[#8B8D98]">{k}</span>
          <span className="text-[#10B981] tabular">{v}</span>
        </div>
      ))}
    </div>
  );
}

function LTVGauge() {
  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between font-mono text-[10px] tracking-widest text-[#8B8D98] uppercase">
        <span className="text-[#F3F4F6]">LTV: <span className="tabular">0.85</span></span>
        <span>LIMIT: <span className="tabular">0.85</span></span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-[#10B981] rounded-full" style={{ width: "85%" }} />
      </div>
      <div className="text-[11px] font-mono text-[#8B8D98]/70 pt-2">
        V = q<sub>yes</sub>·p + q<sub>no</sub>·(1 − p)
      </div>
    </div>
  );
}

function TelemetryStrip() {
  const stats = [
    { v: "19,948 WETH", k: "Capital Shielded" },
    { v: "100%", k: "LP Shield Status" },
    { v: "250ms", k: "Block Time" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
      {stats.map((s) => (
        <div key={s.k} className="flex flex-col gap-2 border-l border-white/10 pl-6 min-w-0">
          <div className="text-2xl md:text-3xl lg:text-4xl font-mono text-[#F3F4F6] tabular tracking-tight truncate">
            {s.v}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#8B8D98]">
            {s.k}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BentoGrid() {
  return (
    <section className="relative max-w-[1400px] mx-auto px-6 py-32">
      {/* Background glow to make the glassmorphism refract beautifully */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#3B82F6]/15 rounded-full blur-[120px] pointer-events-none -z-10" />
      
      <p className="text-[10px] font-mono text-[#8B8D98] uppercase tracking-[0.3em] mb-6">
        / 03 · The Quantitative Engine
      </p>
      <h2 className="text-4xl md:text-5xl font-medium text-[#F3F4F6] tracking-tight mb-16 max-w-2xl">
        Six pillars of <span className="font-serif italic text-[#8B8D98]">bounded liquidity.</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card
          span="md:col-span-8"
          header="Adaptive Risk Bounding."
          body="Liquidity contracts mathematically as markets approach probability edges. Bots find no edge against the Gaussian curve."
        >
          <BellVisual />
        </Card>
        <Card
          span="md:col-span-4"
          header="Intent-Based Execution."
          body="Drag capital. Drop intent. The decentralized solver mesh competes to secure your execution with zero slippage."
        >
          <LedgerVisual />
        </Card>
        <Card
          span="md:col-span-4"
          header="Same-Leg Validation."
          body="Protocol-level enforcement guarantees collateral and debt share identical probability legs."
        >
          <LinkedVisual />
        </Card>
        <Card
          span="md:col-span-4"
          header="WASM Compute."
          body="Complex Gaussian CDF logic executes entirely on-chain with order-of-magnitude gas reductions."
        >
          <StylusTable />
        </Card>
        <Card
          span="md:col-span-4"
          header="Zero Forced Exits."
          body="Borrow against prediction positions without hard liquidation thresholds. Capital settles probabilistically."
        >
          <LTVGauge />
        </Card>
        <Card
          span="md:col-span-12"
          header="Live Protocol Metrics."
          body="Verify the math in real-time. Omniverse provides absolute transparency into system health and attack mitigation."
        >
          <TelemetryStrip />
        </Card>
      </div>
    </section>
  );
}
