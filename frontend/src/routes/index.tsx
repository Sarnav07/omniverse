import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useInView, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef } from "react";
import {
  ShieldCheck,
  Cpu,
  LockKeyhole,
  ArrowRight,
  CheckCircle2,
  Activity,
  Sparkles,
  Zap,
} from "lucide-react";
import { NavBar } from "@/components/nav-bar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Omniverse — Stop bleeding liquidity to bots" },
      {
        name: "description",
        content:
          "The first prediction market protocol with dynamic LP defense, powered by Arbitrum Stylus. Zero liquidations, adaptive fees, on-chain Gaussian math.",
      },
      { property: "og:title", content: "Omniverse — Stop bleeding liquidity to bots" },
      {
        property: "og:description",
        content:
          "Dynamic LP defense + zero-liquidation lending for prediction markets, powered by Arbitrum Stylus.",
      },
    ],
  }),
  component: Landing,
});

const EASE = [0.16, 1, 0.3, 1] as const;

/* ─────────────────────────── page ─────────────────────────── */

function Landing() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-abyss text-foreground antialiased">
      {/* Same monochrome wash as /demo */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[60vh] opacity-[0.35]"
        style={{
          background: "radial-gradient(60% 60% at 50% 0%, rgba(255,255,255,0.08), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 h-[40vh] opacity-[0.22]"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 100%, rgba(255,255,255,0.05), transparent 70%)",
        }}
      />
      <div className="noise-overlay" />

      <div className="border-b border-white/[0.05]">
        <NavBar hideWallet />
      </div>

      <Hero />
      <TrustTicker />
      <BentoSection />
      <ValueSavedSection />
      <FooterCTA />

      <footer className="relative z-10 mx-auto w-full max-w-[1400px] border-t border-white/5 px-8 py-10">
        <div className="tabular flex flex-wrap items-center justify-between gap-4 text-[11px] uppercase tracking-[0.18em] text-white/35">
          <span>© omniverse labs · v4.0 · arbitrum</span>
          <div className="flex items-center gap-8">
            <a
              className="hover:text-white"
              href="https://sepolia.arbiscan.io/"
              target="_blank"
              rel="noreferrer"
            >
              status
            </a>
            <a
              className="hover:text-white"
              href="https://github.com/vihaan1016/omniverse"
              target="_blank"
              rel="noreferrer"
            >
              github
            </a>
            <a
              className="hover:text-white"
              href="https://arxiv.org/html/2602.09887"
              target="_blank"
              rel="noreferrer"
            >
              whitepaper
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────── hero ─────────────────────────── */

function Hero() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1300px] px-8 pt-28 pb-32 md:pt-36 md:pb-44">
      <WCurveBackdrop />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative mx-auto flex max-w-3xl flex-col items-center text-center"
      >
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-md">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/70">
            Live on Arbitrum Stylus
          </span>
        </div>

        <h1
          className="text-balance font-display text-[12vw] font-light leading-[0.95] tracking-[-0.04em] md:text-[5.6rem]"
          style={{ fontFamily: "'Outfit', 'Space Grotesk', system-ui, sans-serif" }}
        >
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
            className="block"
          >
            Stop bleeding liquidity
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.18 }}
            className="block"
          >
            to <span className="italic text-white/55">bots</span>.
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
          className="mt-8 max-w-xl text-balance text-[15px] leading-relaxed text-white/60"
        >
          The first prediction market protocol with dynamic LP defense — powered by Arbitrum Stylus
          and on-chain Gaussian math.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
          className="mt-12 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            to="/demo"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-7 py-3.5 text-[13px] font-medium text-abyss transition-colors hover:bg-white/90"
          >
            <span className="relative">Launch App</span>
            <ArrowRight
              className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              strokeWidth={1.5}
            />
          </Link>
          <Link
            to="/demo"
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 px-6 py-3 text-[13px] text-white/70 transition hover:border-white/25 hover:text-white"
          >
            View Live Demo
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.5}
            />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

function WCurveBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width;
      const y = (e.clientY - r.top - r.height / 2) / r.height;
      el.style.transform = `translate3d(${x * 12}px, ${y * 10}px, 0)`;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 grid place-items-center transition-transform duration-700 ease-out"
    >
      <svg
        viewBox="0 0 800 320"
        className="w-[min(110%,1100px)] opacity-[0.45]"
        style={{
          maskImage: "radial-gradient(ellipse at center, #000 30%, transparent 75%)",
        }}
      >
        <defs>
          <linearGradient id="w-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="w-blur">
            <feGaussianBlur stdDeviation="0.4" />
          </filter>
        </defs>
        {Array.from({ length: 5 }).map((_, i) => (
          <path
            key={i}
            d="M 0 160 C 120 160, 180 40, 320 200 S 520 280, 640 80 S 760 160, 800 160"
            stroke="url(#w-grad)"
            strokeWidth={1 + i * 0.4}
            fill="none"
            opacity={0.12 + i * 0.08}
            filter="url(#w-blur)"
          >
            <animate
              attributeName="d"
              dur={`${8 + i}s`}
              repeatCount="indefinite"
              values="
                M 0 160 C 120 160, 180 40, 320 200 S 520 280, 640 80 S 760 160, 800 160;
                M 0 160 C 120 180, 180 60, 320 180 S 520 260, 640 100 S 760 140, 800 160;
                M 0 160 C 120 160, 180 40, 320 200 S 520 280, 640 80 S 760 160, 800 160"
            />
          </path>
        ))}
        <line
          x1="0"
          y1="160"
          x2="800"
          y2="160"
          stroke="rgba(255,255,255,0.06)"
          strokeDasharray="2 6"
        />
      </svg>
    </div>
  );
}

/* ─────────────────────────── trust ticker ─────────────────────────── */

function TrustTicker() {
  const items = [
    { icon: CheckCircle2, label: "Verified on Arbitrum" },
    { icon: ShieldCheck, label: "Zero Liquidations" },
    { icon: Cpu, label: "Stylus Math Kernel" },
    { icon: Activity, label: "Dynamic λ Fees" },
    { icon: Sparkles, label: "Gaussian W-Curve" },
    { icon: Zap, label: "Sub-second Settlement" },
  ];
  const loop = [...items, ...items];
  return (
    <section className="relative z-10 border-y border-white/[0.05] bg-white/[0.012] py-5 backdrop-blur-sm">
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
        <div className="flex w-max animate-[ticker_38s_linear_infinite] gap-12 px-6">
          {loop.map((it, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 whitespace-nowrap text-[12px] text-white/55"
            >
              <it.icon className="h-3.5 w-3.5 text-white/70" strokeWidth={1.5} />
              <span className="tracking-wide">{it.label}</span>
              <span className="text-white/15">•</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </section>
  );
}

/* ─────────────────────────── bento ─────────────────────────── */

function BentoSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1300px] px-8 py-28 md:py-36">
      <Reveal>
        <div className="mb-14 max-w-2xl">
          <span className="tabular text-[11px] uppercase tracking-[0.3em] text-white/40">
            / How it works
          </span>
          <h2
            className="mt-4 text-balance text-4xl font-light leading-[1.05] tracking-[-0.03em] md:text-5xl"
            style={{ fontFamily: "'Outfit', 'Space Grotesk', system-ui, sans-serif" }}
          >
            A protocol that <span className="italic text-white/60">defends</span> your liquidity —
            not just lists it.
          </h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
        <BentoCard
          className="md:row-span-2"
          index={0}
          icon={<ShieldCheck className="h-6 w-6 text-white/85" strokeWidth={1.5} />}
          tag="01 · Dynamic Defense"
          title="Adaptive fees that protect LPs exactly when markets get certain."
          body="As probability moves to the edges, our dynamic λ kicks in — locking passive liquidity from bots while routing fees back to active LPs."
        >
          <ShieldVisual />
        </BentoCard>

        <BentoCard
          index={1}
          icon={<Cpu className="h-6 w-6 text-white/85" strokeWidth={1.5} />}
          tag="02 · Stylus Powered"
          title="Gaussian math executing natively on-chain. Zero compromises."
          body="Arbitrum Stylus runs the heavy W-curve kernel as a Rust contract — at the speed of native code, with the security of Ethereum."
        >
          <StylusVisual />
        </BentoCard>

        <BentoCard
          index={2}
          icon={<Activity className="h-6 w-6 text-white/85" strokeWidth={1.5} />}
          tag="03 · Real-time λ"
          title="The W-curve, watching every block."
          body="Dynamic fees recalibrate on every state change — no governance lag, no manual tuning."
        >
          <LambdaVisual />
        </BentoCard>

        <BentoCard
          className="md:col-span-2"
          index={3}
          icon={<LockKeyhole className="h-6 w-6 text-white/85" strokeWidth={1.5} />}
          tag="04 · Zero-Liquidation Lending"
          title="Borrow against your predictions. No margin calls. Sleep soundly."
          body="Positions settle, never liquidate. Probability-bounded collateral curves replace the brutal mechanics of hard-threshold liquidation engines."
        >
          <ScaleVisual />
        </BentoCard>
      </div>
    </section>
  );
}

function BentoCard({
  index,
  icon,
  tag,
  title,
  body,
  className = "",
  children,
}: {
  index: number;
  icon: React.ReactNode;
  tag: string;
  title: string;
  body: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.08 }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018] p-7 backdrop-blur-xl transition-colors hover:border-white/[0.16] ${className}`}
      style={{
        boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.04), 0 30px 80px -30px rgba(0,0,0,0.7)",
      }}
    >
      <div className="relative flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.03] transition-transform duration-500 group-hover:scale-105">
          {icon}
        </div>
        <span className="tabular text-[10px] uppercase tracking-[0.24em] text-white/40">{tag}</span>
      </div>

      <h3
        className="relative mt-6 max-w-[26ch] text-[20px] font-light leading-tight tracking-[-0.02em] text-white"
        style={{ fontFamily: "'Outfit', 'Space Grotesk', system-ui, sans-serif" }}
      >
        {title}
      </h3>
      <p className="relative mt-3 max-w-[34ch] text-[13.5px] leading-relaxed text-white/55">
        {body}
      </p>

      {children && <div className="relative mt-auto pt-8">{children}</div>}
    </motion.div>
  );
}

/* ─────────────────────────── visuals ─────────────────────────── */

function ShieldVisual() {
  return (
    <div className="relative grid aspect-square place-items-center">
      <div className="absolute inset-6 rounded-full border border-white/10" />
      <div className="absolute inset-12 rounded-full border border-white/[0.07]" />
      <div className="absolute inset-20 rounded-full border border-white/[0.04]" />
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 m-auto h-40 w-40 rounded-full bg-white/[0.05] blur-2xl"
      />
      <ShieldCheck className="relative h-20 w-20 text-white/90" strokeWidth={1.2} />
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/35">
        <span>λ active</span>
        <span className="tabular text-white/70">99.4%</span>
      </div>
    </div>
  );
}

function StylusVisual() {
  return (
    <div className="relative h-32 overflow-hidden rounded-xl border border-white/5 bg-black/40">
      <svg viewBox="0 0 300 120" className="h-full w-full">
        {Array.from({ length: 18 }).map((_, i) => (
          <rect
            key={i}
            x={i * 17 + 4}
            y={60 - Math.sin(i * 0.6) * 30 - 8}
            width="10"
            height={Math.sin(i * 0.6) * 30 + 40}
            rx="2"
            fill="#ffffff"
            opacity={0.18 + (i % 3) * 0.12}
          >
            <animate
              attributeName="height"
              dur={`${2 + (i % 4) * 0.3}s`}
              values={`${20 + (i % 5) * 6};${60 + (i % 4) * 8};${20 + (i % 5) * 6}`}
              repeatCount="indefinite"
            />
          </rect>
        ))}
      </svg>
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
        <span>stylus.kernel</span>
        <span className="text-white/65">240ms p99</span>
      </div>
    </div>
  );
}

function LambdaVisual() {
  return (
    <div className="relative h-32 overflow-hidden rounded-xl border border-white/5 bg-black/40">
      <svg viewBox="0 0 300 120" className="h-full w-full">
        <defs>
          <linearGradient id="lam-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M 0 90 C 60 90 80 30 150 60 S 250 90 300 50 L 300 120 L 0 120 Z"
          fill="url(#lam-grad)"
        />
        <path
          d="M 0 90 C 60 90 80 30 150 60 S 250 90 300 50"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="150" cy="60" r="3" fill="#fff">
          <animate
            attributeName="cx"
            values="40;150;260;150;40"
            dur="6s"
            repeatCount="indefinite"
          />
          <animate attributeName="cy" values="86;60;72;60;86" dur="6s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div className="absolute top-2 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
        λ(p)
      </div>
    </div>
  );
}

function ScaleVisual() {
  return (
    <div className="relative grid h-32 place-items-center">
      <motion.svg
        viewBox="0 0 220 120"
        className="h-full"
        animate={{ rotate: [-3, 3, -3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <line x1="110" y1="20" x2="110" y2="100" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <line x1="40" y1="40" x2="180" y2="40" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1="40" y1="40" x2="40" y2="70" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <line x1="180" y1="40" x2="180" y2="70" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <rect
          x="20"
          y="68"
          width="40"
          height="20"
          rx="3"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1"
        />
        <rect
          x="160"
          y="68"
          width="40"
          height="20"
          rx="3"
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
        />
        <circle cx="110" cy="20" r="3" fill="#fff" />
        <text
          x="40"
          y="105"
          textAnchor="middle"
          fontSize="9"
          fill="rgba(255,255,255,0.5)"
          fontFamily="monospace"
        >
          COLLATERAL
        </text>
        <text
          x="180"
          y="105"
          textAnchor="middle"
          fontSize="9"
          fill="rgba(255,255,255,0.5)"
          fontFamily="monospace"
        >
          DEBT
        </text>
      </motion.svg>
    </div>
  );
}

/* ─────────────────────────── value saved ─────────────────────────── */

function ValueSavedSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1300px] px-8 py-28 md:py-36">
      <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-20">
        <Reveal>
          <span className="tabular text-[11px] uppercase tracking-[0.3em] text-white/40">
            / The math in action
          </span>
          <h2
            className="mt-4 text-balance text-4xl font-light leading-[1.05] tracking-[-0.03em] md:text-5xl"
            style={{ fontFamily: "'Outfit', 'Space Grotesk', system-ui, sans-serif" }}
          >
            See how our dynamic curve <span className="italic text-white/60">out-performs</span>{" "}
            constant pools in real time.
          </h2>
          <p className="mt-6 max-w-md text-[14px] leading-relaxed text-white/55">
            Every block, the W-curve recalibrates fees to neutralize arbitrage flow. The savings
            don't go to bots — they stay with the LPs who actually provided the liquidity.
          </p>
          <ul className="mt-8 space-y-3 text-[13.5px] text-white/70">
            {[
              "Outperforms constant-product AMMs on volatile markets",
              "Zero liquidations since genesis",
              "Bot-extraction approaching zero across the curve",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-[3px] h-4 w-4 flex-shrink-0 text-white/75"
                  strokeWidth={1.5}
                />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <SavedDashboard />
      </div>
    </section>
  );
}

function SavedDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-xl"
      style={{
        boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.05), 0 40px 120px -40px rgba(0,0,0,0.8)",
      }}
    >
      <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-white/[0.04] blur-3xl" />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-white/55">
            live · LVR shield
          </span>
        </div>
        <span className="tabular text-[11px] text-white/40">block 198,341,022</span>
      </div>

      <div className="relative mt-8">
        <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">
          Money saved from bots
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-white/70 text-4xl font-light">$</span>
          <Counter to={1010.42} />
          <span className="ml-1 text-white/40">WETH</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-white/55">
          <span>▲</span>
          <span className="tabular">+12.84 in the last 60s</span>
        </div>
      </div>

      <div className="relative mt-8 rounded-xl border border-white/5 bg-black/30 p-4">
        <CompareChart />
      </div>

      <div className="relative mt-6 grid grid-cols-3 gap-3 text-center">
        {[
          { k: "Constant", v: "−$842", dim: true },
          { k: "Omniverse", v: "+$168", dim: false },
          { k: "Δ to LPs", v: "+$1,010", dim: false },
        ].map((s) => (
          <div key={s.k} className="rounded-lg border border-white/5 bg-white/[0.02] py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">{s.k}</div>
            <div
              className={`tabular mt-1 text-[15px] ${s.dim ? "text-white/40 line-through" : "text-white"}`}
            >
              {s.v}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Counter({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 22 });
  useEffect(() => {
    if (inView) mv.set(to);
  }, [inView, to, mv]);
  useEffect(() => {
    return spring.on("change", (v) => {
      if (ref.current) {
        ref.current.textContent = v.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }
    });
  }, [spring]);
  return (
    <span
      ref={ref}
      className="tabular text-5xl font-light tracking-[-0.02em] text-white"
      style={{ fontFamily: "'Outfit','Space Grotesk',system-ui,sans-serif" }}
    >
      0.00
    </span>
  );
}

function CompareChart() {
  return (
    <svg viewBox="0 0 300 110" className="h-28 w-full">
      <defs>
        <linearGradient id="cmp-omni" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="0"
          x2="300"
          y1={i * 27 + 5}
          y2={i * 27 + 5}
          stroke="rgba(255,255,255,0.04)"
        />
      ))}
      {/* constant pool — decaying (dimmed white dashed) */}
      <path
        d="M 0 30 C 60 35 100 60 150 70 S 240 92 300 96"
        stroke="rgba(255,255,255,0.32)"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="4 4"
      />
      {/* omniverse — climbing (bright white) */}
      <path
        d="M 0 70 C 60 60 110 40 160 28 S 250 18 300 14 L 300 110 L 0 110 Z"
        fill="url(#cmp-omni)"
      />
      <path
        d="M 0 70 C 60 60 110 40 160 28 S 250 18 300 14"
        stroke="#ffffff"
        strokeWidth="1.8"
        fill="none"
      />
      <circle cx="300" cy="14" r="3" fill="#ffffff" />
      <text x="6" y="20" fontSize="9" fill="rgba(255,255,255,0.4)" fontFamily="monospace">
        PNL
      </text>
      <text x="262" y="105" fontSize="9" fill="rgba(255,255,255,0.4)" fontFamily="monospace">
        constant
      </text>
      <text x="252" y="22" fontSize="9" fill="rgba(255,255,255,0.85)" fontFamily="monospace">
        omniverse
      </text>
    </svg>
  );
}

/* ─────────────────────────── footer cta ─────────────────────────── */

function FooterCTA() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1400px] px-8 pb-32">
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.018] p-16 text-center md:p-24">
        <div
          className="absolute inset-x-0 -top-40 mx-auto h-80 w-[640px] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-abyss to-transparent" />

        <Reveal>
          <h2
            className="relative text-balance text-5xl font-light leading-[1.02] tracking-[-0.035em] md:text-7xl"
            style={{ fontFamily: "'Outfit', 'Space Grotesk', system-ui, sans-serif" }}
          >
            Ready to trade smarter?
          </h2>
          <p className="relative mx-auto mt-6 max-w-md text-[15px] text-white/55">
            The terminal is open. The math is on-chain. Your capital decides.
          </p>
          <div className="relative mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/demo"
              className="group relative inline-flex items-center gap-2 rounded-full bg-white px-9 py-4 text-[14px] font-medium text-abyss transition-colors hover:bg-white/90"
            >
              <span className="relative">Enter the Omniverse</span>
              <ArrowRight
                className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={1.5}
              />
            </Link>
            <a
              href="https://arxiv.org/html/2602.09887"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 px-7 py-4 text-[13px] text-white/65 transition hover:border-white/25 hover:text-white"
            >
              Read the whitepaper ↗
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── reveal ─────────────────────────── */

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
