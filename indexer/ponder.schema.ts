import { onchainTable } from "ponder";

// ─────────────────────────────────────────────────────────────────────────────
// Market — one row per prediction market event (conditionId is unique)
// ─────────────────────────────────────────────────────────────────────────────
export const market = onchainTable("market", (t) => ({
  id: t.text().primaryKey(),                // conditionId (bytes32 hex)
  questionId: t.text().notNull(),           // bytes32 hex
  resolver: t.hex().notNull(),              // resolver contract address
  poolWeth: t.hex().notNull(),              // WETH pool address
  poolUsdc: t.hex().notNull(),              // USDC pool address
  wethMarketId: t.bigint().notNull(),       // sequential pool ID
  usdcMarketId: t.bigint().notNull(),       // sequential pool ID
  createdAt: t.integer().notNull(),         // block timestamp
  createdBlock: t.integer().notNull(),      // block number
  resolved: t.boolean().notNull(),          // has the event been resolved?
  yesWon: t.boolean(),                      // resolution outcome (null if unresolved)
  totalVolumeWeth: t.bigint().notNull(),    // sum of trade.size on WETH pool (WAD)
  totalVolumeUsdc: t.bigint().notNull(),    // sum of trade.size on USDC pool (WAD)
  lastPriceWeth: t.bigint().notNull(),      // latest priceWad from WETH pool (WAD)
  lastPriceUsdc: t.bigint().notNull(),      // latest priceWad from USDC pool (WAD)
  tradeCount: t.integer().notNull(),        // total trades across both pools
}));

// ─────────────────────────────────────────────────────────────────────────────
// Trade — one row per swap (OmniverseTrade event)
// ─────────────────────────────────────────────────────────────────────────────
export const trade = onchainTable("trade", (t) => ({
  id: t.text().primaryKey(),                // txHash-logIndex
  marketId: t.bigint().notNull(),           // pool's sequential ID
  conditionId: t.text().notNull(),          // links to market.id
  pool: t.hex().notNull(),                  // pool contract address
  poolType: t.text().notNull(),             // "WETH" or "USDC"
  trader: t.hex().notNull(),                // trader address
  side: t.integer().notNull(),              // 0=buyYes, 1=sellYes, 2=buyNo, 3=sellNo
  sideLabel: t.text().notNull(),            // human-readable label
  size: t.bigint().notNull(),               // input amount (one-sided, WAD)
  priceAfter: t.bigint().notNull(),         // probability after trade (WAD)
  ellWad: t.bigint().notNull(),             // active liquidity used
  lambdaWad: t.bigint().notNull(),          // current lambda fraction
  gapWad: t.bigint().notNull(),             // price gap (signed, stored as bigint)
  timestamp: t.integer().notNull(),         // unix timestamp (from event)
  blockNumber: t.integer().notNull(),
  txHash: t.text().notNull(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// PriceSnapshot — one row per trade, powers the probability chart
// ─────────────────────────────────────────────────────────────────────────────
export const priceSnapshot = onchainTable("price_snapshot", (t) => ({
  id: t.text().primaryKey(),                // marketId-poolType-timestamp
  marketId: t.bigint().notNull(),
  pool: t.hex().notNull(),
  poolType: t.text().notNull(),             // "WETH" or "USDC"
  priceWad: t.bigint().notNull(),           // probability (WAD)
  lambdaWad: t.bigint().notNull(),
  ellWad: t.bigint().notNull(),
  timestamp: t.integer().notNull(),
  blockNumber: t.integer().notNull(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Rebalance — PA-AMM rebalance log (once per block, first interaction)
// ─────────────────────────────────────────────────────────────────────────────
export const rebalance = onchainTable("rebalance", (t) => ({
  id: t.text().primaryKey(),                // pool-blockNumber
  pool: t.hex().notNull(),
  poolType: t.text().notNull(),
  xActive: t.bigint().notNull(),            // NO active reserve
  yActive: t.bigint().notNull(),            // YES active reserve
  ellActive: t.bigint().notNull(),          // effective liquidity
  lambdaWad: t.bigint().notNull(),          // active fraction
  blockNumber: t.integer().notNull(),
  timestamp: t.integer().notNull(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// LiquidityEvent — LP add/remove activity
// ─────────────────────────────────────────────────────────────────────────────
export const liquidityEvent = onchainTable("liquidity_event", (t) => ({
  id: t.text().primaryKey(),                // txHash-logIndex
  pool: t.hex().notNull(),
  poolType: t.text().notNull(),
  provider: t.hex().notNull(),
  action: t.text().notNull(),               // "add" or "remove"
  yesAmount: t.bigint().notNull(),
  noAmount: t.bigint().notNull(),
  shares: t.bigint().notNull(),
  timestamp: t.integer().notNull(),
  blockNumber: t.integer().notNull(),
  txHash: t.text().notNull(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// LendingAction — all lending activity (P3: deposit/borrow/repay/withdraw/settle/claim)
// ─────────────────────────────────────────────────────────────────────────────
export const lendingAction = onchainTable("lending_action", (t) => ({
  id: t.text().primaryKey(),                // txHash-logIndex
  lending: t.hex().notNull(),               // MultiverseLending address
  user: t.hex().notNull(),                  // user or "protocol" for settle
  action: t.text().notNull(),               // "seed"|"deposit"|"borrow"|"repay"|"withdraw"|"settle"|"claim_borrower"|"claim_lender"
  amount: t.bigint(),                       // primary amount (null for settle)
  amount2: t.bigint(),                      // secondary (usdcOut for lender claim)
  yesWon: t.boolean(),                      // for settle events only
  timestamp: t.integer().notNull(),
  blockNumber: t.integer().notNull(),
  txHash: t.text().notNull(),
}));
