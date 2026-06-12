import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { Nav } from "@/components/marketing/Nav";
import { useDemoManifest } from "@/hooks/useDemoManifest";
import { usePoolPrice, usePoolReserves } from "@/hooks/useLiveDemoReads";
import { useDemoTrades } from "@/hooks/useDemoTrades";
import { assembleDashboardData } from "@/lib/dashboardData";
import { WCurveLive } from "@/components/w-curve-live";
import { AttackTranscript } from "@/components/attack-transcript";
import { LpShieldPanel } from "@/components/lp-shield-panel";
import { ParametricMesh } from "@/components/parametric-mesh";
import { MacroDashboard } from "@/components/macro-dashboard";
import { PageHeader } from "@/components/page-header";
import { DashboardGrid } from "@/components/dashboard-grid";
import { DepthChartPanel } from "@/components/depth-chart-panel";
import { ActivityPanel } from "@/components/activity-panel";

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
// Simulated live data — keeps the dashboard alive regardless of indexer state.
// ─────────────────────────────────────────────────────────────────────────────

const SIDES = ["YES", "NO"] as const;
const SAMPLE_TRADERS = [
  "0x4b…3f9",
  "0xa1…c70",
  "0x7c…d12",
  "0x9e…b88",
  "0x3d…041",
  "0xff…aa2",
  "0x21…e5b",
];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function useSimulatedFeed() {
  const [trades, setTrades] = useState<any[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: String(Date.now() - i * 9000),
      txHash: "0xsimulated" + i,
      blockNumber: String(248194021 - i * 12),
      side: Math.round(Math.random()),
      sideLabel: Math.random() > 0.5 ? "YES" : "NO",
      size: String(rand(120, 4800) * 1e18),
      priceAfter: String(rand(0.18, 0.86) * 1e16),
      trader: SAMPLE_TRADERS[Math.floor(Math.random() * SAMPLE_TRADERS.length)],
      timestamp: String(Date.now() - i * 9000),
      saved: rand(2, 180)
    })),
  );
  const [price, setPrice] = useState(0.62);
  const [savedTotal, setSavedTotal] = useState(2_481_392);
  const [shielded, setShielded] = useState(0.964);

  useEffect(() => {
    const tradeInterval = setInterval(() => {
      const t = {
        id: String(Date.now()),
        txHash: "0xsimulated" + Date.now(),
        blockNumber: String(248194021 + Math.floor(Math.random() * 100)),
        side: Math.round(Math.random()),
        sideLabel: Math.random() > 0.5 ? "YES" : "NO",
        size: String(rand(80, 5800) * 1e18),
        priceAfter: String(Math.max(0.02, Math.min(0.98, price + rand(-0.04, 0.04))) * 1e16),
        trader: SAMPLE_TRADERS[Math.floor(Math.random() * SAMPLE_TRADERS.length)],
        timestamp: String(Date.now()),
        saved: rand(1.2, 240)
      };
      setTrades((prev) => [t, ...prev].slice(0, 14));
      setPrice(Number(t.priceAfter) / 1e16);
      setSavedTotal((s) => s + t.saved);
      setShielded((s) => Math.max(0.9, Math.min(0.998, s + rand(-0.002, 0.0025))));
    }, 1800);
    return () => clearInterval(tradeInterval);
  }, [price]);

  return { trades, price, savedTotal, shielded };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

function DemoPage() {
  // ── Live data hooks ──────────────────────────────────────────────────────
  const { data: manifest } = useDemoManifest();
  const { price: livePrice, source: priceSource } = usePoolPrice(manifest?.poolWeth);
  const { reserves, source: reserveSource } = usePoolReserves(manifest?.poolWeth);
  const { trades, isLoading: tradesLoading, source: tradesSource, refetch: refetchTrades } = useDemoTrades(manifest?.conditionId, "WETH");

  const dashboard = manifest
    ? assembleDashboardData(manifest, livePrice, reserves, trades)
    : null;

  // Fall back to simulated feed for panels that haven't been replaced yet
  const { trades: simTrades, price: simPrice, savedTotal, shielded } = useSimulatedFeed();
  const liveYes = dashboard ? dashboard.priceFloat : simPrice;

  return (
    <div className="min-h-screen flex flex-col bg-[#08080A] text-[#F3F4F6] relative overflow-x-hidden font-sans antialiased">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      <Nav appMode />

      <main className="w-full max-w-[1600px] mx-auto px-6 py-8 flex flex-col gap-6 flex-1">
        <PageHeader
          title="Market Overview"
          subtitle="Solver-routed execution telemetry across the Omniverse depth array."
          blockNumber="248,194,021"
          live={true}
        />

        <MacroDashboard 
          savedTotal={savedTotal}
          shielded={manifest && dashboard?.passivePct !== undefined ? dashboard.passivePct / 100 : shielded}
          lambdaWad={manifest ? dashboard?.lambdaWad : undefined}
          price={liveYes}
        />

        <DashboardGrid
          chart={
            <DepthChartPanel
              price={liveYes}
              lambdaWad={manifest ? dashboard?.lambdaWad : undefined}
              source={manifest ? priceSource : "unavailable"}
            >
              <WCurveLive
                price={liveYes}
                lambdaWad={manifest ? dashboard?.lambdaWad : undefined}
                source={manifest ? priceSource : "unavailable"}
              />
            </DepthChartPanel>
          }
          activity={
            <ActivityPanel
              trades={manifest ? (dashboard?.attackTrades || []) : simTrades}
              isLoading={manifest ? tradesLoading : false}
              source={manifest ? tradesSource : "simulated"}
            />
          }
        />
      </main>

      <div
        className="fixed inset-0 opacity-[0.025] mix-blend-overlay pointer-events-none z-[9999]"
        style={{ backgroundImage: "url('/noise.svg')" }}
      />
    </div>
  );
}

