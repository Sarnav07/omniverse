# OMNIVERSE Indexer — Requirements Document

> **Purpose:** Complete specification for building the Ponder indexer that powers the frontend's historical data, charts, and aggregates.

---

## 1. Why an Indexer?

Smart contracts emit events but don't store history. The frontend needs:

| Need | Why Not Direct RPC? |
|------|-------------------|
| Price history chart (probability over time) | Can't query past events cheaply; need a time-series |
| 24h / total volume | Requires summing all past `OmniverseTrade` events |
| Market list with sparklines | Need recent price snapshots per market |
| Trade history table | Need paginated, sorted past trades |
| LP activity log | Need historical add/remove liquidity events |
| Lending position history | Need deposit/borrow/repay/settle event log |

**Choice: [Ponder](https://ponder.sh)** — TypeScript-native indexer with auto-generated GraphQL, simpler than The Graph (which deprecated hosted service). Alternatives: Envio, Goldsky, or a custom Node.js indexer.

---

## 2. On-Chain Events to Index

### 2.1 PmAmmPool Events (the primary data source)

These are emitted by every deployed `PmAmmPool` contract (one per collateral universe per market).

```solidity
// Emitted on every swap (buyYes or buyNo)
event OmniverseTrade(
    uint256 indexed marketId,   // Pool's sequential ID from MarketFactory
    address indexed trader,     // Who traded
    uint8   side,               // 0=buyYes, 1=sellYes, 2=buyNo, 3=sellNo
    uint256 size,               // Input amount (one-sided, WAD)
    uint256 priceWad,           // Probability AFTER the trade, in WAD [0, 1e18]
    uint256 ellWad,             // Active liquidity L used for this trade (WAD)
    uint256 lambdaWad,          // Current λ active fraction (WAD)
    int256  gapWad,             // ln(P_active / P_full) gap (WAD); 0 until gap is wired
    uint64  timestamp           // block.timestamp
);

// Emitted on PA-AMM rebalance (once per block, first interaction)
event Rebalanced(
    uint256 xActive,            // New NO active reserve
    uint256 yActive,            // New YES active reserve
    uint256 ellActive,          // New effective liquidity
    uint256 lambdaWad,          // New λ
    uint256 blockNumber         // Block that triggered rebalance
);

// Emitted on liquidity add
event LiquidityAdded(
    address indexed provider,
    uint256 yesAmount,
    uint256 noAmount,
    uint256 shares
);

// Emitted on liquidity remove
event LiquidityRemoved(
    address indexed provider,
    uint256 yesAmount,
    uint256 noAmount,
    uint256 shares
);
```

### 2.2 MultiverseLending Events

```solidity
event ReserveSeeded(address indexed from, uint256 amount);
event Deposited(address indexed user, uint256 amount);
event Borrowed(address indexed user, uint256 amount);
event Repaid(address indexed user, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);
event Settled(bool yesWon, uint256 pEth, uint256 wethRedeemed, uint256 usdcRedeemed);
event BorrowerClaimed(address indexed user, uint256 wethOut);
event LenderClaimed(address indexed user, uint256 wethOut, uint256 usdcOut);
```

### 2.3 MarketFactory Events

```solidity
event EventCreated(
    bytes32 indexed conditionId,
    bytes32 indexed questionId,
    address resolver,
    address poolWeth,
    address poolUsdc,
    uint256 wethMarketId,
    uint256 usdcMarketId
);
```

### 2.4 Resolver Events

```solidity
event Resolved(bytes32 indexed questionId, uint256[] payouts);
```

---

## 3. Data Models (Ponder Schema)

### 3.1 `Market` — One row per prediction market event

```typescript
// ponder.schema.ts
import { createSchema } from "@ponder/core";

export default createSchema((p) => ({
  Market: p.createTable({
    id: p.string(),                    // conditionId (bytes32 as hex string)
    questionId: p.string(),            // bytes32 hex
    resolver: p.string(),              // address
    poolWeth: p.string(),              // address of WETH pool
    poolUsdc: p.string(),              // address of USDC pool
    wethMarketId: p.bigint(),          // sequential ID
    usdcMarketId: p.bigint(),          // sequential ID
    createdAt: p.int(),                // block timestamp
    createdBlock: p.int(),             // block number
    resolved: p.boolean(),            // has event been resolved?
    yesWon: p.boolean().optional(),    // resolution outcome
    totalVolumeWeth: p.bigint(),       // sum of all trade sizes on WETH pool (WAD)
    totalVolumeUsdc: p.bigint(),       // sum of all trade sizes on USDC pool (WAD)
    lastPriceWeth: p.bigint(),         // latest priceWad from WETH pool
    lastPriceUsdc: p.bigint(),         // latest priceWad from USDC pool
    tradeCount: p.int(),               // total number of trades across both pools
  }),
}));
```

### 3.2 `Trade` — One row per swap

```typescript
Trade: p.createTable({
  id: p.string(),                      // txHash-logIndex
  marketId: p.bigint(),                // from event
  conditionId: p.string(),            // derived from pool → factory lookup
  pool: p.string(),                    // pool contract address
  poolType: p.string(),                // "WETH" or "USDC"
  trader: p.string(),                  // address
  side: p.int(),                       // 0=buyYes, 1=sellYes, 2=buyNo, 3=sellNo
  sideLabel: p.string(),              // human-readable: "Buy YES", "Buy NO", etc.
  size: p.bigint(),                    // input amount (WAD)
  priceAfter: p.bigint(),             // probability after trade (WAD)
  ellWad: p.bigint(),                  // active liquidity
  lambdaWad: p.bigint(),              // active fraction
  gapWad: p.bigint(),                 // price gap (signed, stored as bigint)
  timestamp: p.int(),                  // unix timestamp
  blockNumber: p.int(),
  txHash: p.string(),
}),
```

### 3.3 `PriceSnapshot` — Sampled price points for charts

```typescript
PriceSnapshot: p.createTable({
  id: p.string(),                      // marketId-timestamp (bucketed)
  marketId: p.bigint(),
  pool: p.string(),
  poolType: p.string(),                // "WETH" or "USDC"
  priceWad: p.bigint(),                // probability (WAD)
  lambdaWad: p.bigint(),
  ellWad: p.bigint(),
  timestamp: p.int(),
  blockNumber: p.int(),
}),
```

### 3.4 `LiquidityEvent` — LP activity

```typescript
LiquidityEvent: p.createTable({
  id: p.string(),                      // txHash-logIndex
  pool: p.string(),
  provider: p.string(),
  action: p.string(),                  // "add" or "remove"
  yesAmount: p.bigint(),
  noAmount: p.bigint(),
  shares: p.bigint(),
  timestamp: p.int(),
  blockNumber: p.int(),
  txHash: p.string(),
}),
```

### 3.5 `LendingAction` — Lending activity log

```typescript
LendingAction: p.createTable({
  id: p.string(),                      // txHash-logIndex
  lending: p.string(),                 // MultiverseLending address
  user: p.string(),
  action: p.string(),                  // "seed" | "deposit" | "borrow" | "repay" | "withdraw" | "settle" | "claimBorrower" | "claimLender"
  amount: p.bigint().optional(),       // primary amount
  amount2: p.bigint().optional(),      // secondary (e.g., usdcOut for lender claim)
  yesWon: p.boolean().optional(),      // for settle events
  timestamp: p.int(),
  blockNumber: p.int(),
  txHash: p.string(),
}),
```

### 3.6 `Rebalance` — PA-AMM rebalance log

```typescript
Rebalance: p.createTable({
  id: p.string(),                      // pool-blockNumber
  pool: p.string(),
  xActive: p.bigint(),
  yActive: p.bigint(),
  ellActive: p.bigint(),
  lambdaWad: p.bigint(),
  blockNumber: p.int(),
  timestamp: p.int(),
}),
```

---

## 4. Event Handlers (Ponder Logic)

### 4.1 `OmniverseTrade` Handler — The Core

```typescript
// src/PmAmmPool.ts
import { ponder } from "@/generated";

ponder.on("PmAmmPool:OmniverseTrade", async ({ event, context }) => {
  const { db } = context;
  const { marketId, trader, side, size, priceWad, ellWad, lambdaWad, gapWad, timestamp } = event.args;

  // Determine pool type from address → factory lookup (cached at startup)
  const poolAddress = event.log.address;
  const poolType = getPoolType(poolAddress); // "WETH" or "USDC"
  const conditionId = getConditionId(poolAddress); // cached

  const sideLabels = ["Buy YES", "Sell YES", "Buy NO", "Sell NO"];

  // 1. Insert Trade
  await db.Trade.create({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    data: {
      marketId,
      conditionId,
      pool: poolAddress,
      poolType,
      trader,
      side,
      sideLabel: sideLabels[side] ?? "Unknown",
      size,
      priceAfter: priceWad,
      ellWad,
      lambdaWad,
      gapWad,
      timestamp: Number(timestamp),
      blockNumber: Number(event.block.number),
      txHash: event.transaction.hash,
    },
  });

  // 2. Update Market aggregates
  const volumeField = poolType === "WETH" ? "totalVolumeWeth" : "totalVolumeUsdc";
  const priceField = poolType === "WETH" ? "lastPriceWeth" : "lastPriceUsdc";

  await db.Market.update({
    id: conditionId,
    data: ({ current }) => ({
      [volumeField]: (current[volumeField] ?? 0n) + size,
      [priceField]: priceWad,
      tradeCount: (current.tradeCount ?? 0) + 1,
    }),
  });

  // 3. Insert PriceSnapshot (for charts)
  await db.PriceSnapshot.create({
    id: `${marketId}-${timestamp}`,
    data: {
      marketId,
      pool: poolAddress,
      poolType,
      priceWad,
      lambdaWad,
      ellWad,
      timestamp: Number(timestamp),
      blockNumber: Number(event.block.number),
    },
  });
});
```

### 4.2 Volume Accounting Rules

> **Critical: One-sided volume only.** Sum `size` (the input amount) per trade. Do NOT double-count by adding both input and output. This matches the event schema where `size` is the one-sided notional.

```typescript
// ✅ Correct: sum only the input side
totalVolume += trade.size;

// ❌ Wrong: would double-count
totalVolume += trade.size + trade.output;
```

For **24h volume**, filter client-side:
```graphql
query Volume24h($marketId: BigInt!, $since: Int!) {
  trades(where: { marketId: $marketId, timestamp_gte: $since }) {
    size
  }
}
```
Where `since = Math.floor(Date.now() / 1000) - 86400`.

### 4.3 Other Handlers

```typescript
// MarketFactory:EventCreated → create Market row
ponder.on("MarketFactory:EventCreated", async ({ event, context }) => {
  await context.db.Market.create({
    id: event.args.conditionId,
    data: {
      questionId: event.args.questionId,
      resolver: event.args.resolver,
      poolWeth: event.args.poolWeth,
      poolUsdc: event.args.poolUsdc,
      wethMarketId: event.args.wethMarketId,
      usdcMarketId: event.args.usdcMarketId,
      createdAt: Number(event.block.timestamp),
      createdBlock: Number(event.block.number),
      resolved: false,
      totalVolumeWeth: 0n,
      totalVolumeUsdc: 0n,
      lastPriceWeth: 500000000000000000n, // 0.5 WAD default
      lastPriceUsdc: 500000000000000000n,
      tradeCount: 0,
    },
  });
});

// Resolver:Resolved → mark market resolved
ponder.on("Resolver:Resolved", async ({ event, context }) => {
  const payouts = event.args.payouts;
  const yesWon = payouts[0] > 0n;
  // Need to find conditionId from questionId — requires factory lookup
  // For MVP: hardcode or cache the mapping
  await context.db.Market.update({
    id: conditionIdFromQuestionId(event.args.questionId),
    data: { resolved: true, yesWon },
  });
});

// LiquidityAdded/Removed, Lending events follow the same pattern
```

---

## 5. Ponder Configuration

### 5.1 `ponder.config.ts`

```typescript
import { createConfig } from "@ponder/core";
import { http } from "viem";
import { arbitrumSepolia } from "viem/chains";

// Import ABIs (generated from Foundry artifacts)
import PmAmmPoolAbi from "../contracts-sol/out/PmAmmPool.sol/PmAmmPool.json";
import MarketFactoryAbi from "../contracts-sol/out/MarketFactory.sol/MarketFactory.json";
import ResolverAbi from "../contracts-sol/out/Resolver.sol/Resolver.json";
import MultiverseLendingAbi from "../contracts-sol/out/MultiverseLending.sol/MultiverseLending.json";

export default createConfig({
  networks: {
    arbitrumSepolia: {
      chainId: 421614,
      transport: http(process.env.ARB_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc"),
    },
  },
  contracts: {
    MarketFactory: {
      network: "arbitrumSepolia",
      abi: MarketFactoryAbi.abi,
      address: process.env.FACTORY_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.START_BLOCK ?? 0),
    },
    // PmAmmPool — use factory pattern (index all pools created by factory)
    PmAmmPool: {
      network: "arbitrumSepolia",
      abi: PmAmmPoolAbi.abi,
      factory: {
        address: process.env.FACTORY_ADDRESS as `0x${string}`,
        event: "EventCreated",
        parameter: "poolWeth", // Index WETH pool
      },
      startBlock: Number(process.env.START_BLOCK ?? 0),
    },
    PmAmmPoolUsdc: {
      network: "arbitrumSepolia",
      abi: PmAmmPoolAbi.abi,
      factory: {
        address: process.env.FACTORY_ADDRESS as `0x${string}`,
        event: "EventCreated",
        parameter: "poolUsdc", // Index USDC pool
      },
      startBlock: Number(process.env.START_BLOCK ?? 0),
    },
    Resolver: {
      network: "arbitrumSepolia",
      abi: ResolverAbi.abi,
      address: process.env.RESOLVER_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.START_BLOCK ?? 0),
    },
    MultiverseLending: {
      network: "arbitrumSepolia",
      abi: MultiverseLendingAbi.abi,
      address: process.env.LENDING_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.START_BLOCK ?? 0),
    },
  },
});
```

### 5.2 Environment Variables

```env
# .env.local
ARB_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
FACTORY_ADDRESS=0x...
RESOLVER_ADDRESS=0x...
LENDING_ADDRESS=0x...
START_BLOCK=12345678
DATABASE_URL=postgres://user:pass@localhost:5432/omniverse_indexer
```

### 5.3 Infrastructure

| Component | Recommendation |
|-----------|---------------|
| **Hosting** | Railway (persistent Postgres volume) or self-hosted |
| **Database** | PostgreSQL (Ponder's default) |
| **Startup** | Ponder replays from `startBlock` on cold start — set `START_BLOCK` to the deploy block to avoid scanning genesis |
| **CORS** | Set `PONDER_CORS_ORIGIN` to the Vercel frontend URL |
| **Persistence** | **Critical:** attach a persistent volume to the Postgres instance. Without it, a Railway restart replays from genesis (2-10 min delay during demo) |

---

## 6. GraphQL Queries the Frontend Needs

### 6.1 Market List (for `/markets` grid)

```graphql
query Markets {
  markets(orderBy: "createdAt", orderDirection: "desc") {
    items {
      id
      questionId
      poolWeth
      poolUsdc
      totalVolumeWeth
      totalVolumeUsdc
      lastPriceWeth
      lastPriceUsdc
      tradeCount
      resolved
      yesWon
      createdAt
    }
  }
}
```

### 6.2 Price History (for probability chart on `/markets/[id]`)

```graphql
query PriceHistory($marketId: BigInt!, $poolType: String!) {
  priceSnapshots(
    where: { marketId: $marketId, poolType: $poolType }
    orderBy: "timestamp"
    orderDirection: "asc"
    limit: 1000
  ) {
    items {
      priceWad
      lambdaWad
      ellWad
      timestamp
    }
  }
}
```

### 6.3 Recent Trades (for trade history table)

```graphql
query RecentTrades($marketId: BigInt!, $limit: Int!) {
  trades(
    where: { marketId: $marketId }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    items {
      trader
      sideLabel
      size
      priceAfter
      timestamp
      txHash
    }
  }
}
```

### 6.4 Volume (24h, computed client-side)

```graphql
query Volume24h($marketId: BigInt!, $since: Int!) {
  trades(
    where: { marketId: $marketId, timestamp_gte: $since }
  ) {
    items {
      size
      poolType
    }
  }
}
```

Frontend aggregates: `volume24h = trades.filter(t => t.poolType === "WETH").reduce((s, t) => s + t.size, 0n)`

### 6.5 Sparkline Data (mini chart for market cards)

```graphql
query Sparkline($marketId: BigInt!, $since: Int!) {
  priceSnapshots(
    where: { marketId: $marketId, poolType: "WETH", timestamp_gte: $since }
    orderBy: "timestamp"
    orderDirection: "asc"
    limit: 50
  ) {
    items {
      priceWad
      timestamp
    }
  }
}
```

### 6.6 Lending Activity

```graphql
query LendingHistory($lending: String!) {
  lendingActions(
    where: { lending: $lending }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: 50
  ) {
    items {
      user
      action
      amount
      yesWon
      timestamp
      txHash
    }
  }
}
```

---

## 7. Data Flow Diagram

```
On-Chain Events                    Ponder Indexer                   Frontend
─────────────                    ──────────────                   ────────
PmAmmPool.buyYes()               │                               │
  └─ emit OmniverseTrade ──────►│ Handler:                      │
                                 │  1. Insert Trade row           │
                                 │  2. Update Market volume/price │
                                 │  3. Insert PriceSnapshot       │
                                 │         │                      │
MarketFactory.createEvent()      │         ▼                      │
  └─ emit EventCreated ────────►│ Create Market row              │
                                 │         │                      │
Resolver.resolve()               │         ▼                      │
  └─ emit Resolved ────────────►│ Update Market.resolved         │
                                 │         │                      │
MultiverseLending.borrow()       │         ▼                      │
  └─ emit Borrowed ────────────►│ Insert LendingAction           │
                                 │         │                      │
                                 │    PostgreSQL                  │
                                 │         │                      │
                                 │    GraphQL API ──────────────►│ useQuery()
                                 │    (auto-generated)            │ refetchInterval: 3000ms
                                 │    port 42069 (default)        │
```

---

## 8. WAD Formatting (Critical)

All on-chain values are WAD-scaled (×1e18). The indexer stores them as raw `bigint`. The **frontend** must divide by 1e18 before display:

```typescript
// lib/formatters.ts
export function wadToPercent(wad: bigint): string {
  // 500000000000000000n → "50.00%"
  return (Number(wad) / 1e18 * 100).toFixed(2) + "%";
}

export function wadToEther(wad: bigint): string {
  // 1000000000000000000n → "1.00"
  return (Number(wad) / 1e18).toFixed(4);
}

export function wadToUsd(wad: bigint): string {
  // 2000000000000000000000n → "$2,000.00"
  return "$" + (Number(wad) / 1e18).toLocaleString(undefined, { minimumFractionDigits: 2 });
}
```

> **Forgetting this shows `350000000000000000%` instead of `35%`.** This is the #1 frontend bug.

---

## 9. Polling Strategy (No WebSockets)

The project explicitly avoids WebSockets. Instead:

| Data Source | Method | Interval |
|-------------|--------|----------|
| Contract reads (price, reserves, HF) | `useReadContract` with `watch: true` | 2 seconds |
| GraphQL (history, volume) | `useQuery` with `refetchInterval` | 3 seconds |
| Own transaction confirmation | `useWaitForTransactionReceipt` → `invalidateQueries()` | Immediate |

---

## 10. File Structure

```
indexer/
├── ponder.config.ts          # Networks, contracts, ABIs, factory indexing
├── ponder.schema.ts          # Market, Trade, PriceSnapshot, LiquidityEvent, etc.
├── src/
│   ├── PmAmmPool.ts          # OmniverseTrade, Rebalanced, LiquidityAdded/Removed handlers
│   ├── MarketFactory.ts      # EventCreated handler
│   ├── Resolver.ts           # Resolved handler
│   ├── MultiverseLending.ts  # All lending event handlers
│   └── utils.ts              # Pool→conditionId cache, WAD helpers
├── .env.local                # RPC, addresses, start block
├── package.json
└── tsconfig.json
```

---

## 11. Testing the Indexer

1. **Local fork test:** `anvil --fork-url $ARB_SEPOLIA_RPC` → deploy → seed → run `ponder dev` → query GraphQL at `http://localhost:42069`
2. **Smoke query:** After `SeedMarket.s.sol` + a few `tradeBot.ts` trades:
   ```bash
   curl -X POST http://localhost:42069 \
     -H "Content-Type: application/json" \
     -d '{"query": "{ markets { items { id lastPriceWeth tradeCount } } }"}'
   ```
   Should return 1 market with `lastPriceWeth ≈ 0.5e18` and `tradeCount > 0`.
3. **Cold-start test:** Stop Ponder, restart, verify it replays from `startBlock` and catches up within 30 seconds.
4. **CORS test:** From the Vercel frontend origin, verify GraphQL responds (set `PONDER_CORS_ORIGIN`).

---

## 12. Priority for the Hackathon

| Priority | What | Why |
|----------|------|-----|
| **P0** | Skip the indexer entirely | Frontend can read live state via direct contract calls. No history = no charts, but the demo still works. |
| **P1** | Index `OmniverseTrade` only | Gets you price history + volume. ~2h work. All other events are nice-to-have. |
| **P2** | Add `EventCreated` + `Resolved` | Gets you the market list + resolution status. ~1h more. |
| **P3** | Add lending events | Full activity log. ~1h more. Only needed if the lending UI shows history. |

**Recommendation:** For the hackathon, go with **P1** (trade events only). That gives you the probability chart and volume — the two things that make the UI look alive. Everything else can be direct contract reads.
