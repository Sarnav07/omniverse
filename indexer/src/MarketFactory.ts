import { ponder } from "ponder:registry";
import { market } from "../ponder.schema";
import { PmAmmPoolAbi } from "../abis/PmAmmPool";
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
    question,
    symbol,
    category,
  } = event.args;

  // 1. Cache the pool addresses to poolType & conditionId for downstream handlers.
  // This allows the PmAmmPool handlers (which don't know the conditionId inherently)
  // to correctly tag Trades and Rebalances with their conditionId.
  registerPool(poolWeth, conditionId, "WETH");
  registerPool(poolUsdc, conditionId, "USDC");

  // 2. Read the lambda mode from the WETH pool. Current PmAmmPool source has
  // `bool public useDynamicLambda`, but older Sepolia pools may predate the
  // getter. If the RPC node has pruned state ("missing trie node"), default to true.
  let useDynamicLambda: boolean = true; // Safe default for modern pools
  try {
    useDynamicLambda = await context.client.readContract({
      abi: PmAmmPoolAbi,
      address: poolWeth,
      functionName: "useDynamicLambda",
    });
  } catch (error: any) {
    // RPC state unavailable (pruned node, missing trie, etc.) — log and continue
    context.logger.warn(
      `Failed to read useDynamicLambda for pool ${poolWeth} at block ${event.block.number}: ${error?.shortMessage ?? error?.message ?? "unknown error"}. Defaulting to true.`
    );
  }

  // 3. Insert the Market row.
  await db
    .insert(market)
    .values({
      id: conditionId,
      questionId,
      question,
      symbol,
      category,
      resolver,
      poolWeth,
      poolUsdc,
      wethMarketId,
      usdcMarketId,
      createdAt: Number(event.block.timestamp),
      createdBlock: Number(event.block.number),
      useDynamicLambda,
      resolved: false,
      yesWon: null, // Will be set by Resolver:Resolved
      totalVolumeWeth: 0n,
      totalVolumeUsdc: 0n,
      lastPriceWeth: DEFAULT_PRICE_WAD,
      lastPriceUsdc: DEFAULT_PRICE_WAD,
      tradeCount: 0,
    })
    .onConflictDoNothing();
});
