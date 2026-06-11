# Requirements Document

## Introduction

The "Attack the Pool" demo wiring connects the existing Omniverse frontend, deployed Arbitrum Sepolia contracts, and the Ponder indexer into a cohesive 6-act live demo choreography. The demo must be VC-grade: every claim is backed by a real on-chain read or confirmed transaction. The six acts are: landing → live attack terminal → proof dashboard → Arbiscan verification → borrow flow → resolution simulation. All implementation must reuse existing hooks, formatters, and conventions without introducing new npm dependencies.

---

## Glossary

- **Demo Manifest**: The `demo-manifest.json` file served from `frontend/public/` containing all contract addresses and configuration for the current demo run.
- **Attack Terminal**: The `/markets/:id` route when the loaded market matches the demo condition ID.
- **Proof Dashboard**: The `/demo` route that displays indexed attack trade proofs alongside live on-chain reads.
- **isDemoMarket**: Boolean flag that is `true` when the current market page's condition ID matches the manifest's `conditionId`.
- **Ponder**: The GraphQL indexer that streams `OmniverseTrade` events from the deployed pool contracts.
- **WAD**: 18-decimal fixed-point representation used throughout the Omniverse contracts (1 WAD = 1e18).
- **AttackPresets**: The three one-click trade presets: Probe (2 000 WETH), Whale (4 000 WETH), Kill Shot (6 000 WETH).
- **TxState**: The client-side transaction state machine: `idle → wallet → pending → confirmed | failed`.
- **DataSourceBadge**: UI label indicating the origin of a displayed value (`live`, `indexed`, `manifest`, `computed`, `unavailable`).
- **ReadinessCheck**: A single pre-flight check item with a `status` of `pass`, `fail`, `loading`, or `warning`.
- **presentMode**: URL query parameter `?present=true` that hides developer/debug panels for clean screen-share presentation.
- **minOut**: Minimum acceptable token output for a swap, used to enforce slippage protection.
- **PoolReserves**: Seven-field struct returned by `PmAmmPool.getReserves()`: `xActive`, `xPassive`, `yActive`, `yPassive`, `ellActive`, `lambdaWad`, `lT`.
- **DemoManifest**: TypeScript type alias for the parsed content of `demo-manifest.json`.
- **OmniverseRouter**: The deployed smart contract through which all demo swaps and borrows are routed.
- **DemoTrade**: A parsed Ponder trade record with fields `txHash`, `blockNumber`, `side`, `size`, `priceAfter`, `lambdaWad`, `ellWad`, `gapWad`, `trader`, `timestamp`.
- **SimulationBanner**: Amber/orange disclaimer banner on `/simulate` clarifying that no real on-chain transaction is being made.
- **PreDemoReadinessPanel**: Expandable pre-flight checklist shown on the Attack Terminal before the demo begins.
- **BorrowDemoTab**: Dedicated borrow UI pre-filled with demo manifest defaults (500 WETH collateral, 250 USDC borrow).
- **assembleDashboardData**: Pure function that composes live and indexed data into a single `DashboardData` record for the Proof Dashboard.

---

## Requirements

### Requirement 1: Demo Manifest Loading

**User Story:** As a presenter, I want the app to load demo configuration from `demo-manifest.json` automatically, so that all contract addresses and parameters are available to every component without manual configuration.

#### Acceptance Criteria

1. WHEN the app loads, THE `useDemoManifest` hook SHALL fetch `/demo-manifest.json` with `cache: "no-store"` and expose the parsed `DemoManifest` object.
2. WHEN `demo-manifest.json` is successfully fetched, THE `useDemoManifest` hook SHALL validate that `conditionId` is a valid `bytes32` hex string, `poolWeth` and `poolUsdc` are non-zero addresses, and `l0` parses to a positive `BigInt`.
3. IF `/demo-manifest.json` returns a 404 or parse error, THEN THE `useDemoManifest` hook SHALL set `data` to `null`, and THE app SHALL set `isDemoMarket = false` everywhere so no attack-mode UI is rendered.
4. THE `useDemoManifest` hook SHALL expose the manifest fields required by all downstream hooks and components without re-fetching on re-render.

---

### Requirement 2: Attack Mode Strip

**User Story:** As a presenter, I want a persistent ticker strip on the Attack Terminal showing live contract reads, so that the audience sees real-time on-chain data during the demo.

#### Acceptance Criteria

1. WHILE `isDemoMarket = true` on `/markets/:id`, THE `AttackModeStrip` component SHALL render with live P(YES), λ\*, active%, passive%, ell, L\_t, and the math kernel badge sourced from `usePoolPrice`, `usePoolReserves`, and `useMathKernelStatus`.
2. WHEN `AttackModeStrip` renders the pool address, THE component SHALL render it as a hyperlink to `https://sepolia.arbiscan.io/address/{pool}`.
3. WHEN a latest `txHash` is available from `useDemoTrades`, THE `AttackModeStrip` SHALL render a hyperlink to `https://sepolia.arbiscan.io/tx/{hash}`.
4. IF `isDemoMarket = false`, THEN THE `AttackModeStrip` component SHALL NOT render on the market page.

---

### Requirement 3: Attack Presets Execution

**User Story:** As a presenter, I want one-click trade buttons (Probe, Whale, Kill Shot) wired to real contract writes, so that I can execute live swaps on Arbitrum Sepolia with a single click during the demo.

#### Acceptance Criteria

1. THE `AttackPresets` component SHALL render exactly three preset buttons: Probe (2 000 WETH), Whale (4 000 WETH), and Kill Shot (6 000 WETH).
2. FOR every preset execution, THE `useAttackPresets` hook SHALL compute `minOut` such that `minOut ≤ floor(expectedOut × 0.95)` where `expectedOut = (amountWad × 1e18) / yesPriceWad`.
3. WHEN a preset is executed, THE `TxState` SHALL transition through phases in order: `idle → wallet → pending → (confirmed | failed)` with no phase skipped.
4. WHEN a transaction reaches `confirmed` phase, THE `useAttackPresets` hook SHALL call `onConfirmed()` exactly once and trigger a refetch of price, reserves, and trades.
5. IF the Router contract reverts with a `Slippage()` error, THEN THE `AttackPresets` component SHALL set `txState.phase = "failed"` and display a human-readable message: `"Price moved before your trade landed. Try the next preset size."`.
6. IF the Router contract reverts with a `Frozen()` error, THEN THE `AttackPresets` component SHALL set `txState.phase = "failed"` and display the message: `"Pool is frozen — too close to expiry. Contact team to extend T or deploy new pool."` and SHALL disable all preset buttons.
7. WHEN the WETH allowance on the OmniverseRouter is less than the preset amount, THE `useAttackPresets` hook SHALL execute `ERC20.approve(router, MAX_UINT256)` before submitting the swap transaction.
8. WHILE `txState.phase = "wallet"`, THE `AttackPresets` component SHALL display "Waiting for wallet..." with a cancel option; IF 60 seconds elapse without confirmation, THEN THE phase SHALL revert to `"idle"`.

---

### Requirement 4: Demo Mode Isolation

**User Story:** As a developer, I want attack-mode components to appear only on demo markets, so that non-demo market pages are unaffected by the demo wiring.

#### Acceptance Criteria

1. THE `AttackPresets` component SHALL only render when `isDemoMarket = true`.
2. THE `PreDemoReadinessPanel` component SHALL only render when `isDemoMarket = true`.
3. THE `BorrowDemoTab` component SHALL only render when `isDemoMarket = true`.
4. WHEN the `conditionId` of the loaded market does not match `manifest.conditionId`, THE app SHALL set `isDemoMarket = false` and none of the three above components SHALL render.

---

### Requirement 5: Pre-Demo Readiness Panel

**User Story:** As a presenter, I want a pre-flight checklist on the Attack Terminal, so that I can verify all prerequisites are met before starting the demo in front of an audience.

#### Acceptance Criteria

1. THE `PreDemoReadinessPanel` component SHALL evaluate and display exactly 8 readiness checks in this order: (1) Demo manifest loaded, (2) Network is Arbitrum Sepolia (chainId 421614), (3) Wallet connected, (4) WETH balance ≥ 12 000 WAD, (5) WETH allowance on Router ≥ 12 000 WAD, (6) Pool price readable and not frozen, (7) Ponder indexer synced, (8) Ponder START\_BLOCK ≤ manifest `createdBlock`.
2. THE `usePreDemoReadiness` hook SHALL set `allPass = true` if and only if every `ReadinessCheck` in the returned array has `status = "pass"`.
3. WHEN `wethAllowance < 12_000 WAD`, THE `PreDemoReadinessPanel` SHALL display a "warning" status check with an inline "Approve Max" action button that executes `ERC20.approve(router, MAX_UINT256)`.
4. WHERE `presentMode = true` (URL contains `?present=true`), THE `PreDemoReadinessPanel` component SHALL NOT render.

---

### Requirement 6: Indexed Trade Feed (useDemoTrades)

**User Story:** As a presenter, I want the demo to display real indexed trades from the Ponder indexer, so that every tx hash shown is verifiably on-chain.

#### Acceptance Criteria

1. THE `useDemoTrades` hook SHALL query Ponder's GraphQL API for trades matching the demo `conditionId` with `poolType = "WETH"`, returning at most 8 results.
2. WHEN Ponder returns trade data, THE `useDemoTrades` hook SHALL expose each `DemoTrade` with all required fields: `id`, `side`, `sideLabel`, `size`, `priceAfter`, `lambdaWad`, `ellWad`, `gapWad`, `trader`, `txHash`, `blockNumber`, `timestamp`.
3. WHEN a swap transaction is confirmed, THE component mounting `useDemoTrades` SHALL trigger a `refetch` with `requestPolicy: "network-only"` to bypass urql cache.
4. IF Ponder returns an empty trade list after a confirmed transaction, THEN THE `AttackTranscript` component SHALL display `DataSourceBadge source="unavailable"` and skeleton loaders, retrying up to 5 times at 3-second intervals.

---

### Requirement 7: Attack Transcript

**User Story:** As an audience member, I want to see the 3 demo trades listed in order with real Arbiscan links, so that I can independently verify the on-chain activity.

#### Acceptance Criteria

1. THE `AttackTranscript` component SHALL display demo trades sorted in ascending order by size (Probe 2k → Whale 4k → Kill Shot 6k).
2. FOR every trade displayed, THE `AttackTranscript` component SHALL render the `txHash` as a hyperlink formatted as `https://sepolia.arbiscan.io/tx/{txHash}`.
3. WHILE `isLoading = true`, THE `AttackTranscript` component SHALL render skeleton loaders in place of trade rows.
4. THE `AttackTranscript` component SHALL display a "Indexed from Ponder" badge alongside the trade list.

---

### Requirement 8: W-Curve Live

**User Story:** As a presenter, I want the W-curve visualization to show the live pool position, so that the audience sees the mathematical impact of attacks in real time.

#### Acceptance Criteria

1. THE `WCurveLive` component SHALL accept a `price` prop in the range `[0, 1]` and render an animated dot on the W-curve SVG at the corresponding x-position.
2. THE static W-curve path SHALL be computed once via `useMemo` and SHALL NOT recompute on re-renders unless `lambdaWad` changes.
3. WHEN the `/demo` page mounts, THE `WCurveLive` component SHALL receive `price` from `usePoolPrice(manifest.poolWeth)` (live contract read), NOT from the previous `useSimulatedFeed()` implementation.

---

### Requirement 9: Proof Dashboard Assembly

**User Story:** As a presenter, I want the `/demo` page to show a cohesive proof panel combining live contract reads with indexed trade history, so that every data point is traceable to its source.

#### Acceptance Criteria

1. THE `assembleDashboardData` function SHALL return a `DashboardData` record where `priceFloat ∈ [0.0, 1.0]` for any input `livePrice ∈ [0n, 10^18n]`.
2. WHEN `liveReserves` is defined and `(xActive + xPassive + yActive + yPassive) > 0`, THE `assembleDashboardData` function SHALL compute `activePct + passivePct = 100`.
3. THE `assembleDashboardData` function SHALL return `attackTrades` containing at most 3 entries, filtered to `side = 0` (buyYes) and sorted ascending by size.
4. WHEN `livePrice` is defined, THE `assembleDashboardData` function SHALL use `livePrice` as `displayPrice`; only when `livePrice` is `undefined` SHALL it fall back to the last indexed trade's `priceAfter`.
5. THE `/demo` route SHALL replace the `useSimulatedFeed()` call with `usePoolPrice`, `usePoolReserves`, and `useDemoTrades`, passing their results through `assembleDashboardData`.

---

### Requirement 10: LP Shield Panel

**User Story:** As a presenter, I want a stacked bar visualization of active vs passive reserves, so that the audience understands the LP's shielding mechanism.

#### Acceptance Criteria

1. THE `LpShieldPanel` component SHALL compute `activePct = floor((xActive + yActive) × 100 / (xActive + xPassive + yActive + yPassive))` from the provided `PoolReserves`.
2. THE `LpShieldPanel` component SHALL render a stacked bar where the active portion is visually bright and the passive portion is visually dim, with the passive percentage labeled as "shielded".
3. IF `reserves` is `undefined`, THEN THE `LpShieldPanel` SHALL display `DataSourceBadge source="unavailable"`.

---

### Requirement 11: Borrow Demo Tab

**User Story:** As a presenter, I want a borrow tab pre-filled with demo defaults, so that I can demonstrate the lending flow without manual input during the demo.

#### Acceptance Criteria

1. WHEN `BorrowDemoTab` mounts, THE component SHALL pre-fill the collateral input with `manifest.lendingCollateral / 1e18` and the borrow input with `manifest.lendingDebt / 1e18`.
2. WHEN the user submits the borrow form, THE `BorrowDemoTab` component SHALL call `Router.executeBorrow(lending, conditionId, wethCollateral, usdcBorrow)` with the form values.
3. WHEN the WETH allowance on the OmniverseRouter is less than the collateral amount, THE `BorrowDemoTab` component SHALL execute `WETH.approve(router, wethCollateral)` before submitting the borrow (`executeBorrow` pulls WETH collateral and splits internally — the user approves WETH, not the CTF).
4. THE `BorrowDemoTab` component SHALL display LTV = borrow/collateral and a health factor explanation before the user submits.

---

### Requirement 12: Simulation Banner

**User Story:** As a presenter, I want a prominent disclaimer on the `/simulate` page, so that the audience understands the resolution scenario is client-side only and does not affect the live pool.

#### Acceptance Criteria

1. THE `SimulationBanner` component SHALL always render on the `/simulate` route regardless of other page state.
2. THE `SimulationBanner` component SHALL display all three of the following strings: "SIMULATION", "Client-side only", and "No on-chain transactions".
3. WHERE `presentMode = true`, THE `SimulationBanner` component SHALL remain visible and SHALL NOT be hidden.

---

### Requirement 13: Data Source Badge Accuracy

**User Story:** As a developer or auditor, I want every displayed numeric value to carry a source badge matching its actual data origin, so that data provenance is transparent and auditable.

#### Acceptance Criteria

1. THE System SHALL render `DataSourceBadge source="live"` alongside every value sourced from a `wagmi useReadContract` call.
2. THE System SHALL render `DataSourceBadge source="indexed"` alongside every value sourced from a Ponder/urql GraphQL query.
3. THE System SHALL render `DataSourceBadge source="manifest"` alongside every value read directly from `demo-manifest.json`.
4. THE System SHALL render `DataSourceBadge source="computed"` alongside every value derived by client-side calculation from live or indexed inputs.
5. IF a data source is unavailable (RPC error, indexer lag, missing manifest), THEN THE System SHALL render `DataSourceBadge source="unavailable"` and retain the last known value with a stale indicator.

---

### Requirement 14: Formatters and URL Utilities

**User Story:** As a developer, I want canonical formatter and URL utilities, so that all components produce consistent, human-readable output without duplication.

#### Acceptance Criteria

1. THE `formatProbability` function SHALL accept any `BigInt` in `[0n, 10^18n]` and return a string ending in `%` representing a value in `[0%, 100%]`.
2. THE `arbiscanTxUrl` function SHALL accept any transaction hash string and return `https://sepolia.arbiscan.io/tx/{hash}`.
3. THE `formatWad` function SHALL accept any non-negative `BigInt` WAD value and return a human-readable decimal string without throwing.

---

### Requirement 15: Polling and Performance

**User Story:** As a presenter, I want UI data to refresh frequently during the demo without overloading the RPC endpoint, so that the live numbers feel responsive.

#### Acceptance Criteria

1. THE `usePoolPrice`, `usePoolReserves`, and `useMathKernelStatus` hooks SHALL configure `refetchInterval: 2000` (2 seconds) for all live contract reads.
2. WHEN a trade is confirmed, THE `useDemoTrades` hook SHALL immediately issue a `refetch` with `requestPolicy: "network-only"` before the next 2-second poll.
3. THE `useDemoManifest` hook SHALL fetch the manifest exactly once on mount and SHALL NOT re-fetch on component re-renders.

---

### Requirement 16: Presentation Mode

**User Story:** As a presenter, I want to suppress all developer/debug panels when `?present=true` is in the URL, so that the screen share shows only the VC-facing demo UI.

#### Acceptance Criteria

1. WHEN the URL contains `?present=true`, THE System SHALL hide `PreDemoReadinessPanel` on all routes.
2. WHEN the URL contains `?present=true`, THE System SHALL hide all `DataSourceBadge` debug labels that are not integral to the VC-facing narrative.
3. THE `SimulationBanner` on `/simulate` SHALL remain visible when `?present=true`.
