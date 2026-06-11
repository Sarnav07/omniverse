import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { PresentModeContext } from "./__root";
import { WalletButton } from "@/components/wallet-button";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useReadContract,
  useChainId,
} from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import MultiverseLendingAbi from "@/abis/MultiverseLending.abi.json";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { toast } from "sonner";
import { useQuery } from "urql";
import { parseUnits } from "viem";
import OmniverseRouterAbi from "@/abis/OmniverseRouter.abi.json";
import ConditionalTokensAbi from "@/abis/ConditionalTokens.abi.json";
import Erc20Abi from "@/abis/ERC20.abi.json";
import PmAmmPoolAbi from "@/abis/PmAmmPool.abi.json";
import { DataSourceBadge } from "@/components/data-source-badge";
import { useDemoManifest } from "@/hooks/useDemoManifest";
import { useDemoMarket, useDemoTrades } from "@/hooks/useDemoIndexer";
import { AttackPresets } from "@/components/attack-presets";
import { PreDemoReadinessPanel } from "@/components/pre-demo-readiness-panel";
import { BorrowDemoTab } from "@/components/borrow-demo-tab";
import {
  useLiveBlockNumber,
  useMathKernelStatus,
  usePoolLiquidity,
  usePoolPrice,
  usePoolReserves,
} from "@/hooks/useLiveDemoReads";
import {
  arbiscanTxUrl,
  formatAddress,
  formatBlockNumber,
  formatCompactToken,
  formatProbability,
  formatWad,
} from "@/lib/formatters";
const MARKET_BY_ID_QUERY = `
  query MarketById($id: String!) {
    market(id: $id) {
      id
      questionId
      question
      symbol
      category
      poolWeth
      poolUsdc
      lastPriceWeth
      totalVolumeWeth
      totalVolumeUsdc
      resolved
      createdAt
    }
  }
`;

export const Route = createFileRoute("/markets/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Execution Terminal · Omniverse` },
      {
        name: "description",
        content:
          "Institutional execution terminal. Drop intent, route through the solver mesh, settle without forced exits.",
      },
      { property: "og:title", content: `${params.id} — Execution Terminal` },
      {
        property: "og:description",
        content: "Drag capital. Drop intent. Settle without typing a digit.",
      },
    ],
  }),
  component: TerminalPage,
});

function TerminalPage() {
  const { id } = Route.useParams();
  const presentMode = useContext(PresentModeContext);
  type TerminalTab = "swap" | "borrow" | "manage" | "provide" | "redeem";
  const [tab, setTab] = useState<TerminalTab>("borrow");
  const { data: manifest } = useDemoManifest();
  const { data: blockNumber } = useLiveBlockNumber();

  // Estimate RPC latency from block update cadence
  const lastBlockTimeRef = useRef<number>(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  useEffect(() => {
    if (!blockNumber) return;
    const now = Date.now();
    if (lastBlockTimeRef.current > 0) {
      const delta = now - lastBlockTimeRef.current;
      // Smooth: blend previous with new
      setLatencyMs((prev) => (prev ? Math.round(prev * 0.6 + delta * 0.4) : delta));
    }
    lastBlockTimeRef.current = now;
  }, [blockNumber]);

  const [result] = useQuery({
    query: MARKET_BY_ID_QUERY,
    variables: { id },
  });
  const { data, fetching } = result;

  const MARKET = useMemo(() => {
    const item = data?.market;
    if (!item)
      return {
        poolWeth: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        poolUsdc: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        lending: CONTRACT_ADDRESSES.MultiverseLending as `0x${string}`,
        symbol: manifest?.symbol ?? "...",
        question: manifest?.question ?? "Loading...",
        category: "prediction",
        yes: 0.5,
        tvl: "$0.00",
        volume24: "$0.00",
        expiry: "...",
      };
    const yesPrice = Number(item.lastPriceWeth) / 1e18;
    const volWeth = Number(item.totalVolumeWeth) / 1e18;
    const volUsdc = Number(item.totalVolumeUsdc) / 1e18;
    const vol = volWeth + volUsdc;
    return {
      poolWeth: (item.poolWeth ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      poolUsdc: (item.poolUsdc ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      lending: (item.lending ?? CONTRACT_ADDRESSES.MultiverseLending) as `0x${string}`,
      lastPriceWeth: item.lastPriceWeth,
      symbol: item.symbol,
      question: item.question ?? manifest?.question ?? "Loading...",
      category: item.category ?? "prediction",
      yes: yesPrice > 0 ? yesPrice : 0.5,
      tvl: "---",
      volume24: vol > 0 ? `$${vol.toFixed(1)}` : "$0.00",
      expiry: "2026·12·31",
    };
  }, [data, manifest]);

  const isDemoMarket =
    !!manifest &&
    (id.toLowerCase() === manifest.conditionId.toLowerCase() ||
      MARKET.poolWeth.toLowerCase() === manifest.poolWeth.toLowerCase() ||
      MARKET.poolUsdc.toLowerCase() === manifest.poolUsdc.toLowerCase());
  const demoConditionId = isDemoMarket ? manifest?.conditionId : id;
  const livePool = isDemoMarket ? manifest?.poolWeth : MARKET.poolWeth;
  const { market: indexedDemoMarket, isLoading: demoMarketLoading } = useDemoMarket(
    isDemoMarket ? manifest?.conditionId : undefined,
  );
  const { price: livePrice } = usePoolPrice(livePool);
  const { reserves } = usePoolReserves(livePool);
  const { liquidity } = usePoolLiquidity(livePool);
  const mathStatus = useMathKernelStatus(livePool, manifest?.math);
  const { trades: demoTrades } = useDemoTrades(
    isDemoMarket ? manifest?.conditionId : undefined,
    "WETH",
  );
  const { data: expiryWad } = useReadContract({
    address: livePool ?? "0x0000000000000000000000000000000000000000",
    abi: PmAmmPoolAbi,
    functionName: "T",
    query: { enabled: !!livePool, refetchInterval: 5_000 },
  });

  const liveYes = livePrice ? Number(livePrice) / 1e18 : MARKET.yes;
  const activeReserves = reserves ? reserves.xActive + reserves.yActive : 0n;
  const totalReserves = reserves
    ? reserves.xActive + reserves.xPassive + reserves.yActive + reserves.yPassive
    : 0n;
  const activePct =
    totalReserves > 0n ? (Number(activeReserves) / Number(totalReserves)) * 100 : undefined;
  const passivePct = activePct === undefined ? undefined : 100 - activePct;
  const tvlLabel = totalReserves > 0n ? formatCompactToken(totalReserves, "pos") : MARKET.tvl;
  const expiryLabel =
    typeof expiryWad === "bigint"
      ? new Date(Number(expiryWad) * 1000).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Unavailable";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-abyss text-foreground">
      <div className="noise-overlay" />

      {/* TOP BAR (40px) */}
      <header className="relative z-20 flex h-10 items-center justify-between border-b border-white/[0.06] px-6">
        <div className="flex items-center gap-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-5 w-5 place-items-center rounded-sm border border-white/15 bg-white/[0.02]">
              <div className="h-1 w-1 rounded-full bg-white" />
            </div>
            <span className="text-[12px] tracking-tight text-white/90">omniverse</span>
          </Link>
          <div className="h-3 w-px bg-white/10" />
          <Link
            to="/markets"
            className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45 ease-precision hover:text-white"
          >
            ← markets
          </Link>
          <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/30">
            / {id}
          </span>
        </div>
        <div className="flex items-center gap-5 tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
          <span>
            latency ·{" "}
            <span className={latencyMs ? "text-white/75" : "text-white/45"}>
              {latencyMs ? `${latencyMs}ms` : blockNumber ? "< 1s" : "..."}
            </span>
          </span>
          <span>block · {formatBlockNumber(blockNumber)}</span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            live
          </span>
          <div className="h-3 w-px bg-white/10" />
          <WalletButton />
        </div>
      </header>

      {/* MARKET HEADER STRIP (64px) */}
      <section className="relative z-10 flex h-16 items-center justify-between border-b border-white/[0.06] px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-sm border border-white/15 bg-white/[0.02]">
              <span className="h-1 w-1 rounded-full bg-white/80" />
            </span>
            <span className="tabular text-[11px] uppercase tracking-[0.22em] text-white/65">
              {MARKET.symbol}
            </span>
          </div>
          <h1 className="text-[15px] font-light tracking-[-0.01em] text-white/90">
            {MARKET.question}
          </h1>
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 tabular text-[9px] uppercase tracking-[0.22em] text-white/45">
            {MARKET.category}
          </span>
        </div>
        <div className="flex items-center gap-7">
          <StripStat label="yes" value={liveYes.toFixed(2)} accent />
          <StripStat label="no" value={(1 - liveYes).toFixed(2)} />
          <StripStat label="tvl" value={tvlLabel} />
          <StripStat label="24h vol" value={MARKET.volume24} />
          <StripStat label="expiry" value={expiryLabel} />
          {!presentMode && <DataSourceBadge source={livePrice ? "live" : "indexed"} />}
        </div>
      </section>

      {isDemoMarket && (
        <AttackModeStrip
          conditionId={demoConditionId}
          pool={livePool}
          price={livePrice}
          reserves={reserves}
          liquidity={liquidity}
          mathLabel={mathStatus.label}
          mathMatches={mathStatus.matches}
          indexed={!!indexedDemoMarket}
          indexerLoading={demoMarketLoading}
          latestTx={demoTrades[0]?.txHash}
        />
      )}

      {/* DUAL PANE */}
      <main
        className="relative z-10 grid grid-cols-[1.857fr_1fr]"
        style={{ height: `calc(100vh - ${isDemoMarket ? 168 : 104}px)` }}
      >
        {/* LEFT — Intent Engine */}
        <section className="relative flex flex-col border-r border-white/[0.06]">
          {/* tab strip */}
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-6 py-4">
            <span className="shrink-0 tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
              / 03 · intent engine
            </span>
            <div className="relative flex overflow-x-auto rounded-full border border-white/10 bg-white/[0.015] p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(["swap", "borrow", "manage", "provide", "redeem"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="relative z-10 shrink-0 rounded-full px-3 py-1.5 tabular text-[10px] uppercase tracking-[0.2em]"
                >
                  {tab === t && (
                    <motion.span
                      layoutId="seg-pill"
                      className="absolute inset-0 rounded-full bg-white/[0.06]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={`relative ${tab === t ? "text-white" : "text-white/45"}`}>
                    {t}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {tab === "swap" && (
            <div className="flex-1 overflow-y-auto">
              {isDemoMarket && (
                <div className="border-b border-white/[0.06] bg-black/20 p-6">
                  <PreDemoReadinessPanel manifest={manifest} pool={livePool} />
                </div>
              )}
              {isDemoMarket ? (
                <div className="p-6">
                  <AttackPresets
                    pool={livePool!}
                    conditionId={manifest?.conditionId!}
                    yesPrice={liveYes}
                    router={manifest?.router}
                    onConfirmed={() => {
                      // no-op refetch hook
                    }}
                  />
                </div>
              ) : (
                <SwapTab
                  poolWeth={MARKET.poolWeth}
                  poolUsdc={MARKET.poolUsdc}
                  yesPrice={liveYes}
                />
              )}
            </div>
          )}
          {tab === "borrow" && (
            <div className="flex-1 overflow-y-auto p-6">
              {isDemoMarket && manifest ? (
                <BorrowDemoTab manifest={manifest} />
              ) : (
                <IntentEngine
                  mode="execute"
                  poolWeth={MARKET.poolWeth}
                  poolUsdc={MARKET.poolUsdc}
                  lending={MARKET.lending}
                />
              )}
            </div>
          )}
          {tab === "manage" && <ManageTab lending={MARKET.lending} />}
          {tab === "provide" && (
            <IntentEngine
              mode="provide"
              poolWeth={MARKET.poolWeth}
              poolUsdc={MARKET.poolUsdc}
              lending={MARKET.lending}
            />
          )}
          {tab === "redeem" && <RedeemTab />}
        </section>

        {/* RIGHT — Probability Canvas */}
        <section className="relative">
          <ProbabilityCanvas mu={liveYes} />
        </section>
      </main>
    </div>
  );
}

/* ─────────────────────────── strip stat ─────────────────────────── */

function StripStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span className="tabular text-[9px] uppercase tracking-[0.24em] text-white/35">{label}</span>
      <span
        className={`tabular text-[14px] font-light ${accent ? "text-white" : "text-white/95"}`}
        style={accent ? { textShadow: "0 0 14px rgba(255,255,255,0.35)" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function AttackModeStrip({
  conditionId,
  pool,
  price,
  reserves,
  liquidity,
  mathLabel,
  mathMatches,
  indexed,
  indexerLoading,
  latestTx,
}: {
  conditionId?: string;
  pool?: string;
  price?: bigint;
  reserves?: {
    xActive: bigint;
    xPassive: bigint;
    yActive: bigint;
    yPassive: bigint;
    ellActive: bigint;
    lambdaWad: bigint;
    lT: bigint;
  };
  liquidity?: bigint;
  mathLabel: string;
  mathMatches: boolean;
  indexed: boolean;
  indexerLoading: boolean;
  latestTx?: string;
}) {
  const active = reserves ? reserves.xActive + reserves.yActive : 0n;
  const total = reserves
    ? reserves.xActive + reserves.xPassive + reserves.yActive + reserves.yPassive
    : 0n;
  const activePct = total > 0n ? (Number(active) / Number(total)) * 100 : 0;
  const passivePct = total > 0n ? 100 - activePct : 0;

  return (
    <section className="relative z-10 border-b border-white/[0.06] bg-white/[0.012] px-6 py-3">
      <div className="flex items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 tabular text-[10px] uppercase tracking-[0.24em] text-white">
            attack mode
          </span>
          <DataSourceBadge source="live" />
          <DataSourceBadge
            source={indexed ? "indexed" : indexerLoading ? "unavailable" : "unavailable"}
          />
          <span className="tabular text-[10px] uppercase tracking-[0.2em] text-white/35">
            condition · {formatAddress(conditionId, 8, 6)}
          </span>
        </div>
        <div className="flex items-center gap-5">
          <AttackMetric label="p(yes)" value={price ? formatProbability(price) : "—"} source="live" />
          <AttackMetric label="λ" value={reserves ? formatWad(reserves.lambdaWad, 3) : "—"} source="live" />
          <AttackMetric label="active" value={total > 0n ? `${activePct.toFixed(1)}%` : "—"} source="computed" />
          <AttackMetric label="shielded" value={total > 0n ? `${passivePct.toFixed(1)}%` : "—"} source="computed" />
          <AttackMetric
            label="ell"
            value={reserves ? formatCompactToken(reserves.ellActive) : "—"}
            source="live"
          />
          <AttackMetric label="L_t" value={formatCompactToken(liquidity ?? reserves?.lT)} source="live" />
          <AttackMetric label="math" value={mathLabel} accent={mathMatches} source="live" />
          <a
            href={pool ? `https://sepolia.arbiscan.io/address/${pool}` : undefined}
            target="_blank"
            rel="noreferrer"
            className="tabular text-[10px] uppercase tracking-[0.18em] text-white/45 hover:text-white"
          >
            pool · {formatAddress(pool)}
          </a>
          {latestTx && (
            <a
              href={arbiscanTxUrl(latestTx)}
              target="_blank"
              rel="noreferrer"
              className="tabular text-[10px] uppercase tracking-[0.18em] text-white/45 hover:text-white"
            >
              latest tx ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function AttackMetric({
  label,
  value,
  accent,
  source,
}: {
  label: string;
  value: string;
  accent?: boolean;
  source?: "live" | "indexed" | "manifest" | "computed" | "simulated" | "unavailable";
}) {
  const presentMode = useContext(PresentModeContext);
  return (
    <div className="flex flex-col items-end">
      <span className="tabular text-[8px] uppercase tracking-[0.2em] text-white/30">{label}</span>
      <span className={`tabular text-[11px] ${accent ? "text-white" : "text-white/75"}`}>
        {value}
      </span>
      {!presentMode && source && <DataSourceBadge source={source} />}
    </div>
  );
}

/* ─────────────────────── probability canvas ─────────────────────── */

function ProbabilityCanvas({ mu }: { mu: number }) {
  const W = 1000;
  const H = 600;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{
    x: number;
    p: number;
    depth: number;
    lambda: number;
  } | null>(null);

  // Build a gaussian-ish curve centered roughly at mu
  const { path, fill } = useMemo(() => {
    const sigma = 0.14;
    const peakY = 80; // top padding for peak
    const baseY = H - 60;
    const pts: { x: number; y: number; p: number }[] = [];
    for (let i = 0; i <= 200; i++) {
      const p = i / 200; // probability 0..1
      const x = 40 + (W - 80) * p;
      const g = Math.exp(-Math.pow(p - mu, 2) / (2 * sigma * sigma));
      const y = baseY - g * (baseY - peakY);
      pts.push({ x, y, p });
    }
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const cx = (a.x + b.x) / 2;
      d += ` Q ${cx} ${a.y}, ${b.x} ${b.y}`;
    }
    const f = `${d} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`;
    return { path: d, fill: f };
  }, [mu]);

  const muX = 40 + (W - 80) * mu;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xRel = (e.clientX - rect.left) / rect.width;
    const xSvg = xRel * W;
    const p = Math.max(0, Math.min(1, (xSvg - 40) / (W - 80)));
    const sigma = 0.14;
    const g = Math.exp(-Math.pow(p - mu, 2) / (2 * sigma * sigma));
    setHover({
      x: xSvg,
      p,
      depth: Math.round(g * 24_800_000 + 480_000),
      lambda: 0.42 + g * 0.36,
    });
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* corner labels */}
      <div className="pointer-events-none absolute left-6 top-5 z-10">
        <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
          / 02 · probability canvas
        </span>
        <div className="mt-1.5 font-display text-[28px] font-light leading-none tracking-[-0.02em] text-white/85">
          P<sub className="text-[11px] text-white/40">true</sub> · gaussian band
        </div>
      </div>

      <div className="pointer-events-none absolute right-6 top-5 z-10 flex items-center gap-3 tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
        <span>σ · 0.14</span>
        <span>μ · {mu.toFixed(2)}</span>
        <span className="text-white">depth · live</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="gauss-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="gauss-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.85)" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line
          x1="40"
          y1={H - 60}
          x2={W - 40}
          y2={H - 60}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />

        {/* probability ticks (0, .25, .5, .75, 1) */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const x = 40 + (W - 80) * p;
          return (
            <g key={p}>
              <line
                x1={x}
                y1={H - 60}
                x2={x}
                y2={H - 54}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
              />
              <text
                x={x}
                y={H - 38}
                textAnchor="middle"
                fontSize="11"
                fill="rgba(255,255,255,0.35)"
                fontFamily="Geist Mono, monospace"
                letterSpacing="0.16em"
              >
                {p.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* fill */}
        <path d={fill} fill="url(#gauss-fill)" />
        {/* line */}
        <path d={path} stroke="url(#gauss-stroke)" strokeWidth="1.25" fill="none" />

        {/* μ vertical line */}
        <line
          x1={muX}
          y1="80"
          x2={muX}
          y2={H - 60}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
        <text
          x={muX + 8}
          y={92}
          fontSize="10"
          fill="rgba(255,255,255,0.55)"
          fontFamily="Geist Mono, monospace"
          letterSpacing="0.16em"
        >
          μ · {mu.toFixed(2)}
        </text>

        {/* crosshair */}
        {hover && (
          <g pointerEvents="none">
            <line
              x1={hover.x}
              y1="40"
              x2={hover.x}
              y2={H - 60}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1"
            />
            {/* connector */}
            <line
              x1={hover.x}
              y1={H / 2 - 40}
              x2={Math.min(hover.x + 120, W - 220)}
              y2={H / 2 - 110}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.75"
            />
          </g>
        )}
      </svg>

      {/* frosted tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 omni-glass-heavy rounded-lg px-4 py-3"
          style={{
            left: `min(${(Math.min(hover.x + 120, W - 220) / W) * 100}%, calc(100% - 220px))`,
            top: `${((600 / 2 - 130) / 600) * 100}%`,
            width: 200,
          }}
        >
          <div className="tabular text-[9px] uppercase tracking-[0.24em] text-white/40">
            probability
          </div>
          <div className="tabular mt-0.5 text-[18px] font-light text-white">
            {hover.p.toFixed(3)}
          </div>
          <div className="mt-2 border-t border-white/5 pt-2">
            <div className="flex items-center justify-between">
              <span className="tabular text-[9px] uppercase tracking-[0.24em] text-white/40">
                liquidity depth
              </span>
              <span className="tabular text-[11px] text-white/85">
                ${(hover.depth / 1_000_000).toFixed(2)}m
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="tabular text-[9px] uppercase tracking-[0.24em] text-white/40">
                λ* activeness
              </span>
              <span
                className="tabular text-[11px] text-white"
                style={{ textShadow: "0 0 10px rgba(255,255,255,0.35)" }}
              >
                {hover.lambda.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── intent engine ───────────────────────── */

function IntentEngine({
  mode,
  poolWeth,
  poolUsdc,
  lending,
}: {
  mode: "provide" | "execute";
  poolWeth: `0x${string}`;
  poolUsdc: `0x${string}`;
  lending: `0x${string}`;
}) {
  const { id } = Route.useParams();
  const { address: user } = useAccount();

  const [collateral, setCollateral] = useState("1000");
  const [borrow, setBorrow] = useState("500");
  const [sideYes, setSideYes] = useState(true);

  const isProvide = mode === "provide";

  // Same-leg validation: ratio must stay ≤ 0.85
  const c = parseFloat(collateral) || 0;
  const b = parseFloat(borrow) || 0;
  const valid = isProvide ? c > 0 : c > 0 && b > 0;
  const ratio = c > 0 ? b / c : 0;
  const tokenToApprove = isProvide ? CONTRACT_ADDRESSES.USDC : CONTRACT_ADDRESSES.WETH;
  const amountToApprove = parseUnits(c.toString(), 18);

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: tokenToApprove,
    abi: Erc20Abi,
    functionName: "allowance",
    args: [user as `0x${string}`, CONTRACT_ADDRESSES.OmniverseRouter],
    query: { enabled: !!user },
  });

  const needsApproval = (allowance as bigint) < amountToApprove;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApproving,
  } = useWriteContract();
  const { isLoading: isConfirmingApprove, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const signing = isPending || isConfirming || isApproving || isConfirmingApprove;

  useEffect(() => {
    if (isApproveSuccess) refetchAllowance();
  }, [isApproveSuccess, refetchAllowance]);

  useEffect(() => {
    if (isPending || isApproving) toast.loading("Waiting for wallet...", { id: "tx-intent" });
    else if (isConfirming || isConfirmingApprove)
      toast.loading("Transaction submitted...", { id: "tx-intent" });
    else if (isSuccess || isApproveSuccess)
      toast.success("Transaction confirmed", { id: "tx-intent" });
  }, [isPending, isConfirming, isSuccess, isApproving, isConfirmingApprove]);

  function onSign() {
    if (!valid || signing || !c) return;

    if (needsApproval) {
      writeApprove(
        {
          address: tokenToApprove,
          abi: Erc20Abi,
          functionName: "approve",
          args: [CONTRACT_ADDRESSES.OmniverseRouter, amountToApprove],
        },
        { onError: (err) => toast.error(err.message, { id: "tx-intent" }) },
      );
      return;
    }

    if (isProvide) {
      writeContract(
        {
          address: CONTRACT_ADDRESSES.OmniverseRouter,
          abi: OmniverseRouterAbi,
          functionName: "addLiquidity",
          args: [
            poolUsdc,
            id,
            parseUnits(c.toString(), 18),
            0n, // Set minShares to 0 to allow adding liquidity to imbalanced pools without reverting
          ],
        },
        { onError: (err) => toast.error(err.message, { id: "tx-intent" }) },
      );
    } else {
      writeContract(
        {
          address: CONTRACT_ADDRESSES.OmniverseRouter,
          abi: OmniverseRouterAbi,
          functionName: "executeBorrow",
          args: [lending, id, parseUnits(c.toString(), 18), parseUnits(b.toString(), 18)],
        },
        { onError: (err) => toast.error(err.message, { id: "tx-intent" }) },
      );
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* side toggle */}
      <div className="grid grid-cols-2 border-b border-white/[0.06]">
        <button
          onClick={() => setSideYes(true)}
          className={`relative flex items-center justify-between px-6 py-4 ease-precision ${
            sideYes ? "bg-white/[0.02]" : "hover:bg-white/[0.015]"
          }`}
        >
          <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
            side
          </span>
          <span
            className={`tabular text-[14px] ${sideYes ? "text-white" : "text-white/40"}`}
            style={sideYes ? { textShadow: "0 0 12px rgba(255,255,255,0.35)" } : undefined}
          >
            yes · 0.84
          </span>
          {sideYes && <span className="absolute inset-x-0 bottom-0 h-px bg-white/60" />}
        </button>
        <button
          onClick={() => setSideYes(false)}
          className={`relative flex items-center justify-between border-l border-white/[0.06] px-6 py-4 ease-precision ${
            !sideYes ? "bg-white/[0.02]" : "hover:bg-white/[0.015]"
          }`}
        >
          <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
            side
          </span>
          <span className={`tabular text-[14px] ${!sideYes ? "text-white" : "text-white/40"}`}>
            no · 0.16
          </span>
          {!sideYes && <span className="absolute inset-x-0 bottom-0 h-px bg-white/60" />}
        </button>
      </div>

      {/* INPUT MATRIX */}
      <div className="relative flex-1 px-6 pt-6">
        <BigInput
          label={mode === "provide" ? "deposit" : "collateral"}
          symbol={mode === "provide" ? "usdc" : "weth"}
          value={collateral}
          onChange={setCollateral}
        />

        {/* connector */}
        <ConnectorLine valid={valid} />

        <BigInput
          label={mode === "provide" ? "paired" : "borrow against"}
          symbol={mode === "provide" ? "usdc" : "usdc"}
          value={borrow}
          onChange={setBorrow}
        />

        {/* validation row */}
        <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${valid ? "bg-white" : "bg-[#FF4D5E]"} ${valid ? "" : "animate-pulse"}`}
              style={{
                boxShadow: valid
                  ? "0 0 10px rgba(255,255,255,0.5)"
                  : "0 0 10px rgba(255,77,94,0.5)",
              }}
            />
            <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/55">
              {valid ? "same-leg verified" : "leg mismatch · ltv > 0.85"}
            </span>
          </div>
          <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/40">
            ltv · {ratio.toFixed(2)}
          </span>
        </div>

        {/* fee preview */}
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
          <PreviewCell label="solver fee" value="0.04%" />
          <PreviewCell label="protocol" value="0.02%" />
          <PreviewCell label="route" value="3 hops" />
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-white/[0.06] p-6">
        <button
          onClick={onSign}
          disabled={!valid || signing}
          className={`group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-full border ease-precision ${
            valid
              ? "border-white/25 bg-white/[0.04] hover:border-white/40 hover:bg-white/[0.07]"
              : "cursor-not-allowed border-white/10 bg-white/[0.01]"
          }`}
          style={{ backdropFilter: "blur(14px)" }}
        >
          {signing ? (
            <span className="flex items-center gap-3">
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white"
                aria-hidden
              />
              <span className="tabular text-[11px] uppercase tracking-[0.32em] text-white/80">
                routing to solvers
              </span>
            </span>
          ) : (
            <span
              className={`tabular text-[12px] uppercase tracking-[0.32em] ${valid ? "text-white" : "text-white/30"}`}
            >
              {needsApproval ? `approve ${isProvide ? "usdc" : "weth"}` : "sign intent"}
            </span>
          )}
        </button>
        <div className="mt-3 flex items-center justify-between tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
          <span>est. settlement · 218ms</span>
          <span>42 solvers competing</span>
        </div>
      </div>
    </div>
  );
}

function BigInput({
  label,
  symbol,
  value,
  onChange,
}: {
  label: string;
  symbol: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Scale font size as user types
  const len = value.length;
  const size = Math.max(28, 48 - Math.max(0, len - 6) * 2);

  return (
    <div className="flex items-end justify-between">
      <div className="flex-1">
        <span className="tabular text-[10px] uppercase tracking-[0.24em] text-white/40">
          {label}
        </span>
        <div className="mt-1 flex items-baseline gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="tabular w-full bg-transparent font-light tracking-[-0.02em] text-white outline-none placeholder:text-white/15"
            style={{ fontSize: size, lineHeight: 1 }}
            placeholder="0"
          />
        </div>
      </div>
      <div className="flex flex-col items-end pb-2">
        <span className="rounded-full border border-white/15 bg-white/[0.02] px-3 py-1 tabular text-[10px] uppercase tracking-[0.22em] text-white/75">
          {symbol}
        </span>
        <span className="mt-1.5 tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
          balance · 482.4k
        </span>
      </div>
    </div>
  );
}

function ConnectorLine({ valid }: { valid: boolean }) {
  return (
    <div className="relative my-4 h-10">
      <svg
        viewBox="0 0 320 40"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <path
          d="M 40 4 C 100 4, 100 36, 160 36 S 220 4, 280 4"
          stroke={valid ? "rgba(255,255,255,0.55)" : "rgba(255,77,94,0.6)"}
          strokeWidth="1"
          fill="none"
          strokeDasharray={valid ? "0" : "3 4"}
          style={{ transition: "stroke 0.3s var(--ease-precision)" }}
        />
        <circle cx="40" cy="4" r="2" fill={valid ? "#ffffff" : "#FF4D5E"} />
        <circle cx="280" cy="4" r="2" fill={valid ? "#ffffff" : "#FF4D5E"} />
      </svg>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-abyss px-2.5 py-0.5 tabular text-[9px] uppercase tracking-[0.22em] text-white/45">
        {valid ? "linked" : "mismatch"}
      </div>
    </div>
  );
}

function PreviewCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/35">{label}</span>
      <span className="tabular mt-1 text-[12px] text-white/85">{value}</span>
    </div>
  );
}

/* ─────────────────────────── swap tab ─────────────────────────── */

function SwapTab({
  poolWeth,
  poolUsdc,
  yesPrice,
}: {
  poolWeth: `0x${string}`;
  poolUsdc: `0x${string}`;
  yesPrice: number;
}) {
  const { id } = Route.useParams();
  const { address: user } = useAccount();

  const [amount, setAmount] = useState("100");
  const [side, setSide] = useState<"yes" | "no">("yes");
  const price = side === "yes" ? yesPrice : 1 - yesPrice;
  const out = ((parseFloat(amount) || 0) / price).toFixed(2);
  const fee = ((parseFloat(amount) || 0) * 0.0006).toFixed(2);

  const parsedAmount = parseUnits(amount || "0", 18);
  const expectedOut = (parseFloat(amount) || 0) / price;
  const poolExpectedOut = expectedOut - (parseFloat(amount) || 0);
  const minOut = parseUnits((Math.max(0, poolExpectedOut) * 0.95).toFixed(18), 18);

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.USDC,
    abi: Erc20Abi,
    functionName: "allowance",
    args: [user as `0x${string}`, CONTRACT_ADDRESSES.OmniverseRouter],
    query: { enabled: !!user },
  });

  const needsApproval = (allowance as bigint) < parsedAmount;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApproving,
  } = useWriteContract();
  const { isLoading: isConfirmingApprove, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const signing = isPending || isConfirming || isApproving || isConfirmingApprove;

  useEffect(() => {
    if (isApproveSuccess) refetchAllowance();
  }, [isApproveSuccess, refetchAllowance]);

  useEffect(() => {
    if (isPending || isApproving) toast.loading("Waiting for wallet...", { id: "tx-swap" });
    else if (isConfirming || isConfirmingApprove)
      toast.loading("Transaction submitted...", { id: "tx-swap" });
    else if (isSuccess || isApproveSuccess)
      toast.success("Transaction confirmed", { id: "tx-swap" });
  }, [isPending, isConfirming, isSuccess, isApproving, isConfirmingApprove]);

  function onSwap() {
    if (signing || !amount) return;
    if (needsApproval) {
      writeApprove(
        {
          address: CONTRACT_ADDRESSES.USDC,
          abi: Erc20Abi,
          functionName: "approve",
          args: [CONTRACT_ADDRESSES.OmniverseRouter, parsedAmount],
        },
        { onError: (err) => toast.error(err.message, { id: "tx-swap" }) },
      );
      return;
    }

    writeContract(
      {
        address: CONTRACT_ADDRESSES.OmniverseRouter,
        abi: OmniverseRouterAbi,
        functionName: side === "yes" ? "buyYes" : "buyNo",
        args: [poolUsdc, id, parsedAmount, minOut],
      },
      { onError: (err) => toast.error(err.message, { id: "tx-swap" }) },
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-2 border-b border-white/[0.06]">
        {(["yes", "no"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`relative flex items-center justify-between px-6 py-4 ease-precision ${s !== "yes" ? "border-l border-white/[0.06]" : ""} ${
              side === s ? "bg-white/[0.02]" : "hover:bg-white/[0.015]"
            }`}
          >
            <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
              {s} shares
            </span>
            <span
              className={`tabular text-[14px] ${side === s ? "text-white" : "text-white/40"}`}
              style={side === s ? { textShadow: "0 0 12px rgba(255,255,255,0.35)" } : undefined}
            >
              {s === "yes" ? "0.84" : "0.16"}
            </span>
            {side === s && <span className="absolute inset-x-0 bottom-0 h-px bg-white/60" />}
          </button>
        ))}
      </div>

      <div className="flex-1 px-6 pt-6">
        <BigInput label="pay" symbol="usdc" value={amount} onChange={setAmount} />

        <div className="my-4 flex items-center justify-center">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-abyss tabular text-[14px] text-white/60">
            ↓
          </span>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex-1">
            <span className="tabular text-[10px] uppercase tracking-[0.24em] text-white/40">
              receive
            </span>
            <div className="tabular mt-1 text-[40px] font-light tracking-[-0.02em] text-white">
              {out}
            </div>
          </div>
          <div className="flex flex-col items-end pb-2">
            <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 tabular text-[10px] uppercase tracking-[0.22em] text-white">
              {side} · shares
            </span>
            <span className="mt-1.5 tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
              price · ${price.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
          <PreviewCell label="solver fee" value={`$${fee}`} />
          <PreviewCell label="slippage" value="5.0%" />
          <PreviewCell label="route" value="2 hops" />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
          <span>price impact</span>
          <span className="text-white">+0.014</span>
        </div>
      </div>

      <div className="border-t border-white/[0.06] p-6">
        <button
          onClick={onSwap}
          disabled={signing}
          className={`group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/[0.04] ease-precision hover:border-white/40 hover:bg-white/[0.07] ${signing ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className="tabular text-[12px] uppercase tracking-[0.32em] text-white">
            {needsApproval ? "approve usdc" : "swap shares"}
          </span>
        </button>
        <div className="mt-3 flex items-center justify-between tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
          <span>est. settlement · 218ms</span>
          <span>42 solvers competing</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── manage tab ─────────────────────────── */

function ManageTab({ lending }: { lending: `0x${string}` }) {
  const { address: user } = useAccount();

  const [mode, setMode] = useState<"repay" | "withdraw">("repay");
  const [amount, setAmount] = useState("100");

  const { data: isApproved = false, refetch: refetchApproval } = useReadContract({
    address: CONTRACT_ADDRESSES.ConditionalTokens,
    abi: ConditionalTokensAbi,
    functionName: "isApprovedForAll",
    args: [user as `0x${string}`, lending],
    query: { enabled: !!user && !!lending },
  });

  const { data: collateralWad = 0n } = useReadContract({
    address: lending,
    abi: MultiverseLendingAbi,
    functionName: "collateralOf",
    args: [user as `0x${string}`],
    query: { enabled: !!user && !!lending },
  });

  const { data: debtWad = 0n } = useReadContract({
    address: lending,
    abi: MultiverseLendingAbi,
    functionName: "debtOf",
    args: [user as `0x${string}`],
    query: { enabled: !!user && !!lending },
  });

  const { data: healthWad = 0n } = useReadContract({
    address: lending,
    abi: MultiverseLendingAbi,
    functionName: "healthFactor",
    args: [user as `0x${string}`],
    query: { enabled: !!user && !!lending },
  });

  const health = Number(healthWad) / 1e18;
  const displayHealth = health > 1000 ? "∞" : health.toFixed(2);
  // gauge 0..1 mapped from health 1.0..3.0
  const pct = Math.max(0, Math.min(1, (health - 1) / 2));
  const R = 56;
  const C = 2 * Math.PI * R;
  const offset = C - pct * C;
  const healthColor = health >= 1.5 ? "#ffffff" : health >= 1.2 ? "#a3a3a3" : "#FF4D5E";

  const needsApproval = mode === "repay" && !isApproved;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApproving,
  } = useWriteContract();
  const { isLoading: isConfirmingApprove, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const signing = isPending || isConfirming || isApproving || isConfirmingApprove;

  useEffect(() => {
    if (isApproveSuccess) refetchApproval();
  }, [isApproveSuccess, refetchApproval]);

  useEffect(() => {
    if (isPending || isApproving) toast.loading("Waiting for wallet...", { id: "tx-manage" });
    else if (isConfirming || isConfirmingApprove)
      toast.loading("Transaction submitted...", { id: "tx-manage" });
    else if (isSuccess || isApproveSuccess)
      toast.success("Transaction confirmed", { id: "tx-manage" });
  }, [isPending, isConfirming, isSuccess, isApproving, isConfirmingApprove]);

  function onSubmit() {
    if (signing || !amount) return;

    if (needsApproval) {
      writeApprove(
        {
          address: CONTRACT_ADDRESSES.ConditionalTokens,
          abi: ConditionalTokensAbi,
          functionName: "setApprovalForAll",
          args: [lending, true],
        },
        { onError: (err) => toast.error(err.message, { id: "tx-manage" }) },
      );
      return;
    }

    let finalAmount = parseUnits(amount, 18);
    if (mode === "repay" && finalAmount > (debtWad as bigint)) {
      finalAmount = debtWad as bigint;
    } else if (mode === "withdraw" && finalAmount > (collateralWad as bigint)) {
      finalAmount = collateralWad as bigint;
    }

    writeContract(
      {
        address: lending,
        abi: MultiverseLendingAbi,
        functionName: mode,
        args: [finalAmount],
      },
      { onError: (err) => toast.error(err.message, { id: "tx-manage" }) },
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* mode toggle */}
      <div className="grid grid-cols-2 border-b border-white/[0.06]">
        <button
          onClick={() => setMode("repay")}
          className={`relative flex items-center justify-between px-6 py-4 ease-precision ${
            mode === "repay" ? "bg-white/[0.02]" : "hover:bg-white/[0.015]"
          }`}
        >
          <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
            action
          </span>
          <span
            className={`tabular text-[14px] ${mode === "repay" ? "text-white" : "text-white/40"}`}
          >
            repay debt
          </span>
          {mode === "repay" && <span className="absolute inset-x-0 bottom-0 h-px bg-white/60" />}
        </button>
        <button
          onClick={() => setMode("withdraw")}
          className={`relative flex items-center justify-between border-l border-white/[0.06] px-6 py-4 ease-precision ${
            mode === "withdraw" ? "bg-white/[0.02]" : "hover:bg-white/[0.015]"
          }`}
        >
          <span className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
            action
          </span>
          <span
            className={`tabular text-[14px] ${mode === "withdraw" ? "text-white" : "text-white/40"}`}
            style={
              mode === "withdraw" ? { textShadow: "0 0 12px rgba(255,255,255,0.35)" } : undefined
            }
          >
            withdraw collat
          </span>
          {mode === "withdraw" && <span className="absolute inset-x-0 bottom-0 h-px bg-white/60" />}
        </button>
      </div>

      <div className="flex-1 px-6 pt-6">
        <div className="mb-6 flex items-center gap-6">
          <div className="relative h-[140px] w-[140px] shrink-0">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
              <circle
                cx="70"
                cy="70"
                r={R}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="70"
                cy="70"
                r={R}
                stroke={healthColor}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={offset}
                style={{
                  filter: `drop-shadow(0 0 8px ${healthColor}88)`,
                  transition: "stroke-dashoffset .6s var(--ease-precision)",
                }}
              />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="tabular text-[9px] uppercase tracking-[0.24em] text-white/40">
                health
              </span>
              <span
                className="tabular text-[28px] font-light text-white"
                style={{ textShadow: `0 0 12px ${healthColor}55` }}
              >
                {displayHealth}
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/40">
                collateral
              </span>
              <span className="tabular text-[13px] text-white/90">
                {(Number(collateralWad) / 1e18).toLocaleString()} yes-weth
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/40">
                debt
              </span>
              <span className="tabular text-[13px] text-white/90">
                {(Number(debtWad) / 1e18).toLocaleString()} yes-usdc
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="tabular text-[9px] uppercase tracking-[0.22em] text-white/40">
                liq. price
              </span>
              <span className="tabular text-[13px] text-white">{displayHealth}</span>
            </div>
          </div>
        </div>

        <BigInput
          label={mode === "repay" ? "repay amount" : "withdraw amount"}
          symbol={mode === "repay" ? "usdc" : "yes-weth"}
          value={amount}
          onChange={setAmount}
        />

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
          <PreviewCell label="ltv limit" value="0.85" />
          <PreviewCell label="new ltv" value="0.72" />
          <PreviewCell label="next acc." value="04:22" />
        </div>
      </div>

      <div className="border-t border-white/[0.06] p-6">
        <button
          onClick={onSubmit}
          disabled={signing}
          className={`group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/[0.04] ease-precision hover:border-white/40 hover:bg-white/[0.07] ${signing ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className="tabular text-[12px] uppercase tracking-[0.32em] text-white">
            {needsApproval
              ? "approve ctf"
              : mode === "repay"
                ? "repay usdc debt"
                : "withdraw collateral"}
          </span>
        </button>
        <div className="mt-3 flex items-center justify-center tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
          position monitored · solver mesh · safe
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── redeem tab ─────────────────────────── */

function RedeemTab() {
  const { id } = Route.useParams();
  const [shares, setShares] = useState("100");
  const [token, setToken] = useState<"USDC" | "WETH">("USDC");
  const payout = (parseFloat(shares) || 0).toFixed(2);

  // On-chain resolution check: payoutDenominator > 0 means resolved
  const { data: payoutDenominator } = useReadContract({
    address: CONTRACT_ADDRESSES.ConditionalTokens,
    abi: ConditionalTokensAbi,
    functionName: "payoutDenominator",
    args: [id],
    query: { refetchInterval: 10_000 },
  });

  const isResolved =
    payoutDenominator !== undefined &&
    payoutDenominator !== null &&
    BigInt(payoutDenominator as bigint) > 0n;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const signing = isPending || isConfirming;

  useEffect(() => {
    if (isPending) toast.loading("Waiting for wallet...", { id: "tx-redeem" });
    else if (isConfirming) toast.loading("Transaction submitted...", { id: "tx-redeem" });
    else if (isSuccess) toast.success("Transaction confirmed", { id: "tx-redeem" });
  }, [isPending, isConfirming, isSuccess]);

  function onRedeem() {
    if (signing || !isResolved) return;
    writeContract(
      {
        address: CONTRACT_ADDRESSES.ConditionalTokens,
        abi: ConditionalTokensAbi,
        functionName: "redeemPositions",
        args: [
          token === "USDC" ? CONTRACT_ADDRESSES.USDC : CONTRACT_ADDRESSES.WETH,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          id,
          [1, 2],
        ],
      },
      { onError: (err) => toast.error(err.message, { id: "tx-redeem" }) },
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-white/[0.04] to-transparent px-6 py-5">
        {isResolved ? (
          <>
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-white/60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              <span
                className="tabular text-[10px] uppercase tracking-[0.32em] text-white"
                style={{ textShadow: "0 0 12px rgba(255,255,255,0.35)" }}
              >
                market resolved · yes
              </span>
            </div>
            <p className="mt-2 tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
              1 yes ≡ 1 collateral token · redeemable now
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
              </span>
              <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/55">
                market active · not yet resolved
              </span>
            </div>
            <p className="mt-2 tabular text-[10px] uppercase tracking-[0.22em] text-white/35">
              redemption available after oracle settlement
            </p>
          </>
        )}
      </div>

      <div className="flex-1 px-6 pt-6">
        <BigInput label="burn" symbol="yes" value={shares} onChange={setShares} />

        <div className="my-4 flex items-center justify-center">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-abyss tabular text-[14px] text-white">
            ≡
          </span>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex-1">
            <span className="tabular text-[10px] uppercase tracking-[0.24em] text-white/40">
              receive
            </span>
            <div
              className="tabular mt-1 text-[40px] font-light tracking-[-0.02em] text-white"
              style={{ textShadow: "0 0 18px rgba(255,255,255,0.35)" }}
            >
              {isResolved ? payout : "—"}
            </div>
          </div>
          <div className="flex flex-col items-end pb-2">
            <select
              value={token}
              onChange={(e) => setToken(e.target.value as "USDC" | "WETH")}
              className="rounded-full border border-white/15 bg-white/[0.02] px-3 py-1 outline-none tabular text-[10px] uppercase tracking-[0.22em] text-white/75 cursor-pointer hover:bg-white/[0.05]"
            >
              <option value="USDC">USDC</option>
              <option value="WETH">WETH</option>
            </select>
            <span className="mt-1.5 tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
              {isResolved ? "1:1 redemption" : "pending resolution"}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
          <PreviewCell label="oracle" value="uma · v3" />
          <PreviewCell label="status" value={isResolved ? "resolved" : "active"} />
          <PreviewCell label="claim window" value={isResolved ? "open" : "—"} />
        </div>
      </div>

      <div className="border-t border-white/[0.06] p-6">
        <button
          onClick={onRedeem}
          disabled={signing || !isResolved}
          className={`group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-full border ease-precision ${isResolved ? "border-white/25 bg-white/[0.04] hover:border-white/40 hover:bg-white/[0.07]" : "border-white/10 bg-white/[0.01] cursor-not-allowed"} ${signing ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span
            className={`tabular text-[12px] uppercase tracking-[0.32em] ${isResolved ? "text-white" : "text-white/30"}`}
            style={isResolved ? { textShadow: "0 0 12px rgba(255,255,255,0.45)" } : undefined}
          >
            {isResolved ? `burn yes shares for ${token.toLowerCase()}` : "awaiting oracle resolution"}
          </span>
        </button>
        <div className="mt-3 flex items-center justify-between tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
          <span>{isResolved ? "oracle attested · final" : "oracle pending"}</span>
          <span>no slippage · no fees</span>
        </div>
      </div>
    </div>
  );
}
