import { ponder } from "ponder:registry";
import { market, trade, priceSnapshot, rebalance, liquidityEvent } from "../ponder.schema";
import { getPoolMeta, sideLabel } from "./utils";

/**
 * Helper to process OmniverseTrade events.
 * Both WETH and USDC pools emit the same event, but we registered them as separate
 * contracts in ponder.config.ts so we can reuse the logic cleanly.
 */
async function handleOmniverseTrade({ event, context }: any) {
  const { db } = context;
  const {
    marketId,
    trader,
    side,
    size,
    priceWad,
    ellWad,
    lambdaWad,
    gapWad,
    timestamp,
  } = event.args;

  const poolAddress = event.log.address;
  const meta = getPoolMeta(poolAddress);
  // Fallbacks in case EventCreated hasn't synced (shouldn't happen sequentially)
  const conditionId = meta?.conditionId ?? "unknown";
  const poolType = meta?.poolType ?? "UNKNOWN";

  // 1. Insert Trade row
  await db
    .insert(trade)
    .values({
      id: `${event.transaction.hash}-${event.log.logIndex}`,
      marketId,
      conditionId,
      pool: poolAddress,
      poolType,
      trader,
      side,
      sideLabel: sideLabel(side),
      size,
      priceAfter: priceWad,
      ellWad,
      lambdaWad,
      gapWad,
      timestamp: Number(timestamp),
      blockNumber: Number(event.block.number),
      txHash: event.transaction.hash,
    })
    .onConflictDoNothing();

  // 2. Insert PriceSnapshot row for the chart
  await db
    .insert(priceSnapshot)
    .values({
      id: `${marketId}-${poolType}-${timestamp}`,
      marketId,
      pool: poolAddress,
      poolType,
      priceWad,
      lambdaWad,
      ellWad,
      timestamp: Number(timestamp),
      blockNumber: Number(event.block.number),
    })
    .onConflictDoNothing();

  // 3. Update Market aggregates
  // Only update if conditionId is known
  if (meta) {
    // We must read the current market row to increment values.
    // In Ponder v0.9, you can fetch and then update, or use SQL-like increments if supported.
    // We'll fetch, then update for safety.
    const currentMarket = await db.find(market, { id: conditionId });
    if (currentMarket) {
      if (poolType === "WETH") {
        await db.update(market, { id: conditionId }).set({
          totalVolumeWeth: currentMarket.totalVolumeWeth + size, // ONE-SIDED ADDITION
          lastPriceWeth: priceWad,
          tradeCount: currentMarket.tradeCount + 1,
        });
      } else if (poolType === "USDC") {
        await db.update(market, { id: conditionId }).set({
          totalVolumeUsdc: currentMarket.totalVolumeUsdc + size, // ONE-SIDED ADDITION
          lastPriceUsdc: priceWad,
          tradeCount: currentMarket.tradeCount + 1,
        });
      }
    }
  }
}

/**
 * Helper to process Rebalanced events.
 */
async function handleRebalanced({ event, context }: any) {
  const { db } = context;
  const { xActive, yActive, ellActive, lambdaWad, blockNumber } = event.args;

  const poolAddress = event.log.address;
  const poolType = getPoolMeta(poolAddress)?.poolType ?? "UNKNOWN";

  await db
    .insert(rebalance)
    .values({
      id: `${poolAddress}-${blockNumber}`,
      pool: poolAddress,
      poolType,
      xActive,
      yActive,
      ellActive,
      lambdaWad,
      blockNumber: Number(blockNumber),
      timestamp: Number(event.block.timestamp),
    })
    .onConflictDoNothing();
}

/**
 * Helper to process Liquidity events.
 */
async function handleLiquidity(event: any, context: any, action: "add" | "remove") {
  const { db } = context;
  const { provider, yesAmount, noAmount, shares } = event.args;

  const poolAddress = event.log.address;
  const poolType = getPoolMeta(poolAddress)?.poolType ?? "UNKNOWN";

  await db
    .insert(liquidityEvent)
    .values({
      id: `${event.transaction.hash}-${event.log.logIndex}`,
      pool: poolAddress,
      poolType,
      provider,
      action,
      yesAmount,
      noAmount,
      shares,
      timestamp: Number(event.block.timestamp),
      blockNumber: Number(event.block.number),
      txHash: event.transaction.hash,
    })
    .onConflictDoNothing();
}

// Register handlers for WETH pool
ponder.on("PmAmmPoolWeth:OmniverseTrade", handleOmniverseTrade);
ponder.on("PmAmmPoolWeth:Rebalanced", handleRebalanced);
ponder.on("PmAmmPoolWeth:LiquidityAdded", async ({ event, context }) => handleLiquidity(event, context, "add"));
ponder.on("PmAmmPoolWeth:LiquidityRemoved", async ({ event, context }) => handleLiquidity(event, context, "remove"));

// Register handlers for USDC pool
ponder.on("PmAmmPoolUsdc:OmniverseTrade", handleOmniverseTrade);
ponder.on("PmAmmPoolUsdc:Rebalanced", handleRebalanced);
ponder.on("PmAmmPoolUsdc:LiquidityAdded", async ({ event, context }) => handleLiquidity(event, context, "add"));
ponder.on("PmAmmPoolUsdc:LiquidityRemoved", async ({ event, context }) => handleLiquidity(event, context, "remove"));
