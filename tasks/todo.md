# Demo Unblock — Two Critical Bugs

## Bug 1 — Indexer ~100h sync
Root cause: `indexer/ponder.config.ts` hardcodes `START_BLOCK=274270902` (~1.88M blocks
below the live deploy block 275880507) and a stale factory/lending address (0xc164 / 0x4E24)
that don't match the live demo (factory 0xc3DF, lending 0x63878d). With no `.env.local`, Ponder
scans ~1.88M mostly-empty blocks on the rate-limited public RPC → ~100h, against the wrong factory.

- [x] Source factory/resolver/lending + startBlock from `demo-manifest.json` (single source of truth)
- [x] Treat `0` / zero-address env overrides as "unset" so a copied `.env.example` can't reintroduce genesis scan
- [x] Update `.env.example` so the zero placeholders can't override the manifest

## Bug 2 — Gas error on demo shots (buyYes) — silent revert, not OOG
Root cause: `Router.buyYes/buyNo/addLiquidity` are hardcoded to pull+split `usdc`, but the demo's
tradeable pool is the WETH pool (collateral = WETH) and the frontend approves WETH. The router pulls
USDC the user never approved → `usdc.transferFrom` reverts ("ERC20: allowance") → gas estimation
fails → MetaMask shows the absurd gas fee. Confirmed via live `cast call` (reverts `ERC20: allowance`).

- [x] Make Router swap fns collateral-agnostic via `pool.collateralToken()`
- [x] Deploy a fresh fixed Router in `SimulateArbDemo.s.sol` and write `router` into the manifest
- [x] Frontend reads `manifest.router` (fallback to config) for swap + borrow
- [ ] Verify: forge build + tests, frontend tsc

Note: borrow (`executeBorrow`) itself is NOT broken — live `cast call` succeeded (gas 334,825).
The borrow "gas error" in HANDOFF was the 0-WETH wallet case. executeBorrow correctly uses weth.

## Review (done)
Both root causes confirmed against the LIVE chain (head 276151638), not just by reading:
- Bug 1: indexer would scan ~1.88M blocks vs wrong factory (0xc164). Now manifest-sourced →
  factory 0xc3DF, lending 0x63878d, start 275880507 (271k-block scan). `.env.example` zero/0
  footgun closed. Verified by replaying the resolver in node.
- Bug 2: `cast call buyYes(poolWeth,…)` reverted `ERC20: allowance` (router pulled USDC, user
  approved WETH). Router now reads `pool.collateralToken()`. New `testRouterBuyYesOnWethPool`
  passes; it is the exact demo path that reverted.

Verification: forge 71/71 (+ new WETH-pool test), frontend vitest 20/20, tsc adds 0 new errors
(24 pre-existing both before/after), indexer config resolution replayed in node.

### Flagged items — NOW FIXED (user requested)
- borrow-demo-tab USDC 6→18 decimals (on-chain USDC.decimals()==18). Display sane + edits
  correct; 3 test mocks updated to 18-dec values. Default on-chain value unchanged (1e21).
- attack-presets useEstimateGas rewritten to correct `{to, data, account}` shape via
  encodeFunctionData (memoized + try/catch guard so invalid/loading args don't throw). Tooltip
  now actually estimates. tsc dropped 24→23.

### DEPLOY — DONE (router-only)
New OmniverseRouter @ 0xF0AF8C84655a3E25Cf26Cb88E70E765C157515B2 (Arb Sepolia, tx 0xb689…).
Chosen over fresh-demo because user's contracts-sol/.env had STALE infra (0xc164/0x7ae5/0x1b34).
Verified live (gasless): buyYes(poolWeth)→0x, executeBorrow→0x. Demo acct WETH pre-approved to
new router. Wired into config/contracts.ts + demo-manifest.json (x2) + arb-sepolia.json.
Fixed indexer/.env (removed stale FACTORY/LENDING/START_BLOCK overrides that reintroduced the
100h scan). Aligned contracts-sol/.env FACTORY/RESOLVER/ORACLE to live set. Key never read into
context (used sed). contracts.json (root) was a dead legacy registry off the demo path — deleted in cleanup.

### Run the demo
`cd indexer && bun run dev`  (syncs from 275880507; local PGlite by default)
`cd frontend && bun run dev`  (reads /demo-manifest.json → new router; VITE_WALLETCONNECT_PROJECT_ID set)

### Deploy — DONE (router redeployed)
The fixed router is live at `0xF0AF8C84655a3E25Cf26Cb88E70E765C157515B2`; the old `0xab7A`
bytecode is no longer used. The demo runs against the existing live market — no redeploy needed.

For a full from-scratch redeploy: `./fresh-demo.sh` redeploys the fixed router, writes `router`
+ fresh `createdBlock` into the manifest; the frontend reads `manifest.router` and the indexer
reads the manifest. Needs contracts-sol/.env with DEPLOYER_PRIVATE_KEY, ARB_SEPOLIA_RPC,
FACTORY_ADDRESS, RESOLVER_ADDRESS, ORACLE_ADDRESS (ORACLE_ADDRESS must be set or the lending
market is skipped → borrow tab dead).
