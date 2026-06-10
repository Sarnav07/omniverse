import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { NavBar } from "@/components/nav-bar";
import { SimulationBanner } from "@/components/simulation-banner";

export const Route = createFileRoute("/simulate")({
  head: () => ({
    meta: [
      { title: "Simulate — Zero-Liquidation Crash Test · Omniverse" },
      {
        name: "description",
        content:
          "Side-by-side crash test: traditional lending liquidations vs Omniverse probability-bounded settlement.",
      },
      { property: "og:title", content: "Simulate — Zero-Liquidation Crash Test" },
      {
        property: "og:description",
        content: "See traditional lending get liquidated while Omniverse settles to zero net P&L.",
      },
    ],
  }),
  component: SimulatePage,
});

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

function SimulatePage() {
  const [crashed, setCrashed] = useState(false);

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
          / 04 · zero-liquidation crash test
        </span>
        <h1 className="mt-4 font-display text-[56px] font-light leading-[0.95] tracking-[-0.04em]">
          two systems. <span className="italic font-extralight text-white/55">one crash.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-white/55">
          identical positions on traditional lending and omniverse. trigger the resolution event and
          watch what survives.
        </p>
      </motion.section>
      {/* SIMULATION BANNER — always visible, including presentMode */}
      <section className="relative z-10 mx-auto mt-6 w-full max-w-[1400px] px-8">
        <SimulationBanner />
      </section>

      {/* SPLIT */}
      <section className="relative z-10 mx-auto mt-12 grid w-full max-w-[1400px] grid-cols-1 gap-6 px-8 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.15 }}
        >
          <TraditionalPanel crashed={crashed} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.25 }}
        >
          <OmniversePanel crashed={crashed} />
        </motion.div>
      </section>

      {/* TRIGGER */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.35 }}
        className="relative z-10 mx-auto mt-10 w-full max-w-[1400px] px-8 pb-24"
      >
        <div className="omni-glass-heavy flex flex-col items-stretch gap-4 rounded-2xl p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col">
            <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
              resolution trigger
            </span>
            <span className="tabular mt-1 text-[14px] text-white/85">
              event · btc settles below 100k → outcome resolves to no
            </span>
          </div>
          <div className="flex gap-3">
            {crashed && (
              <button
                onClick={() => setCrashed(false)}
                className="rounded-full border border-white/15 px-5 py-3 tabular text-[11px] uppercase tracking-[0.24em] text-white/70 ease-precision hover:border-white/30 hover:text-white"
              >
                reset
              </button>
            )}
            <button
              onClick={() => setCrashed(true)}
              disabled={crashed}
              className={`group relative overflow-hidden rounded-full border px-7 py-3 tabular text-[12px] uppercase tracking-[0.28em] ease-precision ${
                crashed
                  ? "cursor-not-allowed border-white/10 text-white/30"
                  : "border-[#FF4D5E]/60 bg-[#FF4D5E]/10 text-[#FF4D5E] hover:bg-[#FF4D5E]/20"
              }`}
              style={
                !crashed
                  ? {
                      boxShadow:
                        "0 0 28px rgba(255,77,94,0.25), inset 0 0 18px rgba(255,77,94,0.1)",
                    }
                  : undefined
              }
            >
              <span className="relative">
                {crashed ? "event triggered" : "resolve market to no · trigger crash"}
              </span>
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

/* ──────────────────── traditional ──────────────────── */

function TraditionalPanel({ crashed }: { crashed: boolean }) {
  const [collateral, setCollateral] = useState(10000);
  const [health, setHealth] = useState(1.4);

  useEffect(() => {
    if (!crashed) {
      setCollateral(10000);
      setHealth(1.4);
      return;
    }
    let v = 10000;
    let h = 1.4;
    const i = setInterval(() => {
      v = Math.max(3500, v - 220);
      h = Math.max(0.49, h - 0.04);
      setCollateral(v);
      setHealth(h);
      if (v <= 3500) clearInterval(i);
    }, 60);
    return () => clearInterval(i);
  }, [crashed]);

  const liquidated = crashed && health < 1.0;

  return (
    <div className="omni-glass-heavy relative overflow-hidden rounded-2xl p-7">
      <div className="flex items-center justify-between">
        <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
          / traditional lending
        </span>
        <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
          aave · v3
        </span>
      </div>
      <h2 className="mt-3 font-display text-[28px] font-light tracking-[-0.02em] text-white/90">
        forced exit, capital impaired.
      </h2>

      <div className="mt-7 space-y-4">
        <Row label="collateral" value={`$${collateral.toLocaleString()} eth`} />
        <Row label="debt" value="$5,000 usdc" muted />
        <Row
          label="health factor"
          value={health.toFixed(2)}
          accent={health >= 1.0 ? "#ff8c00" : "#FF4D5E"}
        />
        <div>
          <div className="flex items-center justify-between tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
            <span>liquidation threshold</span>
            <span>1.00</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="h-full"
              style={{
                width: `${Math.max(8, (health / 2) * 100)}%`,
                background: health >= 1.0 ? "linear-gradient(90deg,#ff8c00,#FF4D5E)" : "#FF4D5E",
                transition: "width 0.4s var(--ease-precision)",
                boxShadow: health < 1.0 ? "0 0 14px rgba(255,77,94,0.6)" : undefined,
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-3 gap-3 border-t border-white/5 pt-5">
        <Mini label="liq. penalty" value="-10%" />
        <Mini label="gas spent" value="$84" />
        <Mini label="slippage" value="-20%" />
      </div>

      <AnimatePresence>
        {liquidated && (
          <motion.div
            initial={{ opacity: 0, scale: 1.2, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: -10 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div
              className="border-4 border-[#FF4D5E] px-8 py-4 backdrop-blur-sm"
              style={{
                boxShadow: "0 0 60px rgba(255,77,94,0.55), inset 0 0 24px rgba(255,77,94,0.25)",
                background: "rgba(255,77,94,0.06)",
              }}
            >
              <div
                className="font-display text-[34px] font-light tracking-[0.04em] text-[#FF4D5E]"
                style={{ textShadow: "0 0 18px rgba(255,77,94,0.65)" }}
              >
                LIQUIDATED
              </div>
              <div className="tabular mt-1 text-center text-[11px] uppercase tracking-[0.32em] text-[#FF4D5E]/80">
                −30% penalty
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────── omniverse ──────────────────── */

function OmniversePanel({ crashed }: { crashed: boolean }) {
  const [collateral, setCollateral] = useState(10000);
  const [debt, setDebt] = useState(5000);

  useEffect(() => {
    if (!crashed) {
      setCollateral(10000);
      setDebt(5000);
      return;
    }
    let c = 10000;
    let d = 5000;
    const i = setInterval(() => {
      c = Math.max(0, c - 420);
      d = Math.max(0, d - 210);
      setCollateral(c);
      setDebt(d);
      if (c === 0 && d === 0) clearInterval(i);
    }, 60);
    return () => clearInterval(i);
  }, [crashed]);

  const settled = crashed && collateral === 0 && debt === 0;

  return (
    <div className="omni-glass-heavy relative overflow-hidden rounded-2xl p-7">
      <div className="flex items-center justify-between">
        <span
          className="tabular text-[10px] uppercase tracking-[0.32em] text-[#00FFAA]"
          style={{ textShadow: "0 0 12px rgba(0,255,170,0.35)" }}
        >
          / omniverse
        </span>
        <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
          probability-bounded
        </span>
      </div>
      <h2 className="mt-3 font-display text-[28px] font-light tracking-[-0.02em] text-white/90">
        symmetric cancellation. net zero.
      </h2>

      <div className="mt-7 space-y-4">
        <Row label="collateral" value={`${collateral.toLocaleString()} yes-eth`} />
        <Row label="debt" value={`${debt.toLocaleString()} yes-usdc`} muted />
        <Row
          label="health factor"
          value={settled ? "—" : "1.40 · p(yes) canceled"}
          accent="#00FFAA"
        />
        <div>
          <div className="flex items-center justify-between tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
            <span>net exposure</span>
            <span>${(collateral - debt).toLocaleString()}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="h-full"
              style={{
                width: `${Math.max(4, ((collateral - debt) / 5000) * 100)}%`,
                background: "linear-gradient(90deg,rgba(0,255,170,0.5),#00FFAA)",
                transition: "width 0.4s var(--ease-precision)",
                boxShadow: "0 0 14px rgba(0,255,170,0.5)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-3 gap-3 border-t border-white/5 pt-5">
        <Mini label="liq. penalty" value="0%" accent="#00FFAA" />
        <Mini label="gas spent" value="$0.12" />
        <Mini label="slippage" value="0%" accent="#00FFAA" />
      </div>

      <AnimatePresence>
        {settled && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div
              className="flex items-center gap-3 rounded-full border border-[#00FFAA]/50 bg-abyss/40 px-6 py-3 backdrop-blur-md"
              style={{
                boxShadow: "0 0 40px rgba(0,255,170,0.25), inset 0 0 20px rgba(0,255,170,0.15)",
              }}
            >
              <span
                className="h-2 w-2 rounded-full bg-[#00FFAA]"
                style={{ boxShadow: "0 0 12px rgba(0,255,170,0.8)" }}
              />
              <span
                className="tabular text-[13px] uppercase tracking-[0.28em] text-[#00FFAA]"
                style={{ textShadow: "0 0 14px rgba(0,255,170,0.5)" }}
              >
                settled safely · net p&l: $0
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────── primitives ──────────────────── */

function Row({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-3">
      <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/40">{label}</span>
      <span
        className={`tabular text-[18px] font-light ${muted ? "text-white/55" : "text-white/95"}`}
        style={accent ? { color: accent, textShadow: `0 0 12px ${accent}55` } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/35">{label}</span>
      <span
        className="tabular mt-1 text-[13px] font-light text-white/90"
        style={accent ? { color: accent, textShadow: `0 0 10px ${accent}55` } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
