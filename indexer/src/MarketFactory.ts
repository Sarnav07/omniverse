import { ponder } from "ponder:registry";
import { market } from "../ponder.schema";
import { registerPool, DEFAULT_PRICE_WAD } from "./utils";

ponder.on("MarketFactory:EventCreated", async ({ event, context }) => {
  const { db } = context;
  const {
    conditionId,
    questionId,
    resolver,
    poolWeth,
    poolUsdc,
    wethMarketId,
    usdcMarketId,
  } = event.args;

  // 1. Cache the pool addresses to poolType & conditionId for downstream handlers.
  // This allows the PmAmmPool handlers (which don't know the conditionId inherently)
  // to correctly tag Trades and Rebalances with their conditionId.
  registerPool(poolWeth, conditionId, "WETH");
  registerPool(poolUsdc, conditionId, "USDC");

  // 2. Insert the Market row.
  await db.insert(market).values({
    id: conditionId,
    questionId,
    resolver,
    poolWeth,
    poolUsdc,
    wethMarketId,
    usdcMarketId,
    createdAt: Number(event.block.timestamp),
    createdBlock: Number(event.block.number),
    resolved: false,
    yesWon: null, // Will be set by Resolver:Resolved
    totalVolumeWeth: 0n,
    totalVolumeUsdc: 0n,
    lastPriceWeth: DEFAULT_PRICE_WAD,
    lastPriceUsdc: DEFAULT_PRICE_WAD,
    tradeCount: 0,
  });
});
