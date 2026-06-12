import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Nav } from "@/components/marketing/Nav";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/simulate")({
  component: () => <Navigate to="/demo" />,
});

/* Commented out - use /demo instead
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

const TRAD_START = { collateral: 5000, debt: 4000, health: 1.25 };
const OMV_START = { collateral: 5000, debt: 5000 };

function WrappedSimulatePage() {
  const [crashed, setCrashed] = useState(false);

  // Traditional state
  const [trad, setTrad] = useState(TRAD_START);
  const liquidated = trad.health <= 0.95 && crashed;

  // Omniverse state
  const [omv, setOmv] = useState(OMV_START);
  const settled = omv.collateral === 0 && omv.debt === 0 && crashed;

  // Drain loops
  useEffect(() => {
    if (!crashed) return;
    const id = setInterval(() => {
      setTrad((s) => {
        const collateral = Math.max(0, s.collateral - 80);
        const debt = s.debt + 14;
        const health = collateral / debt;
        return { collateral, debt, health };
      });
      setOmv((s) => ({
        collateral: Math.max(0, s.collateral - 420),
        debt: Math.max(0, s.debt - 210),
      }));
    }, 60);
    return () => clearInterval(id);
  }, [crashed]);

  const reset = () => {
    setCrashed(false);
    setTrad(TRAD_START);
    setOmv(OMV_START);
  };

  const tradHealthPct = Math.min(100, Math.max(0, (trad.health / 2) * 100));
  const tradHealthColor =
    trad.health > 1.1
      ? "bg-emerald-500"
      : trad.health > 1.0
      ? "bg-amber-500"
      : "bg-red-500";

  const omvNetPct = Math.min(
    100,
    Math.max(0, ((omv.collateral - omv.debt + 5000) / 10000) * 100)
  );

  return (
    <div className="w-full min-h-screen bg-[#08080A] text-[#F3F4F6] relative">
      <div
        className="fixed inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: "url(/noise.svg)" }}
      />

      <div className="max-w-[1200px] mx-auto w-full flex flex-col gap-8 px-6 pt-12 pb-24 relative">
        {/* Header */}
        <header>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#8B8D98] mb-4">
            Omniverse · Crash Test
          </div>
          <h1 className="text-6xl tracking-[-0.04em] leading-[1.05]">
            <span className="text-[#F3F4F6] font-medium">two systems. </span>
            <span
              className="italic text-[#8B8D98]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              one crash.
            </span>
          </h1>
          <p className="text-[#8B8D98] text-sm leading-relaxed max-w-2xl mt-4">
            Pressure-test a traditional lending position against a
            probability-bounded Omniverse position. Same shock. Two
            mathematically opposite outcomes.
          </p>
        </header>

        {/* Warning banner */}
        <div className="bg-amber-500/[0.04] border border-amber-500/20 rounded-xl p-4 flex items-start gap-4 backdrop-blur-md">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-amber-500 text-xs font-bold tracking-widest uppercase">
              Simulation Environment
            </div>
            <p className="text-amber-500/70 text-sm mt-1">
              All values are illustrative. The crash trigger emulates a sharp
              underlying decline to demonstrate liquidation physics versus
              symmetric cancellation.
            </p>
          </div>
        </div>

        {/* Dual panel arena */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TRADITIONAL */}
          <div className="flex flex-col bg-[#0E0E11] border border-white/5 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] relative overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-white/5">
              <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
                Traditional Lending
              </span>
              <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
                Aave · V3
              </span>
            </div>

            <div className="p-6 relative">
              <h2 className="text-2xl text-[#F3F4F6] tracking-tight mb-8">
                {liquidated
                  ? "forced exit, capital impaired."
                  : crashed
                  ? "collateral bleeding, health degrading."
                  : "position open, health nominal."}
              </h2>

              <Row
                label="Collateral"
                value={`${fmtUSD(trad.collateral)}`}
                unit="eth"
                danger={liquidated}
              />
              <Row
                label="Debt"
                value={`${fmtUSD(trad.debt)}`}
                unit="usdc"
                danger={liquidated}
              />

              <div className="py-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-[#8B8D98] uppercase tracking-widest">
                    Health Factor
                  </span>
                  <span
                    className={`text-lg font-mono ${
                      liquidated
                        ? "text-red-500"
                        : trad.health < 1.1
                        ? "text-amber-400"
                        : "text-[#F3F4F6]"
                    }`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {trad.health.toFixed(3)}
                  </span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${tradHealthColor}`}
                    style={{ width: `${tradHealthPct}%` }}
                  />
                </div>
              </div>

              <AnimatePresence>
                {liquidated && (
                  <motion.div
                    initial={{ scale: 2, opacity: 0, rotate: -12 }}
                    animate={{ scale: 1, opacity: 1, rotate: -12 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 18 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div className="border-4 border-red-500 text-red-500 font-bold text-4xl tracking-widest uppercase px-6 py-3 backdrop-blur-sm bg-red-500/5">
                      Liquidated
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-3 bg-white/[0.01] border-t border-white/5">
              <MicroCell label="Liq. Penalty" value="5.00%" />
              <MicroCell label="Gas Spent" value="$142" border />
              <MicroCell label="Slippage" value="3.40%" />
            </div>
          </div>

          {/* OMNIVERSE */}
          <motion.div
            animate={
              settled
                ? { boxShadow: "inset 0 0 40px rgba(16,185,129,0.18)" }
                : { boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.02)" }
            }
            transition={{ duration: 0.8 }}
            className="flex flex-col bg-[#0E0E11] border border-white/5 rounded-2xl relative overflow-hidden"
          >
            <div className="flex justify-between items-center p-5 border-b border-white/5">
              <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
                Omniverse
              </span>
              <span className="text-[10px] text-emerald-400 uppercase tracking-widest">
                Probability-Bounded
              </span>
            </div>

            <div className="p-6">
              <h2 className="text-2xl text-[#F3F4F6] tracking-tight mb-8">
                {settled
                  ? "symmetric cancellation, position resolved."
                  : crashed
                  ? "legs unwinding, exposure decaying."
                  : "position open, legs symmetric."}
              </h2>

              <Row
                label="Collateral"
                value={`${fmtUSD(omv.collateral)}`}
                unit="yes-usdc"
              />
              <Row
                label="Debt"
                value={`${fmtUSD(omv.debt)}`}
                unit="no-usdc"
              />

              <div className="py-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-[#8B8D98] uppercase tracking-widest">
                    Net Exposure
                  </span>
                  <span
                    className={`text-lg font-mono ${
                      settled ? "text-emerald-400" : "text-[#F3F4F6]"
                    }`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {settled
                      ? "SYMMETRIC CANCELLATION"
                      : fmtUSD(omv.collateral - omv.debt)}
                  </span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-150"
                    style={{ width: `${omvNetPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 bg-white/[0.01] border-t border-white/5">
              <MicroCell label="Liq. Penalty" value="0.00%" emerald />
              <MicroCell label="Gas Spent" value="$8" border />
              <MicroCell label="Slippage" value="0.04%" emerald />
            </div>
          </motion.div>
        </div>

        {/* Trigger console */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between p-4 pl-6 bg-[#0E0E11] border border-white/5 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          <div className="text-sm font-mono text-[#8B8D98] flex flex-wrap items-center gap-2">
            Trigger:
            <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-white text-xs">
              [ btc settles below 100k ]
            </span>
            <span className="text-white/40">→</span>
            <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-white text-xs">
              [ outcome resolves to no ]
            </span>
          </div>

          <div className="flex items-center gap-4">
            <AnimatePresence>
              {(liquidated || settled) && (
                <motion.button
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={reset}
                  className="text-[10px] text-[#8B8D98] hover:text-white uppercase tracking-widest underline underline-offset-4"
                >
                  Reset Simulation
                </motion.button>
              )}
            </AnimatePresence>

            <button
              onClick={() => setCrashed(true)}
              disabled={crashed}
              className={
                crashed
                  ? "px-8 py-4 rounded-xl font-medium tracking-widest text-xs uppercase bg-white/5 border border-white/10 text-white/40 outline-none cursor-not-allowed"
                  : "px-8 py-4 rounded-xl font-medium tracking-widest text-xs uppercase bg-red-500/10 border border-red-500/40 text-red-500 transition-all hover:bg-red-500/20 hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] outline-none"
              }
            >
              {crashed ? "Event Triggered" : "Trigger Crash"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  unit,
  danger = false,
}: {
  label: string;
  value: string;
  unit: string;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-4 border-b border-white/5">
      <span className="text-[11px] text-[#8B8D98] uppercase tracking-widest">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-lg font-mono transition-colors ${
            danger ? "text-red-500" : "text-[#F3F4F6]"
          }`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </span>
        <span className="text-[10px] text-[#8B8D98] uppercase tracking-wider">
          {unit}
        </span>
      </div>
    </div>
  );
}

function MicroCell({
  label,
  value,
  border = false,
  emerald = false,
}: {
  label: string;
  value: string;
  border?: boolean;
  emerald?: boolean;
}) {
  return (
    <div
      className={`p-5 flex flex-col gap-1 ${
        border ? "border-x border-white/5" : ""
      }`}
    >
      <span className="text-[9px] text-[#8B8D98] uppercase tracking-widest">
        {label}
      </span>
      <span
        className={`text-sm font-mono ${emerald ? "text-emerald-400" : "text-white"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}

/* Old route export - replaced with redirect above
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
  component: () => (<div className="relative min-h-screen w-full overflow-x-hidden bg-[#0A0A0B]"><div className="border-b border-white/[0.05]"><Nav appMode /></div><WrappedSimulatePage /></div>),
});
*/
