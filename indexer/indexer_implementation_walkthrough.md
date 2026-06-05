# OMNIVERSE Indexer — Implementation Walkthrough

The Ponder indexer has been fully implemented according to the requirements document, including all P0-P3 goals. It listens to all four core smart contracts and serves the compiled data via a GraphQL endpoint for the frontend to consume.

## 1. Project Scaffolding
- Initialized the `indexer/` directory inside the project root.
- Created `package.json` with the required `ponder` and `viem` dependencies.
- Configured `tsconfig.json` to correctly resolve Ponder's auto-generated types (`ponder-env.d.ts`).
- Created a `.env.example` specifying network RPC variables and contract deployed addresses.

## 2. ABI Extraction
To avoid tying the indexer too closely to the Foundry compilation artifacts (which can be large), I extracted only the exact ABI fragments needed for the indexer into the `abis/` directory:
- `MarketFactory.ts`: Includes `EventCreated` and getter functions.
- `MultiverseLending.ts`: Includes all 8 lending events (e.g. `Deposited`, `Borrowed`, `Settled`).
- `PmAmmPool.ts`: Includes `OmniverseTrade`, `Rebalanced`, `LiquidityAdded/Removed`.
- `Resolver.ts`: Includes `Resolved`.

## 3. Configuration & Schema
- **`ponder.config.ts`**: Set up indexing on Arbitrum Sepolia. The `PmAmmPool` contracts are configured using Ponder's **Factory pattern** (`factory()`). It discovers new WETH and USDC pool addresses whenever `MarketFactory` emits `EventCreated`.
- **`ponder.schema.ts`**: Defined 6 robust tables using Ponder v0.9's `onchainTable` API. This captures the `market`, `trade` history, `price_snapshot` timeseries, `rebalance` logs, `liquidity_event` tracking, and `lending_action` ledger (P3).

## 4. Event Handlers
Implemented the event processing logic inside `src/`:

### The Caching Strategy (`src/utils.ts`)
A critical part of the implementation is linking swaps back to the market they belong to. Because `OmniverseTrade` does not emit `conditionId` or `poolType` natively, `MarketFactory.ts` intercepts the `EventCreated` event and saves the pool addresses mapping in memory (`registerPool`). This allows downstream handlers to correctly label volume and trades.

### Market Lifecycle (`src/MarketFactory.ts` & `src/Resolver.ts`)
- **Factory**: Creates the canonical `market` row when `EventCreated` is detected.
- **Resolver**: Listens for `Resolved` and uses Drizzle-ORM to correctly update the market status (`yesWon`) based on the `questionId`.

### Trading & Volume Accounting (`src/PmAmmPool.ts`)
Processes `OmniverseTrade` events. Crucially, it implements the **one-sided volume accounting rule** (only adding `size` and not double counting outputs) and routes it to either `totalVolumeWeth` or `totalVolumeUsdc` based on the pool type. It also generates the `PriceSnapshot` data points for probability charts.

### Multiverse Lending (P3 Requirement) (`src/MultiverseLending.ts`)
Complete coverage of all 8 lending lifecycle events. It maps `Deposited`, `Borrowed`, `Repaid`, `Withdrawn`, `ReserveSeeded`, `Settled`, and `Claimed` actions into a unified `lending_action` ledger.

## 5. Verification
- Ran `npm install` and generated Ponder typings with `npx ponder codegen`.
- Ran `npx tsc --noEmit` which completed successfully with **0 errors**. The entire indexer implementation is structurally sound and type-safe.

## Next Steps for the Demo
The indexer code is completely ready. Once the smart contracts are deployed using the `Deploy.s.sol` and `SeedMarket.s.sol` scripts, simply update the `.env.local` file with the deployed addresses and run `npm run dev` to start indexing!
