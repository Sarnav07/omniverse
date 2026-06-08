import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "urql";
import { createPublicClient, http, type Address } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { NavBar } from "@/components/nav-bar";
import PmAmmPoolAbi from "@/abis/PmAmmPool.abi.json";
import OmniverseMathAbi from "@/abis/OmniverseMath.abi.json";
import MultiverseLendingAbi from "@/abis/MultiverseLending.abi.json";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Live Math Demo - Omniverse" },
      { name: "description", content: "Single-market live dashboard for dynamic lambda protection." },
    ],
  }),
  component: DemoPage,
});

const DEMO_QUERY = `
  query {
    markets(limit: 1000, orderBy: "createdAt", orderDirection: "desc") {
      items {
        id
        question
        symbol
        category
        resolver
        poolWeth
        poolUsdc
        useDynamicLambda
        totalVolumeWeth
        lastPriceWeth
        tradeCount
        createdAt
        createdBlock
      }
    }
    trades(limit: 1000, orderBy: "blockNumber", orderDirection: "asc") {
      items {
        id
        conditionId
        pool
        poolType
        trader
        sideLabel
        size
        priceAfter
        ellWad
        lambdaWad
        gapWad
        timestamp
        blockNumber
        txHash
      }
    }
    rebalances(limit: 1000, orderBy: "blockNumber", orderDirection: "asc") {
      items {
        id
        pool
        poolType
        xActive
        yActive
        ellActive
        lambdaWad
        blockNumber
        timestamp
      }
    }
  }
`;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type DemoManifest = {
  runId?: string;
  createdBlock?: number;
  question?: string;
  symbol?: string;
  conditionId?: string;
  poolWeth?: Address;
  poolUsdc?: Address;
  math?: Address;
  factory?: Address;
  resolver?: Address;
  demoAccount?: Address;
  weth?: Address;
  usdc?: Address;
  l0?: string;
  gammaPrime?: string;
  initialLiquidityYes?: string;
  initialLiquidityNo?: string;
  lending?: Address;
  lendingCollateral?: string;
  lendingDebt?: string;
};

type MarketRow = {
  id: string;
  question: string;
  symbol: string;
  category: string;
  resolver: string;
  poolWeth: string;
  poolUsdc: string;
  useDynamicLambda: boolean;
  totalVolumeWeth: string;
  lastPriceWeth: string;
  tradeCount: number;
  createdAt: number;
  createdBlock: number;
};

type TradeRow = {
  id: string;
  conditionId: string;
  pool: string;
  poolType: string;
  trader: string;
  sideLabel: string;
  size: string;
  priceAfter: string;
  ellWad: string;
  lambdaWad: string;
  gapWad: string;
  timestamp: number;
  blockNumber: number;
  txHash: string;
};

type RebalanceRow = {
  id: string;
  pool: string;
  poolType: string;
  xActive: string;
  yActive: string;
  ellActive: string;
  lambdaWad: string;
  blockNumber: number;
};

type ChainState = {
  price: bigint;
  math: Address;
  useDynamicLambda: boolean;
  gammaPrime: bigint;
  l0: bigint;
  expiry: bigint;
  duration: bigint;
  reserves: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
  lendingCollateral?: bigint;
  lendingDebt?: bigint;
};

type CurvePoint = { p: number; lambda: number };

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(
    import.meta.env.VITE_ARB_SEPOLIA_RPC ||
      import.meta.env.VITE_RPC_URL ||
      "https://sepolia-rollup.arbitrum.io/rpc",
  ),
});

function DemoPage() {
  const [manifest, setManifest] = useState<DemoManifest>({});
  const [chainState, setChainState] = useState<ChainState | null>(null);
  const [curve, setCurve] = useState<CurvePoint[]>([]);
  const [proofZ, setProofZ] = useState<Record<string, bigint>>({});
  const [result, setResult] = useState<{ data: any; fetching: boolean; error: any }>({ data: null, fetching: true, error: null });

  useEffect(() => {
    let cancelled = false;

    function loadData() {
      fetch("http://localhost:42069/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query: DEMO_QUERY })
      })
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          if (data.errors) setResult(prev => ({ ...prev, fetching: false, error: new Error(data.errors[0].message) }));
          else setResult(prev => ({ ...prev, data: data.data, fetching: false, error: null }));
        })
        .catch(error => {
          if (!cancelled) setResult(prev => ({ ...prev, fetching: false, error }));
        });
    }

    loadData();
    const interval = window.setInterval(loadData, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetch("/demo-manifest.json")
      .then((res) => (res.ok ? res.json() : {}))
      .then(setManifest)
      .catch(() => setManifest({}));
  }, []);

  const market = useMemo(() => selectMarket(result.data?.markets?.items ?? [], manifest), [result.data, manifest]);
  const trades = useMemo(
    () => filterTrades(result.data?.trades?.items ?? [], manifest, market),
    [result.data, manifest, market],
  );
  const rebalances = useMemo(
    () => filterRebalances(result.data?.rebalances?.items ?? [], manifest, market),
    [result.data, manifest, market],
  );
  const lvr = useMemo(() => computeLvr(trades), [trades]);
  const proofTrades = trades.slice(-5).reverse();

  useEffect(() => {
    if (!manifest.poolWeth) return;
    let cancelled = false;

    async function loadPoolState() {
      const pool = manifest.poolWeth!;
      const [
        price,
        math,
        useDynamicLambda,
        gammaPrime,
        l0,
        expiry,
        duration,
        reserves,
      ] = await Promise.all([
        publicClient.readContract({ address: pool, abi: PmAmmPoolAbi, functionName: "currentPrice" }),
        publicClient.readContract({ address: pool, abi: PmAmmPoolAbi, functionName: "math" }),
        publicClient
          .readContract({ address: pool, abi: PmAmmPoolAbi, functionName: "useDynamicLambda" })
          .catch(() => true),
        publicClient.readContract({ address: pool, abi: PmAmmPoolAbi, functionName: "gammaPrimeWad" }),
        publicClient.readContract({ address: pool, abi: PmAmmPoolAbi, functionName: "L0" }),
        publicClient.readContract({ address: pool, abi: PmAmmPoolAbi, functionName: "T" }),
        publicClient.readContract({ address: pool, abi: PmAmmPoolAbi, functionName: "duration" }),
        publicClient.readContract({ address: pool, abi: PmAmmPoolAbi, functionName: "getReserves" }),
      ]);

      let lendingCollateral: bigint | undefined;
      let lendingDebt: bigint | undefined;
      if (manifest.lending && manifest.lending !== ZERO_ADDRESS && manifest.demoAccount) {
        [lendingCollateral, lendingDebt] = await Promise.all([
          publicClient.readContract({
            address: manifest.lending,
            abi: MultiverseLendingAbi,
            functionName: "collateralOf",
            args: [manifest.demoAccount],
          }),
          publicClient.readContract({
            address: manifest.lending,
            abi: MultiverseLendingAbi,
            functionName: "debtOf",
            args: [manifest.demoAccount],
          }),
        ]);
      }

      if (!cancelled) {
        setChainState({
          price: price as bigint,
          math: math as Address,
          useDynamicLambda: useDynamicLambda as boolean,
          gammaPrime: gammaPrime as bigint,
          l0: l0 as bigint,
          expiry: expiry as bigint,
          duration: duration as bigint,
          reserves: reserves as ChainState["reserves"],
          lendingCollateral,
          lendingDebt,
        });
      }
    }

    loadPoolState().catch(console.error);
    const interval = window.setInterval(() => loadPoolState().catch(console.error), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [manifest.poolWeth, manifest.lending, manifest.demoAccount]);

  useEffect(() => {
    const math = chainState?.math ?? manifest.math;
    const gammaPrime = chainState?.gammaPrime ?? (manifest.gammaPrime ? BigInt(manifest.gammaPrime) : undefined);
    if (!math || !gammaPrime) return;
    let cancelled = false;

    async function loadCurve() {
      const samples = buildProbabilitySamples();
      const lambdas = await Promise.all(
        samples.map((p) =>
          publicClient.readContract({
            address: math,
            abi: OmniverseMathAbi,
            functionName: "lambdaStarGaussian",
            args: [gammaPrime, probabilityToWad(p)],
          }),
        ),
      );
      if (!cancelled) {
        setCurve(samples.map((p, index) => ({ p, lambda: wadToNumber(lambdas[index] as bigint) })));
      }
    }

    loadCurve().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [chainState?.math, chainState?.gammaPrime, manifest.math, manifest.gammaPrime]);

  useEffect(() => {
    const math = chainState?.math ?? manifest.math;
    if (!math || proofTrades.length === 0) return;
    let cancelled = false;

    async function loadProofZ() {
      const rows = await Promise.all(
        proofTrades.map(async (trade) => {
          const z = await publicClient.readContract({
            address: math,
            abi: OmniverseMathAbi,
            functionName: "PhiInv",
            args: [BigInt(trade.priceAfter)],
          });
          return [trade.id, z as bigint] as const;
        }),
      );
      if (!cancelled) setProofZ(Object.fromEntries(rows));
    }

    loadProofZ().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [chainState?.math, manifest.math, proofTrades.map((trade) => trade.id).join("|")]);

  const currentPrice = chainState ? wadToNumber(chainState.price) : wadToNumber(market?.lastPriceWeth ?? "0");
  const currentLambda = chainState ? wadToNumber(chainState.reserves[5]) : lastNumber(trades, "lambdaWad", 1);
  const stylusVerified = Boolean(chainState?.math && manifest.math && sameAddress(chainState.math, manifest.math));

  return (
    <div className="min-h-screen bg-abyss text-white">
      <NavBar />
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-24">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">live math demo</p>
          <h1 className="mt-2 text-3xl font-semibold">Single-market dynamic lambda dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            A real Sepolia market with indexed trades, on-chain lambda reads, active/passive LP protection,
            counterfactual LVR, and the zero-liquidation lending primitive.
          </p>
        </header>

        {result.fetching ? <StatusLine text="Loading indexed Ponder data..." /> : null}
        {result.error ? <StatusLine text={`GraphQL error: ${result.error.message}`} /> : null}
        {!result.fetching && !market ? (
          <StatusLine text="No current demo market found. Run ./run-demo-sepolia.sh and resync Ponder from the manifest createdBlock." />
        ) : null}

        <section className="grid gap-5 lg:grid-cols-2">
          <MarketPanel market={market} manifest={manifest} currentPrice={currentPrice} trades={trades} />
          <LiquidityPanel manifest={manifest} chainState={chainState} />
          <WCurvePanel curve={curve} currentPrice={currentPrice} currentLambda={currentLambda} />
          <LvrPanel lvr={lvr} />
          <LendingPanel manifest={manifest} chainState={chainState} />
          <ProofPanel
            manifest={manifest}
            chainState={chainState}
            trades={proofTrades}
            proofZ={proofZ}
            stylusVerified={stylusVerified}
          />
        </section>
      </main>
    </div>
  );
}

function MarketPanel({
  market,
  manifest,
  currentPrice,
  trades,
}: {
  market?: MarketRow;
  manifest: DemoManifest;
  currentPrice: number;
  trades: TradeRow[];
}) {
  return (
    <Panel title="1. Live Market and User Flow">
      <p className="text-sm text-white/70">{market?.question ?? manifest.question ?? "Waiting for demo market"}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="Symbol" value={market?.symbol ?? manifest.symbol ?? "-"} />
        <Metric label="YES probability" value={`${(currentPrice * 100).toFixed(2)}%`} />
        <Metric label="WETH volume" value={`${formatNumber(wadToNumber(market?.totalVolumeWeth ?? "0"))} WETH`} />
        <Metric label="Trades indexed" value={String(market?.tradeCount ?? trades.length)} />
      </div>
      <AddressLine label="Condition" value={manifest.conditionId ?? market?.id} />
      <AddressLine label="WETH pool" value={manifest.poolWeth ?? market?.poolWeth} />
      <AddressLine label="Resolver" value={manifest.resolver ?? market?.resolver} />

      <h3 className="mt-5 text-sm font-medium">Recent trades</h3>
      <div className="mt-2 space-y-2">
        {trades.slice(-5).reverse().map((trade) => (
          <div key={trade.id} className="grid grid-cols-4 gap-2 rounded border border-white/10 p-2 text-xs">
            <span>{trade.sideLabel}</span>
            <span>{formatNumber(wadToNumber(trade.size))} WETH</span>
            <span>{(wadToNumber(trade.priceAfter) * 100).toFixed(2)}%</span>
            <a className="text-emerald-300" href={arbiscanTx(trade.txHash)} target="_blank" rel="noreferrer">
              tx
            </a>
          </div>
        ))}
        {trades.length === 0 ? <p className="text-sm text-white/45">No WETH trades indexed yet.</p> : null}
      </div>
    </Panel>
  );
}

function LiquidityPanel({ manifest, chainState }: { manifest: DemoManifest; chainState: ChainState | null }) {
  const reserves = chainState?.reserves;
  const xActive = reserves?.[0] ?? 0n;
  const xPassive = reserves?.[1] ?? 0n;
  const yActive = reserves?.[2] ?? 0n;
  const yPassive = reserves?.[3] ?? 0n;
  const active = xActive + yActive;
  const passive = xPassive + yPassive;
  const total = active + passive;
  const activePct = total > 0n ? Number((active * 10_000n) / total) / 100 : 0;
  const passivePct = Math.max(0, 100 - activePct);

  return (
    <Panel title="2. Liquidity Provision and Protection">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Initial YES LP" value={`${formatNumber(wadToNumber(manifest.initialLiquidityYes ?? "0"))} WETH`} />
        <Metric label="Initial NO LP" value={`${formatNumber(wadToNumber(manifest.initialLiquidityNo ?? "0"))} WETH`} />
        <Metric label="ellActive" value={`${formatNumber(wadToNumber(reserves?.[4] ?? 0n))}`} />
        <Metric label="lambda" value={(wadToNumber(reserves?.[5] ?? 0n)).toFixed(4)} />
      </div>
      <ReserveBar label="Active exposed reserves" pct={activePct} value={`${formatNumber(wadToNumber(active))} shares`} />
      <ReserveBar label="Passive protected reserves" pct={passivePct} value={`${formatNumber(wadToNumber(passive))} shares`} />
      <p className="mt-4 rounded border border-white/10 p-3 font-mono text-xs text-white/65">
        ell_active = lambda*(P) * L0 * sqrt((T - t) / duration)
      </p>
    </Panel>
  );
}

function WCurvePanel({
  curve,
  currentPrice,
  currentLambda,
}: {
  curve: CurvePoint[];
  currentPrice: number;
  currentLambda: number;
}) {
  return (
    <Panel title="3. W-Curve from On-Chain Math Kernel">
      <svg viewBox="0 0 520 260" className="h-64 w-full rounded border border-white/10 bg-black/20">
        <line x1="40" y1="220" x2="500" y2="220" stroke="rgba(255,255,255,0.18)" />
        <line x1="40" y1="28" x2="40" y2="220" stroke="rgba(255,255,255,0.18)" />
        <path d={curvePath(curve)} fill="none" stroke="#34d399" strokeWidth="2.5" />
        <circle cx={xForP(currentPrice)} cy={yForLambda(currentLambda)} r="6" fill="white" />
        <text x="42" y="20" fill="rgba(255,255,255,0.65)" fontSize="12">lambda*(P)</text>
        <text x="454" y="238" fill="rgba(255,255,255,0.65)" fontSize="12">P(YES)</text>
        <text x={Math.min(410, xForP(currentPrice) + 10)} y={Math.max(24, yForLambda(currentLambda) - 10)} fill="white" fontSize="12">
          P={(currentPrice * 100).toFixed(2)}%, lambda={currentLambda.toFixed(3)}
        </text>
      </svg>
      <p className="mt-3 text-sm text-white/60">
        Curve points are read from the deployed math contract via `lambdaStarGaussian`, not reimplemented in JavaScript.
      </p>
    </Panel>
  );
}

function LvrPanel({ lvr }: { lvr: ReturnType<typeof computeLvr> }) {
  return (
    <Panel title="4. Cumulative LVR Saved">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Constant lambda=0.5" value={`${formatNumber(lvr.constant)} WETH`} />
        <Metric label="Actual dynamic lambda" value={`${formatNumber(lvr.dynamic)} WETH`} />
        <Metric label="LVR saved" value={`${formatNumber(Math.max(0, lvr.constant - lvr.dynamic))} WETH`} />
      </div>
      <p className="mt-4 text-sm text-white/60">
        Counterfactual analytic LVR from indexed z-space `gapWad`; this is not an on-chain balance transfer.
      </p>
    </Panel>
  );
}

function LendingPanel({ manifest, chainState }: { manifest: DemoManifest; chainState: ChainState | null }) {
  const seeded = Boolean(manifest.lending && manifest.lending !== ZERO_ADDRESS);
  return (
    <Panel title="5. Zero-Liquidation Lending">
      {seeded ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="YES-WETH collateral" value={`${formatNumber(wadToNumber(chainState?.lendingCollateral ?? manifest.lendingCollateral ?? "0"))} WETH`} />
            <Metric label="YES-USDC debt" value={`${formatNumber(wadToNumber(chainState?.lendingDebt ?? manifest.lendingDebt ?? "0"))} USDC`} />
          </div>
          <AddressLine label="Lending" value={manifest.lending} />
          <p className="mt-4 text-sm text-white/60">
            Collateral and debt share the same YES outcome, so market probability swings do not create a forced liquidation path.
          </p>
        </>
      ) : (
        <p className="text-sm text-white/55">
          Lending was not seeded for this run. Set `ORACLE_ADDRESS` before running the setup script to deploy and display a demo lending position.
        </p>
      )}
    </Panel>
  );
}

function ProofPanel({
  manifest,
  chainState,
  trades,
  proofZ,
  stylusVerified,
}: {
  manifest: DemoManifest;
  chainState: ChainState | null;
  trades: TradeRow[];
  proofZ: Record<string, bigint>;
  stylusVerified: boolean;
}) {
  return (
    <Panel title="6. On-Chain Proof Strip">
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded border border-white/15 px-2 py-1">
          {stylusVerified ? "✓ Stylus kernel" : "Solidity fallback / unverified math"}
        </span>
        <span className="rounded border border-white/15 px-2 py-1">
          dynamic={String(chainState?.useDynamicLambda ?? false)}
        </span>
      </div>
      <AddressLine label="Pool math()" value={chainState?.math} />
      <AddressLine label="Manifest math" value={manifest.math} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="text-white/45">
            <tr>
              <th className="py-2">Block</th>
              <th>Tx</th>
              <th>Side</th>
              <th>Size</th>
              <th>P</th>
              <th>z</th>
              <th>lambda</th>
              <th>ell</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id} className="border-t border-white/10">
                <td className="py-2">{trade.blockNumber}</td>
                <td>
                  <a className="text-emerald-300" href={arbiscanTx(trade.txHash)} target="_blank" rel="noreferrer">
                    {shorten(trade.txHash)}
                  </a>
                </td>
                <td>{trade.sideLabel}</td>
                <td>{formatNumber(wadToNumber(trade.size))}</td>
                <td>{(wadToNumber(trade.priceAfter) * 100).toFixed(2)}%</td>
                <td>{formatSignedWad(proofZ[trade.id])}</td>
                <td>{wadToNumber(trade.lambdaWad).toFixed(4)}</td>
                <td>{formatNumber(wadToNumber(trade.ellWad))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h2 className="mb-3 text-base font-medium">{title}</h2>
      {children}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 p-3">
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-1 break-words font-mono text-sm">{value}</div>
    </div>
  );
}

function AddressLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="mt-3 flex gap-3 text-xs">
      <span className="w-24 shrink-0 text-white/45">{label}</span>
      <span className="break-all font-mono text-white/70">{value}</span>
    </div>
  );
}

function ReserveBar({ label, pct, value }: { label: string; pct: number; value: string }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex justify-between text-xs text-white/55">
        <span>{label}</span>
        <span>{value} · {pct.toFixed(1)}%</span>
      </div>
      <div className="h-4 overflow-hidden rounded bg-white/10">
        <div className="h-full bg-emerald-400/80" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function StatusLine({ text }: { text: string }) {
  return <div className="mb-6 rounded border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">{text}</div>;
}

function selectMarket(markets: MarketRow[], manifest: DemoManifest) {
  return (
    markets.find((market) => market.id === manifest.conditionId) ??
    markets.find((market) => sameAddress(market.poolWeth, manifest.poolWeth)) ??
    markets.find((market) => manifest.symbol && market.symbol === manifest.symbol && market.category === "demo")
  );
}

function filterTrades(trades: TradeRow[], manifest: DemoManifest, market?: MarketRow) {
  const pool = manifest.poolWeth ?? market?.poolWeth;
  const conditionId = manifest.conditionId ?? market?.id;
  return trades.filter(
    (trade) =>
      trade.poolType === "WETH" &&
      (sameAddress(trade.pool, pool) || (conditionId && trade.conditionId === conditionId)),
  );
}

function filterRebalances(rebalances: RebalanceRow[], manifest: DemoManifest, market?: MarketRow) {
  const pool = manifest.poolWeth ?? market?.poolWeth;
  return rebalances.filter((rebalance) => rebalance.poolType === "WETH" && sameAddress(rebalance.pool, pool));
}

function computeLvr(trades: TradeRow[]) {
  return trades.reduce(
    (acc, trade) => {
      const p = Math.max(0.000001, Math.min(0.999999, wadToNumber(trade.priceAfter)));
      const z = normalInv(p);
      const phi = normalPdf(z);
      const v = phi + z * (2 * p - 1);
      const gap = wadToNumber(trade.gapWad);
      const actualLambda = Math.max(0.0001, wadToNumber(trade.lambdaWad));
      const baseLiquidity = wadToNumber(trade.ellWad) / actualLambda;
      const common = (phi / Math.max(0.000001, v)) * gap * gap;
      acc.dynamic += baseLiquidity * (actualLambda / 2) * common;
      acc.constant += baseLiquidity * (0.5 / 2) * common;
      return acc;
    },
    { constant: 0, dynamic: 0 },
  );
}

function buildProbabilitySamples() {
  const samples = [0.001, 0.005];
  for (let i = 1; i < 100; i += 2) samples.push(i / 100);
  samples.push(0.995, 0.999);
  return Array.from(new Set(samples)).sort((a, b) => a - b);
}

function probabilityToWad(p: number) {
  return BigInt(Math.round(p * 1e18));
}

function curvePath(points: CurvePoint[]) {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${xForP(point.p)} ${yForLambda(point.lambda)}`).join(" ");
}

function xForP(p: number) {
  return 40 + Math.max(0, Math.min(1, p)) * 460;
}

function yForLambda(lambda: number) {
  return 220 - Math.max(0, Math.min(1, lambda)) * 192;
}

function wadToNumber(value: string | bigint | undefined) {
  if (value === undefined) return 0;
  return Number(value) / 1e18;
}

function lastNumber<T extends Record<string, string>>(rows: T[], key: keyof T, fallback: number) {
  const last = rows[rows.length - 1];
  return last ? wadToNumber(last[key]) : fallback;
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: value >= 100 ? 0 : 4 });
}

function formatSignedWad(value?: bigint) {
  if (value === undefined) return "...";
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  return `${sign}${(Number(abs) / 1e18).toFixed(4)}`;
}

function sameAddress(a?: string, b?: string) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function shorten(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function arbiscanTx(hash: string) {
  return `https://sepolia.arbiscan.io/tx/${hash}`;
}

function normalPdf(z: number) {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

function normalInv(p: number) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const plow = 0.02425;
  const phigh = 1 - plow;

  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
    / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
