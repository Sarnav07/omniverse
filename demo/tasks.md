# Implementation Plan: Attack the Pool — Demo Wiring

## Overview

Wire the existing Omniverse frontend, deployed Arbitrum Sepolia contracts, and Ponder indexer into a cohesive 6-act live demo. Implementation is in TypeScript (React 19 / Vite / wagmi v3). All code must reuse existing hooks, formatters, and shadcn/ui components — no new npm dependencies.

The five phases mirror the design's `Phase Implementation Order`: Data Foundation → Attack Surface → Proof Dashboard → Borrow Flow → Polish & Rehearsal.

---

## Status (current)

**Implementation complete.** All build tasks (1–5, 7–12, 14–18) and their property/unit tests are
done and wired; the frontend suite passes (20/20). The only items left are the three **manual
rehearsal checkpoints** (6, 13, 19), which are live walk-throughs against Arbitrum Sepolia — see
`context/DEMO_SETUP.md` for the run + act-by-act script.

Changes since this plan was written (reflected in code, not yet in the task bodies below):
- **Router redeployed** and is now **collateral-agnostic** (reads `pool.collateralToken()`), live at
  `0xF0AF8C84655a3E25Cf26Cb88E70E765C157515B2`. The demo trades the **WETH pool**.
- **USDC is 18-decimal** in this deployment, so `BorrowDemoTab` parses borrow with 18 decimals and
  pre-fills `lendingDebt / 1e18`.
- **Borrow approval is `WETH.approve(router)`** (ERC-20) — the user approves WETH collateral, not
  `ConditionalTokens.setApprovalForAll`. Tasks 15 / Requirement 11.3 describe the old plan.

---

## Tasks

- [x] 1. Data foundation — manifest, formatters, and URL utilities
  - Copy `contracts-sol/deployments/demo-manifest.json` to `frontend/public/demo-manifest.json` (or confirm the sync script is wired)
  - Verify `useDemoManifest` in `frontend/src/hooks/` fetches with `cache: "no-store"` and exposes the full `DemoManifest` type
  - Add manifest validation: assert `conditionId` is 66-char hex, `poolWeth`/`poolUsdc` are non-zero addresses, `l0` parses to positive `BigInt`; return `null` on failure
  - Add `arbiscanTxUrl(hash: string): string` and `arbiscanAddressUrl(address: string): string` helpers to `frontend/src/lib/formatters.ts`
  - Confirm `formatProbability` and `formatWad` are exported from `frontend/src/lib/formatters.ts`; add if missing
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 14.1, 14.2, 14.3_

  - [x]* 1.1 Write property tests for manifest validation and formatters
    - **Property 10: Formatter Safety** — for any `price ∈ [0n, 1e18n]`, `formatProbability` returns a `%`-terminated string; `formatWad` never throws; `arbiscanTxUrl` returns the correct URL prefix
    - **Property 11: Readiness allPass Consistency** — for any array of `ReadinessCheck`, `allPass ⟺ every check.status === "pass"`
    - Use fast-check in Vitest; file: `frontend/src/lib/__tests__/formatters.test.ts`
    - **Validates: Requirements 1.2, 14.1, 14.2, 14.3**

- [x] 2. Implement `usePreDemoReadiness` hook
  - Create `frontend/src/hooks/usePreDemoReadiness.ts`
  - Implement the 8-check evaluation algorithm from the design (manifest, chain, wallet, WETH balance ≥ 12 000 WAD, allowance, pool price readable/not frozen, Ponder synced, START\_BLOCK ≤ createdBlock)
  - Expose `{ checks: ReadinessCheck[], allPass: boolean, approveMaxWeth: () => void }`
  - Wire `approveMaxWeth` to `wagmi writeContract(ERC20.approve, router, MAX_UINT256)`
  - _Requirements: 5.1, 5.2, 5.3_

  - [x]* 2.1 Write unit tests for readiness evaluation
    - Table-driven tests covering all 8 check pass/fail/warn combinations using mock inputs
    - File: `frontend/src/hooks/__tests__/usePreDemoReadiness.test.ts`
    - _Requirements: 5.1, 5.2_

- [x] 3. Build `PreDemoReadinessPanel` component
  - Create `frontend/src/components/pre-demo-readiness-panel.tsx`
  - Render all 8 `ReadinessCheck` rows with pass/fail/loading/warning icons (lucide-react)
  - Render the inline "Approve Max" action button when allowance check is `"warning"`
  - Hide the entire panel when `presentMode = true` (read `?present=true` from TanStack Router search params)
  - Only render when `isDemoMarket = true`
  - _Requirements: 4.2, 5.1, 5.3, 5.4, 16.1_

- [x] 4. Implement `useAttackPresets` hook and transaction state machine
  - Create `frontend/src/hooks/useAttackPresets.ts`
  - Define the three presets: `{ label: "Probe", amount: "2000" }`, `{ label: "Whale", amount: "4000" }`, `{ label: "Kill Shot", amount: "6000" }` (WAD WETH)
  - Implement `minOut` computation: `floor((amountWad * 1e18n) / yesPriceWad) * 95n / 100n`
  - Implement TxState machine: `idle → wallet → pending → confirmed | failed`
  - Handle approval auto-check: if `wethAllowance < amountWad`, run approve first
  - Decode revert reasons: `Slippage()` selector → human-readable message; `Frozen()` → frozen message
  - Implement 60-second wallet timeout: revert to `"idle"` if no hash received
  - Call `onConfirmed()` exactly once on `"confirmed"` and trigger refetch
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x]* 4.1 Write property tests for slippage computation and tx state machine
    - **Property 3: Slippage Safety** — for any `yesPrice ∈ (0, 1)` and `amountWad > 0n`, verify `minOut ≤ floor(expectedOut × 0.95)` using fast-check `fc.float({ min: 1e-6, max: 1 - 1e-6 })` and `fc.bigInt({ min: 1n })`
    - **Property 3 edge cases**: `yesPrice` near 0 and near 1
    - File: `frontend/src/hooks/__tests__/useAttackPresets.test.ts`
    - **Validates: Requirement 3.2**

- [x] 5. Build `AttackPresets` component
  - Create `frontend/src/components/attack-presets.tsx`
  - Render exactly 3 preset buttons with label, amount, and description
  - Wire to `useAttackPresets` — show loading/wallet/pending/confirmed/failed states per button
  - Show gas cost estimate via `wagmi estimateGas` before confirmation
  - Display error messages for `Slippage()` and `Frozen()` reverts
  - Disable all buttons when `txState.phase = "failed"` with `Frozen()` error
  - Only render when `isDemoMarket = true`
  - _Requirements: 3.1, 3.5, 3.6, 4.1_

  - [x]* 5.1 Write unit tests for AttackPresets rendering
    - Test: 3 buttons present; correct labels/amounts; disabled state on Frozen; error message display
    - File: `frontend/src/components/__tests__/attack-presets.test.tsx`
    - _Requirements: 3.1, 4.1_

- [ ] 6. Checkpoint — verify end-to-end attack flow
  - Ensure all tests pass, ask the user if questions arise.
  - Manual check: `PreDemoReadinessPanel` shows all-green on a properly configured machine
  - Manual check: Probe preset executes a real Arbitrum Sepolia tx and price updates within 2s

- [x] 7. Implement `useDemoTrades` hook
  - Create or verify `frontend/src/hooks/useDemoTrades.ts`
  - urql query: `trades(where: { conditionId, poolType: "WETH" }, orderBy: size, orderDirection: asc, first: 8)`
  - Parse response into `DemoTrade[]` with all required fields
  - Expose `{ trades, isLoading, source, refetch }`; use `requestPolicy: "cache-and-network"` by default
  - On external trigger (post-confirm), switch to `requestPolicy: "network-only"`
  - Implement 5-attempt retry loop at 3-second intervals when trades array is empty after a confirmed tx
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x]* 7.1 Write property tests for trade parsing and sorting
    - **Property 9: Attack Trades Slice Bound** — for any list of `DemoTrade[]` of arbitrary length with mixed sides, `assembleDashboardData` returns `attackTrades.length ≤ 3` with all `side = 0` sorted ascending by size
    - File: `frontend/src/lib/__tests__/dashboardData.test.ts`
    - **Validates: Requirement 9.3**

- [x] 8. Implement `assembleDashboardData` pure function
  - Create `frontend/src/lib/dashboardData.ts`
  - Implement the assembly algorithm from the design: price precedence, reserve split, attack trades slice, fallback logic
  - Expose `assembleDashboardData(manifest, livePrice, liveReserves, trades): DashboardData`
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x]* 8.1 Write property tests for assembleDashboardData
    - **Property 7: Dashboard Price Float Bounds** — for any `livePrice ∈ [0n, 10^18n]`, `priceFloat ∈ [0.0, 1.0]`
    - **Property 8: Reserve Percentage Invariant** — for any reserves with positive total, `activePct + passivePct = 100`
    - **Property 1: Live Data Precedence** — for any defined `livePrice`, `displayPrice === livePrice`
    - File: `frontend/src/lib/__tests__/dashboardData.test.ts`
    - **Validates: Requirements 9.1, 9.2, 9.4**

- [x] 9. Build `AttackTranscript` component
  - Create `frontend/src/components/attack-transcript.tsx`
  - Render trade rows: block#, txHash (linked to Arbiscan via `arbiscanTxUrl`), size (WETH), P(YES) after, λ after
  - Sort rows ascending by size (guaranteed by `useDemoTrades` query, but assert in component)
  - Render skeleton loaders while `isLoading = true`
  - Render `DataSourceBadge source="indexed"` badge
  - When `source = "unavailable"`, show `DataSourceBadge source="unavailable"` and skeletons
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 13.2_

  - [x]* 9.1 Write unit tests for AttackTranscript
    - Test: Arbiscan links correctly formatted; skeleton state; unavailable badge; sort order preserved
    - **Property 2: Tx Hash Authenticity** — each rendered link href matches the input `DemoTrade.txHash` exactly
    - File: `frontend/src/components/__tests__/attack-transcript.test.tsx`
    - **Validates: Requirements 7.2, 13.2**

- [x] 10. Build `WCurveLive` component
  - Create `frontend/src/components/w-curve-live.tsx`
  - Static SVG path for W-curve (`λ*(p)` function), computed once via `useMemo` keyed on `lambdaWad`
  - Animate dot position to `price` using Framer Motion `motion.circle`
  - Accept `price: number` (0..1), `lambdaWad?: bigint`, `source: DataSource`
  - Mark pre-attack and post-attack positions when both are available
  - _Requirements: 8.1, 8.2_

- [x] 11. Build `LpShieldPanel` component
  - Create `frontend/src/components/lp-shield-panel.tsx`
  - Compute `activePct` and `passivePct` from `PoolReserves`
  - Render stacked bar: bright segment for active, dim segment for passive; label passive as "shielded %"
  - If `reserves` is `undefined`, render `DataSourceBadge source="unavailable"`
  - _Requirements: 10.1, 10.2, 10.3, 13.5_

  - [x]* 11.1 Write property tests for LpShieldPanel reserve math
    - **Property 8: Reserve Percentage Invariant** — for any `PoolReserves` with positive total, the rendered active% + passive% = 100
    - Use fast-check to generate arbitrary non-negative `bigint` quadruples
    - File: `frontend/src/components/__tests__/lp-shield-panel.test.tsx`
    - **Validates: Requirements 10.1, 9.2**

- [x] 12. Wire `/demo` route — replace simulated feed with live data
  - Edit `frontend/src/routes/demo.tsx`
  - Remove `useSimulatedFeed()` call
  - Add `useDemoManifest`, `usePoolPrice(manifest?.poolWeth)`, `usePoolReserves(manifest?.poolWeth)`, `useDemoTrades(manifest?.conditionId, "WETH")`
  - Call `assembleDashboardData(manifest!, price, reserves, trades)` and pass results to sub-components:
    - `WCurveLive` receives `dashboard.priceFloat` and `dashboard.lambdaWad`
    - `AttackTranscript` receives `dashboard.attackTrades`, `isLoading`, `source`
    - `LpShieldPanel` receives `dashboard.activePct`, `dashboard.passivePct` (or raw reserves)
    - `DemoProofDashboard` wraps the above three
  - Add `DataSourceBadge source="live"` to all live-read metrics
  - Add `DataSourceBadge source="indexed"` to indexed metrics
  - _Requirements: 8.3, 9.5, 13.1, 13.2_

- [ ] 13. Checkpoint — verify Proof Dashboard
  - Ensure all tests pass, ask the user if questions arise.
  - Manual check: after executing 3 demo trades, `/demo` shows 3 real tx hashes and W-curve dot at correct position

- [x] 14. Wire `/markets/:id` route — add AttackPresets and PreDemoReadinessPanel
  - Edit `frontend/src/routes/markets.$id.tsx`
  - Determine `isDemoMarket` by comparing route `conditionId` param with `manifest?.conditionId`
  - When `isDemoMarket = true`, mount `AttackPresets` inside `SwapTab` (replace or augment existing swap UI)
  - When `isDemoMarket = true`, mount `PreDemoReadinessPanel` in an expandable section above the swap area
  - Pass `onConfirmed` callback from `AttackPresets` to trigger `refetchTrades()`, `refetchPrice()`, `refetchReserves()`
  - Ensure `AttackModeStrip` receives all required props: `conditionId`, `pool`, `price`, `reserves`, `liquidity`, `mathLabel`, `mathMatches`, `indexed`, `indexerLoading`, `latestTx`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 15.1, 15.2_

  - [x]* 14.1 Write unit tests for demo mode isolation
    - **Property 4: Demo Mode Isolation** — verify that when `conditionId ≠ manifest.conditionId`, `AttackPresets`, `PreDemoReadinessPanel`, and `BorrowDemoTab` are absent from the rendered tree
    - File: `frontend/src/routes/__tests__/markets-id.test.tsx`
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 15. Build `BorrowDemoTab` component and wire into `/markets/:id`
  - Create `frontend/src/components/borrow-demo-tab.tsx`
  - Pre-fill collateral input with `manifest.lendingCollateral / 1e18` and borrow input with `manifest.lendingDebt / 1e18`
  - Display LTV = borrow/collateral and health factor explanation
  - Check `ConditionalTokens.isApprovedForAll(wallet, router)`; if `false`, execute `setApprovalForAll(router, true)` before borrow
  - On submit, call `Router.executeBorrow(lending, conditionId, wethCollateral, usdcBorrow)`
  - Wire TxState machine (reuse pattern from `useAttackPresets`)
  - Only render when `isDemoMarket = true`
  - Add `BorrowDemoTab` to the borrow tab slot in `markets.$id.tsx`
  - _Requirements: 4.3, 11.1, 11.2, 11.3, 11.4_

  - [x]* 15.1 Write unit tests for BorrowDemoTab pre-fill
    - **Property 12: Borrow Tab Pre-fill Accuracy** — for a given manifest, verify pre-filled values equal WAD-divided manifest fields
    - Test approval flow: `isApprovedForAll = false` triggers `setApprovalForAll` before borrow
    - File: `frontend/src/components/__tests__/borrow-demo-tab.test.tsx`
    - **Validates: Requirements 11.1, 11.3**

- [x] 16. Build `SimulationBanner` component and wire into `/simulate`
  - Create `frontend/src/components/simulation-banner.tsx`
  - Render a static amber banner containing all three required strings: "SIMULATION", "Client-side only", "No on-chain transactions"
  - Add explanation paragraph about why live resolution is not executed
  - Edit `frontend/src/routes/simulate.tsx` to mount `SimulationBanner` at the top of the crash scenario section
  - Ensure banner is NOT conditionally hidden by `presentMode`
  - _Requirements: 12.1, 12.2, 12.3_

  - [x]* 16.1 Write unit test for SimulationBanner
    - **Property 5: Simulation Transparency** — verify all three required strings are present in rendered output; verify banner renders regardless of `presentMode` prop
    - File: `frontend/src/components/__tests__/simulation-banner.test.tsx`
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 17. Implement `?present=true` presentation mode
  - Read `present` search param in the root layout or a shared context using TanStack Router's `useSearch`
  - Pass `presentMode: boolean` down via context or prop to `PreDemoReadinessPanel` and any `DataSourceBadge` debug labels
  - Add `.present-mode` CSS class to root container when active; use it to hide panels not needed for VC screen share
  - `SimulationBanner` must remain visible in present mode — verify no CSS rule hides it
  - _Requirements: 5.4, 16.1, 16.2, 16.3_

- [x] 18. Add `DataSourceBadge` to all metrics in `/demo` and `/markets/:id`
  - Audit every numeric display in `demo.tsx` and `markets.$id.tsx`
  - Attach `DataSourceBadge source="live"` to wagmi read results (price, reserves, liquidity, math kernel)
  - Attach `DataSourceBadge source="indexed"` to Ponder/urql results (trades, txHash, blockNumber)
  - Attach `DataSourceBadge source="manifest"` to values read from `useDemoManifest()` (l0, conditionId)
  - Attach `DataSourceBadge source="computed"` to `activePct`, `passivePct`, `priceFloat` derived values
  - Attach `DataSourceBadge source="unavailable"` on RPC error / indexer lag paths
  - Hide badges when `presentMode = true` (except those integral to the narrative)
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 16.2_

- [ ] 19. Final checkpoint — full 6-act rehearsal pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run full automated test suite: `cd frontend && bun run test --run`
  - Verify manual rehearsal checklist (from design):
    1. Fresh pool at P≈0.50 — `currentPrice()` read displays correctly
    2. Probe trade (2 000 WETH) — tx confirms, price updates, λ drops
    3. Whale trade (4 000 WETH) — transcript shows 2 trades with real hashes
    4. Kill Shot (6 000 WETH) — passive% > 80%
    5. `/demo` — W-curve dot at correct position, 3 trades with real tx hashes
    6. Click tx hash → Arbiscan opens correct transaction
    7. `/markets/:id` Borrow tab → execute borrow
    8. `/simulate` → SimulationBanner visible → trigger resolution

---

## Notes

- Tasks marked with `*` are optional property/unit tests — skip for fastest MVP path
- All code is TypeScript; no new npm packages may be introduced
- Existing hooks in `frontend/src/hooks/` (e.g. `useDemoManifest`, `usePoolPrice`, `usePoolReserves`, `useMathKernelStatus`, `useTokenAllowance`, `useTokenBalance`) should be reused as-is; add `usePreDemoReadiness` and `useAttackPresets` as new files
- Existing components (`AttackModeStrip`) require no changes — only their prop sources change
- All property tests use `vitest` + `fast-check`; run with `bun run test --run` from `frontend/`
- The `?present=true` mode must not break any existing route; it is purely additive hiding logic

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "4", "7", "8"] },
    { "wave": 3, "tasks": ["3", "5", "9", "10", "11"] },
    { "wave": 4, "tasks": ["6", "12"] },
    { "wave": 5, "tasks": ["13", "14", "15", "16"] },
    { "wave": 6, "tasks": ["17", "18"] },
    { "wave": 7, "tasks": ["19"] }
  ]
}
```
