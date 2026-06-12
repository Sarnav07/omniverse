import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useMemo, useState, useEffect } from "react";
import { Nav } from "@/components/marketing/Nav";
import { MarketsHero } from "@/components/markets-hero";
import { CategoryFilters } from "@/components/category-filters";
import { HeaderStatsBar } from "@/components/header-stats-bar";
import { MarketGrid } from "@/components/market-grid";
import { PageFooter } from "@/components/page-footer";
import { Market } from "@/components/market-card";
import { useQuery } from "urql";
import { useReadContracts } from "wagmi";
import PmAmmPoolAbi from "@/abis/PmAmmPool.abi.json";
import { useDemoTrades } from "@/hooks/useDemoTrades";
import { useDemoManifest } from "@/hooks/useDemoManifest";
import { usePoolPrice } from "@/hooks/useLiveDemoReads";

const MARKETS_QUERY = `
  query {
    markets(limit: 50, orderBy: "createdAt", orderDirection: "desc") {
      items {
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
        conditionId
      }
    }
  }
`;

const DEMO_TRADES_QUERY = `
  query GetMarketTrades($conditionId: String!) {
    trades(
      where: { conditionId: $conditionId, poolType: "WETH" }
      orderBy: "timestamp"
      orderDirection: "asc"
      limit: 20
    ) {
      items {
        priceAfter
        blockNumber
      }
    }
  }
`;

export const Route = createFileRoute("/markets/")({
  head: () => ({
    meta: [
      { title: "Markets — Omniverse" },
      {
        name: "description",
        content:
          "Prediction markets and yield pools. Probability-bounded liquidity with zero-liquidation execution.",
      },
      { property: "og:title", content: "Markets — Omniverse" },
      {
        property: "og:description",
        content:
          "Prediction markets and yield pools. Probability-bounded liquidity with zero-liquidation execution.",
      },
    ],
  }),
  component: MarketsPage,
});

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };



/* ─────────────────────────────── page ─────────────────────────────── */

function MarketsPage() {
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: manifest } = useDemoManifest();
  const { price: wethUsdPriceWad } = usePoolPrice(manifest?.poolUsdc);

  const [result] = useQuery({
    query: MARKETS_QUERY,
    requestPolicy: "cache-and-network",
  });

  const { data, fetching, error } = result;
  const items = data?.markets?.items || [];

  // Batch read reserves for all pools
  const reservesContracts = useMemo(() => {
    return items.flatMap((item: any) => {
      const contracts = [];
      if (item.poolWeth) {
        contracts.push({
          address: item.poolWeth as `0x${string}`,
          abi: PmAmmPoolAbi,
          functionName: "getReserves" as const,
        });
      }
      if (item.poolUsdc) {
        contracts.push({
          address: item.poolUsdc as `0x${string}`,
          abi: PmAmmPoolAbi,
          functionName: "getReserves" as const,
        });
      }
      return contracts;
    });
  }, [items]);

  const { data: reservesData, isLoading: reservesLoading } = useReadContracts({
    contracts: reservesContracts,
    query: { enabled: reservesContracts.length > 0, refetchInterval: 5_000 },
  });

  // Query trades for all markets
  const [tradesResults] = useQuery({
    query: `
      query GetAllTrades {
        ${items.map((item: any, idx: number) => `
          trades${idx}: trades(
            where: { conditionId: "${item.conditionId}", poolType: "WETH" }
            orderBy: "timestamp"
            orderDirection: "asc"
            limit: 20
          ) {
            items {
              priceAfter
            }
          }
        `).join('\n')}
      }
    `,
    pause: items.length === 0,
    requestPolicy: "cache-and-network",
  });

  const filteredMarkets = useMemo(() => {
    const wethPrice = wethUsdPriceWad ? Number(wethUsdPriceWad) / 1e18 : 3000;

    const combined = items.map((item: any, idx: number) => {
      const yesPrice = Number(item.lastPriceWeth) / 1e18;
      const volWeth = Number(item.totalVolumeWeth) / 1e18;
      const volUsdc = Number(item.totalVolumeUsdc) / 1e18;
      const vol = volWeth + volUsdc;
      
      // Calculate TVL from pool reserves
      let tvl = 0;
      let reserveIdx = 0;
      
      // Count how many pools came before this item
      for (let i = 0; i < idx; i++) {
        if (items[i].poolWeth) reserveIdx++;
        if (items[i].poolUsdc) reserveIdx++;
      }

      // Read WETH pool reserves
      if (item.poolWeth && reservesData && reservesData[reserveIdx]) {
        const result = reservesData[reserveIdx];
        if (result.status === "success") {
          const reserves = result.result as [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
          const xActive = Number(reserves[0]) / 1e18;
          const yActive = Number(reserves[2]) / 1e18;
          tvl += (xActive * wethPrice) + yActive;
        }
        reserveIdx++;
      }

      // Read USDC pool reserves
      if (item.poolUsdc && reservesData && reservesData[reserveIdx]) {
        const result = reservesData[reserveIdx];
        if (result.status === "success") {
          const reserves = result.result as [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
          const xActive = Number(reserves[0]) / 1e18;
          const yActive = Number(reserves[2]) / 1e18;
          tvl += xActive + yActive; // USDC pool is already in USD
        }
      }

      // Build sparkline from trade history
      let curve: number[] = [];
      const tradesKey = `trades${idx}`;
      if (tradesResults.data && tradesResults.data[tradesKey]) {
        const trades = tradesResults.data[tradesKey].items || [];
        if (trades.length > 0) {
          curve = trades.map((t: any) => Number(t.priceAfter) / 1e18);
        }
      }
      // Flat line at current price if no trades
      if (curve.length === 0) {
        curve = [yesPrice > 0 ? yesPrice : 0.5, yesPrice > 0 ? yesPrice : 0.5];
      }

      return {
        id: item.id,
        symbol: item.symbol,
        question: item.question,
        category: item.category || "macro",
        yes: yesPrice > 0 ? yesPrice : 0.5,
        volumeNum: vol,
        volume: vol > 0 ? `$${(vol / 1000).toFixed(1)}k` : "$0.00",
        tvlNum: tvl,
        tvl: reservesLoading ? "⋯" : tvl > 0 ? `$${(tvl / 1000).toFixed(1)}k` : "$0.00",
        apr: "—",
        curve,
        trend: curve.length > 1 && curve[curve.length - 1] >= curve[0] ? "up" as const : "down" as const,
        conditionId: item.conditionId,
        poolWeth: item.poolWeth,
      };
    });

    const displayList = combined;

    if (activeCategory === "all") return displayList;
    return displayList.filter((m: any) => m.category.toLowerCase() === activeCategory);
  }, [activeCategory, data, items, reservesData, reservesLoading, tradesResults, wethUsdPriceWad]);

  const { headerTvl, headerVol } = useMemo(() => {
    let t = 0;
    let v = 0;
    for (const m of filteredMarkets) {
      t += m.tvlNum || 0;
      v += m.volumeNum || 0;
    }
    return {
      headerTvl: reservesLoading ? "⋯" : t > 0 ? `$${(t / 1000).toFixed(1)}k` : "$0.00",
      headerVol: v > 0 ? `$${(v / 1000).toFixed(1)}k` : "$0.00",
    };
  }, [filteredMarkets, reservesLoading]);

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#08080A] text-[#F3F4F6] relative font-sans antialiased">
      <div
        className="fixed inset-0 opacity-[0.025] mix-blend-overlay pointer-events-none z-50"
        style={{ backgroundImage: "url('/noise.svg')" }}
      />

      <Nav appMode />

      <main className="max-w-[1400px] w-full mx-auto px-6 flex-1 flex flex-col">
        <MarketsHero />

        <CategoryFilters activeCategory={activeCategory} onChange={setActiveCategory} />

        <HeaderStatsBar 
          tvl={headerTvl}
          volume={headerVol}
          activeMarkets={fetching ? "..." : filteredMarkets.length.toString()}
          latency="218ms"
          solverAgents={fetching ? "..." : String(filteredMarkets.length * 42)}
        />

        <MarketGrid markets={filteredMarkets as Market[]} />
      </main>

      <PageFooter marketCount={filteredMarkets.length} />
    </div>
  );
}


