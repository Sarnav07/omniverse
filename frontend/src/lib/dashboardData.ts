import { DemoManifest } from "@/hooks/useDemoManifest";
import { PoolReserves } from "@/hooks/useLiveDemoReads";
import { wadToNumber } from "./formatters";

export type DemoTrade = {
  id: string;
  side: number;
  sideLabel: string;
  size: bigint;
  priceAfter: bigint;
  lambdaWad: bigint;
  ellWad: bigint;
  gapWad: bigint;
  trader: `0x${string}`;
  txHash: string;
  blockNumber: number;
  timestamp: number;
};

export type DashboardData = {
  price: bigint | undefined;
  priceFloat: number;
  priceSource: "live" | "indexed" | "unavailable";
  activePct: number | undefined;
  passivePct: number | undefined;
  reserveSource: "live" | "unavailable";
  lambdaWad: bigint | undefined;
  attackTrades: DemoTrade[];
  allTrades: DemoTrade[];
};

export function assembleDashboardData(
  manifest: DemoManifest,
  livePrice: bigint | undefined,
  liveReserves: PoolReserves | undefined,
  indexedTrades: DemoTrade[],
): DashboardData {
  const priceSource =
    livePrice !== undefined ? "live" : indexedTrades.length > 0 ? "indexed" : "unavailable";
  const displayPrice = livePrice !== undefined ? livePrice : indexedTrades[0]?.priceAfter;
  const priceFloat =
    displayPrice !== undefined ? Math.max(0, Math.min(1, wadToNumber(displayPrice))) : 0.5;

  let activePct: number | undefined = undefined;
  let passivePct: number | undefined = undefined;
  let reserveSource: "live" | "unavailable" = "unavailable";

  if (liveReserves) {
    const activeTotal = liveReserves.xActive + liveReserves.yActive;
    const totalReserves = activeTotal + liveReserves.xPassive + liveReserves.yPassive;

    if (totalReserves > 0n) {
      activePct = Number((activeTotal * 100n) / totalReserves);
      passivePct = 100 - activePct;
    } else {
      activePct = 0;
      passivePct = 100;
    }
    reserveSource = "live";
  }

  const attackTrades = indexedTrades
    .filter((t) => t.side === 0)
    .sort((a, b) => Number(a.size) - Number(b.size))
    .slice(0, 3);

  const lambdaWad = liveReserves?.lambdaWad ?? indexedTrades[0]?.lambdaWad;

  return {
    price: displayPrice,
    priceFloat,
    priceSource,
    activePct,
    passivePct,
    reserveSource,
    lambdaWad,
    attackTrades,
    allTrades: indexedTrades,
  };
}
