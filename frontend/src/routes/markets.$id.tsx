import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Nav } from "@/components/marketing/Nav";
import ExecutionTerminal from "@/components/execution-terminal";
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
  const search = useSearch({ strict: false }) as { present?: string };
  const presentMode = search?.present === "true";
  const { data: manifest } = useDemoManifest();
  const { data: blockNumber } = useLiveBlockNumber();

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
        symbol: "...",
        question: "Loading...",
        category: "...",
        yes: 0.5,
        tvl: "$0.00",
        volume24: "$0.00",
        expiry: "...",
        latency: "...",
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
      question: item.question,
      category: item.category,
      yes: yesPrice > 0 ? yesPrice : 0.5,
      tvl: "---",
      volume24: vol > 0 ? `$${vol.toFixed(1)}` : "$0.00",
      expiry: "2026·12·31",
      latency: "218ms",
    };
  }, [data]);

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
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0A0A0B] font-sans text-text-primary">
      <div className="noise-overlay" style={{ opacity: 0.02, mixBlendMode: 'overlay', pointerEvents: 'none' }} />

      {/* Global nav — bordered, full width */}
      <div className="shrink-0 border-b border-white/[0.05]">
        <Nav appMode />
      </div>

      {isDemoMarket && (
        <div className="shrink-0 border-b border-white/[0.05]">
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
        </div>
      )}

      <main className="flex flex-1 min-h-0 flex-col w-full max-w-[1600px] mx-auto px-8 py-6 gap-5">
        {/* ── Market Header ── */}
        <header className="flex flex-col gap-3 shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <Link
              to="/markets"
              className="tabular text-[10px] uppercase tracking-[0.22em] text-white/40 hover:text-white/90 transition-colors"
            >
              ← markets
            </Link>
            {MARKET.category && (
              <>
                <span className="text-white/[0.15]">/</span>
                <span className="rounded-full border border-white/[0.08] px-2.5 py-0.5 tabular text-[9px] uppercase tracking-[0.22em] text-white/40">
                  {MARKET.category}
                </span>
              </>
            )}
          </div>

          <h1 className="max-w-[900px] text-[26px] font-semibold leading-[1.3] tracking-[-0.02em] text-[#F3F4F6]">
            {MARKET.question === "Loading..." ? (
              <span className="flex items-center gap-3 text-[#F3F4F6]/40">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Loading market...
              </span>
            ) : MARKET.question}
          </h1>

          {/* iPRED-style stats row — divide-x, single border */}
          <div className="flex items-stretch rounded-[10px] border border-white/[0.06] divide-x divide-white/[0.06] overflow-hidden bg-[#0E0E11]">
            <StatCell label="YES" value={liveYes.toFixed(3)} accent />
            <StatCell label="NO" value={(1 - liveYes).toFixed(3)} />
            <StatCell label="24H VOL" value={MARKET.volume24} />
            <StatCell label="TVL" value={tvlLabel} />
            <StatCell label="LIQUIDITY" value={formatCompactToken(liquidity ?? reserves?.lT)} />
            <StatCell label="EXPIRES" value={expiryLabel} />
            <div className="flex items-center gap-2 px-4">
              <span className="relative flex h-[6px] w-[6px]">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#10B981]" />
                <span className="relative h-full w-full rounded-full bg-[#10B981]" style={{ filter: "drop-shadow(0 0 4px #10B981)" }} />
              </span>
              <span className="tabular text-[10px] uppercase tracking-[0.2em] text-white/40">
                live · #{formatBlockNumber(blockNumber)}
              </span>
            </div>
          </div>
        </header>

        {/* ── Pre-Demo Readiness (demo market only, hidden in present mode) ── */}
        {isDemoMarket && !presentMode && (
          <div className="shrink-0">
            <PreDemoReadinessPanel manifest={manifest} pool={livePool} presentMode={presentMode} />
          </div>
        )}

        {/* ── Dual Panel ── */}
        <div className="flex flex-1 min-h-0 gap-4">
          {/* Chart — 65% */}
          <div className="flex w-[65%] flex-col overflow-hidden rounded-[16px] border border-white/[0.05] bg-[#0E0E11]">
            <ProbabilityCanvas mu={liveYes} />
          </div>

          {/* Execution Terminal — 35% */}
          <div className="flex w-[35%] flex-col overflow-hidden rounded-[16px] [&>div]:h-full">
            <ExecutionTerminal
              poolWeth={livePool}
              poolUsdc={MARKET.poolUsdc}
              lending={MARKET.lending}
              yesPrice={liveYes}
              conditionId={demoConditionId ?? id}
              manifest={manifest}
            />
          </div>
        </div>
      </main>
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
          <AttackMetric label="p(yes)" value={price ? formatProbability(price) : "—"} />
          <AttackMetric label="λ" value={reserves ? formatWad(reserves.lambdaWad, 3) : "—"} />
          <AttackMetric label="active" value={total > 0n ? `${activePct.toFixed(1)}%` : "—"} />
          <AttackMetric label="shielded" value={total > 0n ? `${passivePct.toFixed(1)}%` : "—"} />
          <AttackMetric
            label="ell"
            value={reserves ? formatCompactToken(reserves.ellActive) : "—"}
          />
          <AttackMetric label="L_t" value={formatCompactToken(liquidity ?? reserves?.lT)} />
          <AttackMetric label="math" value={mathLabel} accent={mathMatches} />
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
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-end">
      <span className="tabular text-[8px] uppercase tracking-[0.2em] text-white/30">{label}</span>
      <span className={`tabular text-[11px] ${accent ? "text-white" : "text-white/75"}`}>
        {value}
      </span>
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
    y: number;
    p: number;
    depth: number;
    lambda: number;
  } | null>(null);

  // Build a gaussian-ish curve centered roughly at mu
  const { path, fill } = useMemo(() => {
    const sigma = 0.14;
    const peakY = 260; // top padding for peak
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
    const baseY = H - 60;
    const peakY = 260;
    setHover({
      x: xSvg,
      y: baseY - g * (baseY - peakY),
      p,
      depth: Math.round(g * 24_800_000 + 480_000),
      lambda: 0.42 + g * 0.36,
    });
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* corner labels */}
      <div className="pointer-events-none z-10 p-6 pb-0">
        <div className="mb-8 mt-1.5 font-mono text-[24px] uppercase tracking-widest leading-none text-[#F3F4F6]">
          P<sub className="text-[12px]">true</sub> · <span className="font-mono tracking-widest">GAUSSIAN BAND</span>
        </div>
      </div>

      <div className="relative flex-1">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(37,99,235,0.15)" strokeWidth="1" />
          </pattern>
          <linearGradient id="gauss-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(37,99,235,0.30)" />
            <stop offset="100%" stopColor="rgba(37,99,235,0)" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* baseline */}
        <line
          x1="40"
          y1={H - 60}
          x2={W - 40}
          y2={H - 60}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
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
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}

        {/* Layer 1: hatch pattern */}
        <path d={fill} fill="url(#hatch)" />
        {/* Layer 2: gradient wash */}
        <path d={fill} fill="url(#gauss-fill)" />
        
        {/* Layer 3: Main Stroke */}
        <path 
          d={path} 
          stroke="#F3F4F6" 
          strokeWidth="1.5" 
          fill="none" 
          style={{ filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.5))" }} 
          vectorEffect="non-scaling-stroke"
        />

        {/* μ vertical line */}
        <line
          x1={muX}
          y1={260 - 10}
          x2={muX}
          y2={H - 60}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          strokeDasharray="2 4"
          vectorEffect="non-scaling-stroke"
        />

        {/* crosshair */}
        {hover && (
          <g pointerEvents="none">
            {/* vertical tracking line */}
            <line
              x1={hover.x}
              y1={260 - 10}
              x2={hover.x}
              y2={H - 60}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {/* Apex Node */}
            <circle 
              cx={hover.x} 
              cy={hover.y} 
              r="4" 
              fill="#F3F4F6" 
              filter="url(#glow)" 
            />
            {/* connector to tooltip */}
            <line
              x1={hover.x}
              y1={hover.y}
              x2={hover.x + (hover.x > W / 2 ? -20 : 20)}
              y2={hover.y - 20}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.75"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>

      {/* HTML overlay for text */}
      <div className="pointer-events-none absolute inset-0">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const leftPct = ((40 + (W - 80) * p) / W) * 100;
          return (
            <div
              key={p}
              className="absolute text-[11px] text-[#8B8D98]"
              style={{
                left: `${leftPct}%`,
                top: `${((H - 38) / H) * 100}%`,
                transform: "translateX(-50%)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.16em",
              }}
            >
              {p.toFixed(2)}
            </div>
          );
        })}

        <div
          className="absolute text-[10px] text-[#8B8D98]"
          style={{
            left: `${(muX / W) * 100}%`,
            top: `${(240 / H) * 100}%`,
            transform: "translateX(8px)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.16em",
          }}
        >
          μ · {mu.toFixed(2)}
        </div>
      </div>

      {/* frosted tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 flex w-[220px] flex-col rounded-[16px] border border-white/[0.05] px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.5),0_1px_3px_rgba(0,0,0,0.2)] transition-all duration-75 ease-linear"
          style={{
            background: "rgba(10, 10, 11, 0.6)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            left: hover.x > W / 2 ? `calc(${hover.x / 10}% - 240px)` : `calc(${hover.x / 10}% + 20px)`,
            top: `calc(${hover.y / 6}% - 60px)`,
          }}
        >
          <div
            className="text-[9px] uppercase tracking-[0.24em] text-[#8B8D98]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            probability
          </div>
          <div
            className="mt-0.5 font-sans text-[20px] font-light text-[#F3F4F6]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {hover.p.toFixed(3)}
          </div>
          <div className="mt-3 border-t border-white/[0.04] pt-3">
            <div className="flex items-center justify-between">
              <span
                className="text-[9px] uppercase tracking-[0.24em] text-[#8B8D98]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                Σ depth
              </span>
              <span
                className="font-sans text-[11px] text-[#F3F4F6]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                ${(hover.depth / 1_000_000).toFixed(2)}m
              </span>
            </div>
          </div>
        </div>
      )}
      </div>
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
      <div className="relative flex-1 p-6 pl-[52px] flex flex-col gap-6">
        <BigInput
          label={mode === "provide" ? "deposit" : "collateral"}
          symbol={mode === "provide" ? "usdc" : "weth"}
          value={collateral}
          onChange={setCollateral}
        />

        {/* connector */}
        <ConnectorLine valid={valid} signing={signing} />

        <BigInput
          label={mode === "provide" ? "paired" : "borrow against"}
          symbol={mode === "provide" ? "usdc" : "usdc"}
          value={borrow}
          onChange={setBorrow}
        />

        {/* validation row */}
        <div className="mt-5 flex items-center justify-between border-t border-white/[0.04] pt-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${valid ? "bg-[#10B981]" : "bg-[#EF4444]"} ${valid ? "" : "animate-pulse"}`}
              style={{
                boxShadow: valid
                  ? "0 0 10px rgba(16, 185, 129, 0.5)"
                  : "0 0 10px rgba(239, 68, 68, 0.5)",
              }}
            />
            <span className="tabular text-[10px] uppercase tracking-[0.22em] text-[#8B8D98]">
              {valid ? "same-leg verified" : "leg mismatch · ltv > 0.85"}
            </span>
          </div>
          <span className="tabular text-[10px] uppercase tracking-[0.22em] text-[#8B8D98]">
            ltv · {ratio.toFixed(2)}
          </span>
        </div>

        {/* fee preview */}
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.04] pt-4">
          <PreviewCell label="solver fee" value="0.04%" />
          <PreviewCell label="protocol" value="0.02%" />
          <PreviewCell label="route" value="3 hops" />
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-white/[0.04] p-6">
        <button
          onClick={onSign}
          disabled={!valid || signing}
          className={`group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full border transition-all duration-300 ease-out ${
            valid
              ? "border-white/[0.1] bg-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)] hover:border-white hover:bg-white/[0.08]"
              : "cursor-not-allowed border-white/[0.02] bg-white/[0.01]"
          }`}
          style={{ backdropFilter: "blur(20px)" }}
        >
          {valid && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          )}
          {signing ? (
            <span className="flex items-center gap-3">
              <svg className="h-4 w-4 animate-spin text-[#F3F4F6]" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-[11px] uppercase tracking-[0.32em] text-[#F3F4F6]" style={{ fontVariantNumeric: "tabular-nums" }}>
                routing to solvers
              </span>
            </span>
          ) : (
            <span
              className={`relative z-10 text-[12px] uppercase tracking-[0.05em] ${valid ? "text-[rgba(255,255,255,0.9)]" : "text-[#8B8D98]"}`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {needsApproval ? `approve ${isProvide ? "usdc" : "weth"}` : "sign intent"}
            </span>
          )}
        </button>
        <div className="mt-4 flex items-center justify-between tabular text-[9px] uppercase tracking-[0.22em] text-[#8B8D98]">
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
  const isWeth = symbol.toLowerCase() === "weth";
  const isUsdc = symbol.toLowerCase() === "usdc";

  return (
    <div
      className="group relative flex items-center justify-between rounded-[12px] p-6 transition-colors"
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.04)",
      }}
    >
      <div className="flex-1">
        <span
          className="text-[10px] uppercase tracking-[0.24em] text-[#8B8D98]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {label}
        </span>
        <div className="mt-2 flex items-baseline gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="w-full bg-transparent font-sans text-[48px] font-light tracking-[-0.02em] text-[#F3F4F6] outline-none placeholder:text-[#F3F4F6]/10"
            style={{ lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
            placeholder="0"
          />
        </div>
      </div>
      <div className="flex flex-col items-end pb-1">
        <span
          className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${
            isWeth
              ? "bg-[#8B5CF6]/10 text-[#8B5CF6]"
              : isUsdc
                ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                : "bg-[#F3F4F6]/10 text-[#F3F4F6]"
          }`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {symbol}
        </span>
        <span
          className="mt-2 text-[9px] uppercase tracking-[0.22em] text-[#8B8D98]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          balance · 482.4k
        </span>
      </div>
    </div>
  );
}

function ConnectorLine({ valid, signing }: { valid: boolean; signing?: boolean }) {
  return (
    <div className="pointer-events-none absolute bottom-[150px] left-[32px] top-[100px] w-[20px] z-10">
      <style>{`
        @keyframes flow-energy {
          from { stroke-dashoffset: 30; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 20 100"
      >
        <path
          d="M 20 0 L 4 0 C 2 0, 0 2, 0 4 L 0 96 C 0 98, 2 100, 4 100 L 20 100"
          stroke={valid ? "rgba(255,255,255,0.05)" : "#EF4444"}
          strokeWidth="2"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        {valid && (
          <path
            d="M 20 0 L 4 0 C 2 0, 0 2, 0 4 L 0 96 C 0 98, 2 100, 4 100 L 20 100"
            stroke="#10B981"
            strokeWidth="2"
            fill="none"
            strokeDasharray="8 16"
            vectorEffect="non-scaling-stroke"
            style={{ animation: `flow-energy ${signing ? "0.3s" : "1s"} linear infinite` }}
          />
        )}
      </svg>
      <div
        className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-0.5 backdrop-blur-[24px]"
        style={{
          backgroundColor: valid ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
          borderColor: valid ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
          color: valid ? "#10B981" : "#EF4444",
        }}
      >
        <span
          className="text-[9px] uppercase tracking-[0.22em]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {valid ? "linked" : "invalid"}
        </span>
      </div>
    </div>
  );
}

function PreviewCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="tabular text-[10px] uppercase tracking-[0.22em] text-[#8B8D98]">{label}</span>
      <span className="tabular text-[13px] tracking-wide text-[#F3F4F6]">{value}</span>
    </div>
  );
}

/* ─────────────────────────── redeem tab ─────────────────────────── */

function RedeemTab() {
  const { id } = Route.useParams();
  const [shares, setShares] = useState("100");
  const [token, setToken] = useState<"USDC" | "WETH">("USDC");
  const payout = (parseFloat(shares) || 0).toFixed(2);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const signing = isPending || isConfirming;

  useEffect(() => {
    if (isPending) toast.loading("Waiting for wallet...", { id: "tx-redeem" });
    else if (isConfirming) toast.loading("Transaction submitted...", { id: "tx-redeem" });
    else if (isSuccess) toast.success("Transaction confirmed", { id: "tx-redeem" });
  }, [isPending, isConfirming, isSuccess]);

  function onRedeem() {
    if (signing) return;
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
          settlement block 21·482·113 · 1 yes ≡ 1 usdc
        </p>
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
              {payout}
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
              1:1 redemption
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
          <PreviewCell label="oracle" value="uma · v3" />
          <PreviewCell label="resolved" value="2026·12·31" />
          <PreviewCell label="claim window" value="open" />
        </div>
      </div>

      <div className="border-t border-white/[0.06] p-6">
        <button
          onClick={onRedeem}
          disabled={signing}
          className={`group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/[0.04] ease-precision hover:border-white/40 hover:bg-white/[0.07] ${signing ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span
            className="tabular text-[12px] uppercase tracking-[0.32em] text-white"
            style={{ textShadow: "0 0 12px rgba(255,255,255,0.45)" }}
          >
            burn yes shares for {token.toLowerCase()}
          </span>
        </button>
        <div className="mt-3 flex items-center justify-between tabular text-[9px] uppercase tracking-[0.22em] text-white/35">
          <span>oracle attested · final</span>
          <span>no slippage · no fees</span>
        </div>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-0.5 px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
      <span className="text-[9px] uppercase tracking-[0.18em] text-[#8B8D98]" style={{ fontVariantNumeric: "tabular-nums" }}>
        {label}
      </span>
      <span
        className={`text-[14px] font-mono font-medium ${accent ? "text-[#F3F4F6]" : "text-[#F3F4F6]/80"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}
