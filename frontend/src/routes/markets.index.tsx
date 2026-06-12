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

  const [result] = useQuery({
    query: MARKETS_QUERY,
    requestPolicy: "cache-and-network",
  });

  const { data, fetching, error } = result;

  const filteredMarkets = useMemo(() => {
    const items = data?.markets?.items || [];

    const combined = items.map((item: any) => {
      const yesPrice = Number(item.lastPriceWeth) / 1e18;
      const volWeth = Number(item.totalVolumeWeth) / 1e18;
      const volUsdc = Number(item.totalVolumeUsdc) / 1e18;
      const vol = volWeth + volUsdc;
      
      // TVL calculation from pool reserves would go here - placeholder for now
      const tvl = 0;

      // Simple flat curve fallback until Ponder swap history is available
      const curve = [yesPrice > 0 ? yesPrice : 0.5, yesPrice > 0 ? yesPrice : 0.5];

      return {
        id: item.id,
        symbol: item.symbol,
        question: item.question,
        category: item.category || "macro",
        yes: yesPrice > 0 ? yesPrice : 0.5,
        volumeNum: vol,
        volume: vol > 0 ? `$${(vol / 1000).toFixed(1)}k` : "$0.00",
        tvlNum: tvl,
        tvl: "—",
        apr: "—",
        curve,
        trend: "up",
      };
    });

    const displayList = combined;

    if (activeCategory === "all") return displayList;
    return displayList.filter((m: any) => m.category.toLowerCase() === activeCategory);
  }, [activeCategory, data]);

  const { headerTvl, headerVol } = useMemo(() => {
    let t = 0;
    let v = 0;
    for (const m of filteredMarkets) {
      t += m.tvlNum || 0;
      v += m.volumeNum || 0;
    }
    return {
      headerTvl: t > 0 ? `$${(t / 1000).toFixed(1)}k` : "$0.00",
      headerVol: v > 0 ? `$${(v / 1000).toFixed(1)}k` : "$0.00",
    };
  }, [filteredMarkets]);

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


