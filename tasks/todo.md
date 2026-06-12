# New Frontend Integration — Plan

Branch `stylus-math`. New (Lovable) frontend fetched from `origin/stylus-math` (commits 7a3626c→ea4edec).
Beautiful redesign, but execution paths are mocked/disconnected + two critical regressions.
Approved approach: **wire real hooks into the new ExecutionTerminal shell**.

## Phase 0 — Correctness foundation (CRITICAL, demo-breaking)
- [ ] `config/contracts.ts` — restore verified-live addresses (broken router `0xab7A…` → `0xF0AF…`, stale factory/lending/resolver/oracle/math)
- [ ] `useAttackPresets.ts` — restore gas config (0.02/0.2 gwei) on writeApprove + writeContract; cast `wethAllowance` to bigint
- [ ] `borrow-demo-tab.tsx` — approval `WETH.approve(router)` not ConditionalTokens.setApprovalForAll; gas config; manifest.router; 18 decimals

## Phase 1 — TypeScript errors (12)
- [ ] Unify `DemoTrade` on `@/lib/dashboardData` (attack-transcript, activity-panel, ActivityRow render, test)
- [ ] `lp-shield-panel.tsx` — import `DataSource` from `./data-source-badge`
- [ ] `attack-presets.tsx` — `useEstimateGas` → `{ to, data: encodeFunctionData(...) }`
- [ ] `usePreDemoReadiness.ts` — cast wethBalance/wethAllowance to bigint
- [ ] `market-card.tsx` — `routes` → `routesActive`
- [ ] `markets.create.tsx` — cast resolver setState arg
- [ ] `__root.tsx` — type `search.present`
- [ ] `execution-terminal.tsx` — add props interface

## Phase 2 — Wire real execution into ExecutionTerminal
- [ ] Swap tab → real `<AttackPresets>` (Probe/Whale/Kill Shot buyYes, gas, manifest router)
- [ ] Borrow tab → real `<BorrowDemoTab manifest>` (executeBorrow)
- [ ] Thread manifest/addresses from markets.$id; live price
- [ ] Mount `<PreDemoReadinessPanel>` on terminal page (hidden in present mode)
- [ ] Manage/Provide/Redeem stay visual-only (not in 6-act demo)

## Phase 3 — Spec alignment
- [ ] `useDemoTrades.ts` — orderBy `timestamp` desc (was `size` asc)

## Phase 4 — Verify
- [ ] `tsc --noEmit` clean
- [ ] `vitest run` green
- [ ] `bun run build` succeeds
- [ ] dev smoke: /, /markets, /markets/$id, /demo, /simulate, present mode
- [ ] Commit as Sarnav07 (single, no co-author), remove git identity after

## Review — DONE

New frontend fetched (fast-forward to `origin/stylus-math` ea4edec) and wired to the live backend.

**Critical regressions fixed (demo-breaking):**
- `config/contracts.ts` reverted to the broken old router `0xab7A…` + stale factory/lending/resolver/oracle/math → restored all 9 verified-live addresses.
- `useAttackPresets.ts` lost its gas config → restored 0.02/0.2 gwei on approve + buyYes; WETH→router approval; manifest router; typed allowance.
- `borrow-demo-tab.tsx` approved ConditionalTokens + USDC@6dec → now `WETH.approve(router)`, USDC@18dec, gas config, manifest router.

**Execution wired into the new shell (approved approach):**
- `ExecutionTerminal` given a props interface; Swap tab → real `<AttackPresets>` (live buyYes), Borrow tab → real `<BorrowDemoTab>` (executeBorrow). Bottom no-op button hidden on wired tabs. Manage/Provide/Redeem stay visual.
- `markets.$id` passes manifest + mounts `<PreDemoReadinessPanel>` (hidden in present mode).
- `useDemoManifest` type gained `router` + validation (null on bad manifest → graceful degradation).
- `AttackTranscript` restored clickable Arbiscan tx links (Act 4/5) + unavailable state.

**Other fixes:** 12 TS errors (DemoTrade unified on dashboardData, DataSource import, useEstimateGas shape, readiness casts, SolverMeshStatus prop, root search typing, markets.create cast); `useDemoTrades` orderBy timestamp/desc; `react-katex` CJS interop on `/explorer`.

**Verification:** `tsc --noEmit` 0 errors · `vitest` 14/14 · `vite build` OK (client 4089 mods + SSR) · dev smoke: /, /markets, /markets/$id, /demo, /simulate, /explorer all 200, no error boundary, present mode OK, manifest served with router.

No files touched outside `frontend/` (backend dirs frozen). Did NOT add npm packages (katex deps were already declared; `bun install` synced the lock).
