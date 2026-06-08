# Omniverse Live Math Demo: Implementation Plan

## Goal
Build a live, on-chain demonstration that makes every novel part of Omniverse visible from a user and LP perspective:

- A real prediction market running on Arbitrum Sepolia.
- User trading that moves market probability.
- Liquidity provision split into active and passive reserves.
- Dynamic Gaussian `lambda*(P)` protection computed by the deployed math kernel.
- Counterfactual LVR saved versus a constant `lambda = 0.5` pool.
- Zero-liquidation lending shown as a product primitive connected to the same condition.
- A proof strip tying the displayed values to real blocks, tx hashes, pool addresses, and the math kernel address.

The demo should use **one real dynamic market**, not two artificial markets. The constant-lambda comparison is computed analytically from the same indexed trade history, so the dashboard remains honest: the live pool is the product, and the constant pool is only a counterfactual baseline.

---

## Core Demo Narrative

1. **A user sees a live prediction market.**
   - Market question, expiry, resolver, collateral, pool address, current YES probability.
   - Recent trades show how users buy YES/NO and move probability.

2. **An LP provides liquidity.**
   - Mock WETH is split into YES/NO CTF positions.
   - LP deposits both sides into the WETH pm-AMM pool.
   - Dashboard shows LP shares, total reserves, active reserves, and passive protected reserves.

3. **A whale/informed trader pushes probability into the tail.**
   - Real Sepolia transactions buy YES in sequence.
   - Each transaction waits for a real receipt/new block.
   - The pool rebalances from actual block progression, not local `vm.roll` assumptions.

4. **The math becomes visible.**
   - The live dot moves along the W-shaped `lambda*(P)` curve.
   - `lambdaWad` and `ellActive` compress as probability approaches the tail.
   - The active/passive split shows the LP protection mechanism numerically.

5. **The saved capital becomes legible.**
   - The dashboard computes cumulative analytic LVR for:
     - actual dynamic `lambdaWad`
     - counterfactual constant `lambda = 0.5`
   - The difference is shown as "LVR saved for LPs".

6. **The proof is on-chain.**
   - Last blocks show block number, tx hash, probability, `z = PhiInv(P)`, `lambda*(P)`, pool address, and math kernel address.
   - If the factory/pool math address is the Stylus deployment, the demo proves the deployed Stylus kernel is the source of the dynamic lambda computation.

---

## Phase 1: Demo State Creation

### 1.1 Create/Update `contracts-sol/script/SimulateArbDemo.s.sol`

**Path:** `contracts-sol/script/SimulateArbDemo.s.sol`

Purpose: create the live demo market and seed initial state. This script should not try to simulate every trade with local-only block cheatcodes.

Requirements:

1. **Environment Setup**
   - Load:
     - `DEPLOYER_PRIVATE_KEY`
     - `FACTORY_ADDRESS`
     - `RESOLVER_ADDRESS`
   - Derive CTF, WETH, USDC, and math address from the deployed contracts where possible.
   - Log the math kernel address used by the factory/pool.

2. **Massive Mock Minting**
   - Mint mock WETH to the deployer/demo wallet:
     - `weth.mint(deployer, 10_000_000e18)`
   - Mint mock USDC if the lending panel will be seeded in the same run.
   - Do not fake frontend volume.

3. **Single Dynamic Market Creation**
   - Create one event using:
     - `useDynamicLambda = true`
     - category: `demo`
     - stable symbol, e.g. `AI2030-DYN`
   - Include a run timestamp in the question to avoid `questionUsed` collisions across repeated testnet runs.

4. **Initial WETH Liquidity**
   - Split WETH into YES/NO CTF positions.
   - Add large WETH liquidity to the WETH pool, e.g. `500_000e18` YES and `500_000e18` NO.
   - Capture:
     - condition ID
     - WETH pool address
     - YES/NO position IDs
     - market ID
     - math kernel address

5. **Optional Lending Seed**
   - If the lending panel is included in this run:
     - deploy or reference a `MultiverseLending` market for the condition
     - seed YES-USDC reserves
     - open one example zero-liquidation borrow position
   - Capture lending address and basic position values in the manifest.

6. **Manifest Generation**
   - Write `contracts-sol/deployments/demo-manifest.json`.
   - Include:
     - `conditionId`
     - `wethMarketId`
     - `poolWeth`
     - `yesWethId`
     - `noWethId`
     - `math`
     - `factory`
     - `resolver`
     - `symbol`
     - `question`
     - `runId` (timestamp-based, e.g. Unix seconds at script execution)
     - `createdBlock` (the block number at which the market creation tx was mined)
     - optional lending fields
   - `createdBlock` is required. The Ponder `startBlock` must be set to `createdBlock - 1` or earlier before syncing. The runner script should warn loudly if it detects that `startBlock` in `ponder.config.ts` is greater than `createdBlock`, as this will cause the indexer to miss the `EventCreated` log entirely.
   - On repeated runs, the runner should detect an existing `demo-manifest.json` and either prompt for confirmation before overwriting or write to a timestamped file (e.g. `demo-manifest-<runId>.json`). The dashboard filters all queries by `conditionId` and `poolWeth` from the manifest, so stale Ponder data from a previous run will not pollute the current run's panels as long as the manifest is current.

### 1.2 Create Live Trade Runner

**Preferred Path:** `contracts-sol/ts/runLiveDemoTrades.ts`

Purpose: send real Sepolia transactions that push the single dynamic market toward the tail.

Why not `vm.roll`: `vm.roll` is a local Foundry cheatcode. It does not prove real block-by-block on-chain behavior on Arbitrum Sepolia.

Requirements:

1. Load `deployments/demo-manifest.json`.
2. Load RPC URL and private key from env.
3. Ensure the wallet has/splits enough WETH positions for trade input.
4. **Offline calibration before broadcast**: before running against Sepolia, compute the approximate trade sequence needed to reach `P >= 0.95` using the known `L0` and starting z. With `L0 = 500_000e18` and initial `P = 0.5` (z=0), reaching z ≈ 1.645 (P=0.95) requires net reserve movement of roughly `L0 * 1.645` less the nonlinear reserve correction. Derive the required cumulative input size offline, then set the trade sequence accordingly. Hardcoded sizes like `50k...150k` may fall far short.
5. **Adaptive live execution**: execute trades in sequence. After each receipt:
   - read `currentPrice()` from the pool
   - if `currentPrice() >= targetP` (default `0.95e18`), stop immediately regardless of remaining trades
   - if the trade list is exhausted before reaching `targetP`, log a warning and continue to the presentation phase with the achieved probability
   - enforce a max-trade-count and max-single-trade-size safety cap to prevent accidental drain
6. After every transaction:
   - wait for receipt
   - wait for a new block if necessary
   - read `currentPrice()`, `getReserves()`, and `lambdaWad`
   - log block, tx hash, probability, lambda, active/passive reserves

### 1.3 Update `run-demo-sepolia.sh`

The runner should:

1. Load `contracts-sol/.env`.
2. Run the Foundry setup script with `--broadcast`.
3. Copy `contracts-sol/deployments/demo-manifest.json` to `frontend/public/demo-manifest.json`.
4. Run the live trade runner.
5. Print:
   - dashboard URL
   - pool address
   - math kernel address
   - generated manifest path

---

## Phase 2: Indexer Updates

The dashboard should prefer indexed event data, then supplement with direct on-chain reads where needed.

### 2.1 Market Schema

Ensure `market` includes:

```ts
useDynamicLambda: t.boolean().notNull()
```

### 2.2 Factory Handler

In `indexer/src/MarketFactory.ts`:

- **Before implementing**: verify the deployed WETH pool ABI supports `useDynamicLambda()`. The field `bool public useDynamicLambda` exists in the current source and Solidity auto-generates its getter, but if the Sepolia pool was deployed before this field was added, the call will revert or return garbage.
  - If the deployed pool supports it: read `useDynamicLambda()` via `client.readContract` and insert the result.
  - If the deployed pool does not support it: hardcode `useDynamicLambda: true` for markets whose `conditionId` matches the demo manifest, and add a comment marking this as a manifest-driven fallback for pre-upgrade deployments.
- Insert `useDynamicLambda` into the `market` row.
- Ensure the indexer ABI for `EventCreated` includes:
  - `question`
  - `symbol`
  - `category`

### 2.3 Trade and Rebalance Data

Existing `OmniverseTrade` and `Rebalanced` events should power most of the dashboard:

- `OmniverseTrade`
  - market ID
  - trader
  - side
  - size
  - `priceWad`
  - `ellWad`
  - `lambdaWad`
  - `gapWad` — **this is z-space gap**, computed as `_zFromReserves(xActive, yActive, ellActive) - _zFromReserves(xTotal, yTotal, ellTotal)`. It is the `gap_z_n` term in the LVR formula directly. Do not reinterpret it as a price-space gap; the LVR formula uses z-space and the two are not interchangeable.
  - timestamp
  - tx hash from indexer context
- `Rebalanced`
  - active reserves
  - active liquidity
  - lambda
  - block number

If exact passive reserve values are needed and not emitted, read them from `getReserves()` in the frontend or add a future indexer enrichment step.

---

## Phase 3: Frontend Dashboard

### 3.1 Route

**Path:** `frontend/src/routes/demo.tsx`

This should be a simple, non-flashy dashboard. The UI should prioritize legibility and verifiability over styling.

### 3.2 Data Fetching

1. Read `frontend/public/demo-manifest.json`.
2. Query Ponder for:
   - the demo market
   - WETH trades
   - price snapshots
   - rebalances
   - optional lending actions
3. Use direct `viem` reads for:
   - `getReserves()`
   - `currentPrice()`
   - `lambdaWad`
   - `gammaPrimeWad`
   - `math`
   - `L0`, `T`, and current liquidity if needed

### 3.3 Panel 1: Live Market and User Flow

Show:

- question
- symbol
- expiry
- resolver
- collateral
- pool address
- current YES probability
- total WETH volume
- recent buy YES / buy NO trades

This panel proves the dashboard is a prediction-market product demo, not only a math visualization.

### 3.4 Panel 2: Liquidity Provision and Protection

Show:

- initial LP deposit
- YES/NO split
- LP shares
- total reserves
- active reserves
- passive protected reserves
- `ellActive`
- `lambdaWad`

Use a clear active/passive bar:

- active = exposed liquidity
- passive = protected liquidity

Also show the double-protection formula:

```text
ell_active = lambda*(P) * L0 * sqrt((T - t) / duration)
```

### 3.5 Panel 3: W-Curve

Render a static SVG of `lambda*(P)` for `P in [0, 1]`.

Requirements:

- **Do not reimplement `lambdaStarGaussian` in JavaScript.** Instead, on page load, call `viem.readContract` for `lambdaStarGaussian(gammaPrime, P)` on the deployed math kernel address for ~60 evenly spaced P values (e.g. P = 0.01, 0.02, ..., 0.99 plus a few extra near the tails at 0.001, 0.005, 0.995, 0.999). Cache the resulting points in component state. This makes the W-curve's source of truth identical to the pool's source of truth — any discrepancy between the curve and the emitted `lambdaWad` is impossible by construction.
- Highlight:
  - local high regions around `P ≈ 0.2` and `P ≈ 0.8`
  - mid-range low near `P = 0.5`
  - tail compression near `P → 0` and `P → 1`
- Add a live dot at the pool's current `P`, placed against the cached curve points.
- Show the current `lambda*(P)` value next to the dot.

This is the core visual claim: Omniverse found a non-obvious W-shaped optimal activeness curve.

### 3.6 Panel 4: Cumulative LVR Saved

Compute analytic LVR from indexed trade history.

Use:

```text
LVR_n ~= (lambda / 2) * phi(z) / v(z) * (gap_z_n)^2
z = PhiInv(P)
v(z) = phi(z) + z * (2 * Phi(z) - 1)
```

Counters:

- `LVR paid, constant lambda = 0.5`
- `LVR paid, actual dynamic lambda*`
- `LVR saved for LPs`

Important labeling:

- This is **counterfactual analytic LVR**, not an on-chain balance transfer.
- The dynamic side uses actual indexed `lambdaWad`.
- The constant side uses the same observed trade history with `lambda = 0.5`.

### 3.7 Panel 5: Zero-Liquidation Lending

If lending is seeded for the demo market, show:

- YES-WETH collateral deposited
- YES-USDC borrowed
- current debt
- current collateral
- outcome-coupled debt/collateral explanation in one concise line
- no liquidation threshold / no forced liquidation state

This panel makes the second major product primitive visible.

### 3.8 Panel 6: On-Chain Proof Strip

Show the last 5 indexed blocks or transactions:

- block
- tx hash
- side
- size
- `P`
- `z = PhiInv(P)`
- `lambdaWad`
- `ellWad`
- pool address
- math kernel address

Each tx hash should link to Arbiscan Sepolia.

**Stylus verification**: read `PmAmmPool.math()` directly from the pool via `viem.readContract`. Compare the returned address to the known Stylus deployment address (stored in the manifest as `math`). If they match, display a "✓ Stylus kernel" badge. If they do not match (i.e. the pool points to `OmniverseMathSolidity`), display "Solidity fallback" instead and do not claim Stylus in the pitch. This check must run at dashboard load, not be hardcoded. The emitted `lambdaWad` is valid proof of dynamic lambda regardless; the badge only affects the Stylus-specific claim.

If Arbiscan traces expose the internal call to the Stylus math kernel, mention it. Do not rely on trace visibility as the only proof; the pool's configured math address and emitted `lambdaWad` are the primary proof.

---

## Phase 4: Demo Execution Steps

1. **Verify deployed pool ABI**: check that the Sepolia `PmAmmPool` at `poolWeth` supports `useDynamicLambda()`. If not, apply the manifest-hardcode fallback described in Phase 2.2 before proceeding.
2. **Verify math kernel address**: read `PmAmmPool.math()` from the deployed pool. Confirm it matches the intended math kernel. If the pitch claims "Stylus calculated this", the address must be the Stylus deployment — not `OmniverseMathSolidity`. Log the result explicitly before continuing.
3. **Run offline calibration**: using the manifest `L0` and initial `P`, compute the trade sequence needed to reach `P >= 0.95`. Adjust the runner's trade list accordingly before broadcasting.
4. Run:

```bash
./run-demo-sepolia.sh
```

5. Update Ponder `startBlock` to `createdBlock - 1` from the new manifest. Start/resync Ponder:

```bash
cd indexer
npm run dev
```

6. Start frontend:

```bash
cd frontend
bun run dev
```

7. Open:

```text
http://localhost:5173/demo
```

8. Verify dashboard state before the presentation:
   - Panel 6 Stylus badge shows "✓ Stylus kernel" (or "Solidity fallback" if applicable)
   - W-curve dot is positioned correctly at current `P`
   - Active/passive bar reflects actual pool reserves
   - LVR saved counter is non-zero and increasing with each indexed trade

9. During the presentation:
   - show the market context
   - show LP provision and active/passive reserves
   - run or replay whale trades
   - show the dot moving on the W-curve
   - show `lambdaWad` compressing in the tail
   - show cumulative LVR saved
   - show recent tx hashes and math kernel address
   - show zero-liquidation lending panel

---

## Step-by-Step Execution Checklist for AI

1. Replace the two-market demo script with a single dynamic-market setup script.
2. Add `createdBlock` and `runId` to the manifest; add overwrite-confirmation logic to the runner.
3. Add a live trade runner with adaptive execution (stop at `targetP`, safety caps) and offline calibration guidance. Remove hardcoded trade sizes.
4. Keep `useDynamicLambda` in the indexer schema.
5. Keep the `MarketFactory` handler reading `useDynamicLambda()` from the WETH pool, with the deployed-ABI check and manifest-hardcode fallback documented.
6. Ensure the indexer ABI decodes `question`, `symbol`, and `category`.
7. Document `gapWad` as z-space gap in the trade schema and in the LVR implementation.
8. Rework `frontend/src/routes/demo.tsx` into the single-market dashboard.
9. Implement the W-curve by calling `lambdaStarGaussian` on the deployed math kernel for ~60 sampled P values via `viem.readContract`. Cache results in component state. Do not reimplement the formula in JS.
10. Implement active/passive reserve visualization from actual pool data.
11. Implement analytic LVR saved counters using z-space `gapWad`.
12. Implement the on-chain proof strip with block/tx/pool/math address.
13. In Panel 6, read `PmAmmPool.math()` at load time, compare to manifest `math` address, and display "✓ Stylus kernel" or "Solidity fallback" badge accordingly.
14. Add the zero-liquidation lending panel if demo lending is seeded.
15. Run `bun run build` for the frontend.
16. Run `npm run codegen` for the indexer if schema changes.
17. Run Foundry tests, excluding any external Stylus-address integration test when local code is not deployed at that address.
18. Execute the live Sepolia demo and verify the dashboard shows dynamic `lambda*(P)` compression from indexed on-chain data.