# Demo Runbook — "Attack the Pool"

How to run and present the Omniverse live demo on Arbitrum Sepolia. Every number shown in the UI
is a real on-chain read or a confirmed transaction, except the final resolution simulation.

---

## What you're showing
A pm-AMM prediction market that defends itself: an attacker pushes P(YES) with large WETH buys, the
W-curve liquidity λ\* absorbs it (passive reserves shield the LP), the indexer proves every trade
on Arbiscan, then a liquidation-free borrow against a YES position — capped by a 6-act choreography
(landing → attack terminal → proof dashboard → Arbiscan → borrow → resolution sim).

---

## Prerequisites
```bash
bun --version    # or node v18+
forge --version  # only needed for a full redeploy
```

---

## Run the demo (against the existing live deployment — recommended)

The fixed router and market are already deployed; the committed `demo-manifest.json` points at them.
You do **not** need to redeploy — just start the two services.

```bash
# Terminal 1 — indexer (Ponder). Syncs from block 275,880,507 (manifest.createdBlock),
# ~271k blocks → a few minutes on the public RPC. GraphQL at http://localhost:42069/graphql
cd indexer && bun install && bun run dev

# Terminal 2 — frontend (React 19 / TanStack Start / wagmi v3 + RainbowKit / urql)
cd frontend && bun install && bun run dev
# Vite prints the dev URL on startup — open http://localhost:3000
# (it falls forward to 3001/3002… if 3000 is taken). Set
# VITE_WALLETCONNECT_PROJECT_ID in frontend/.env for WalletConnect (optional; injected
# MetaMask works without it).
```

The frontend reads `frontend/public/demo-manifest.json` → router
`0xF0AF8C84655a3E25Cf26Cb88E70E765C157515B2`, the WETH pool, lending, and the demo account. The
indexer reads the same manifest (factory/resolver/lending + start block), so the two stay in sync.

> Optional: put `PONDER_RPC_URL_421614=<your Arb Sepolia RPC>` in `indexer/.env` for a faster, less
> rate-limited sync (defaults to the public RPC). Add `DATABASE_URL` to use Postgres/Supabase
> instead of the bundled PGlite.

---

## Wallet setup
Import the demo account so trades and the borrow are pre-funded and pre-approved:

1. MetaMask → Import Account → paste `DEPLOYER_PRIVATE_KEY` from `contracts-sol/.env`
   (account `0x3a57622F51356fB925081A6D048BAA3eC35D9bAe`).
2. Add / switch to the **Arbitrum Sepolia** network (chainId 421614).
3. In the app, click **Connect Wallet** (RainbowKit, top-right of the terminal nav) and pick
   the injected MetaMask account.

This account holds WETH and has already approved the new router, so the attack presets and borrow
execute without an extra approval step. A fresh wallet works too — the terminal surfaces an
"Approve WETH" step and the readiness panel flags missing balance.

---

## The walkthrough (6 acts)

1. **Landing (`/`)** — the pitch. Click through to the demo market.
2. **Attack terminal (`/markets/:id`)** — the `AttackModeStrip` ticker shows live P(YES), λ\*,
   active/passive %, ℓ, L\_t, and the math-kernel badge. Expand the **Pre-Demo Readiness Panel** —
   all checks should be green (network, wallet, WETH balance ≥ 12,000, allowance, pool readable,
   indexer synced, START_BLOCK ≤ createdBlock).
3. **Execute attacks** — in the terminal's **Swap tab** (the execution panel on the right), use the
   quick-fill buttons in order against the **WETH pool**: **Probe (2,000 WETH) → Whale (4,000) →
   Kill Shot (6,000)**. Each fills the Pay amount; click **Buy YES** to fire it (first trade prompts
   an "Approve WETH" step). Each confirms in MetaMask; price ticks up and λ\* drops within ~2s.
   Passive % climbs past ~80% on the Kill Shot.
4. **Proof dashboard (`/demo`)** — the W-curve dot sits at the post-attack P(YES); the
   **Attack Transcript** lists the 3 trades with real tx hashes (indexed from Ponder); the
   **LP Shield** bar shows the active/passive split.
5. **Arbiscan verification** — click any tx hash → opens `sepolia.arbiscan.io/tx/...`. Real chain,
   real trades.
6. **Borrow flow (`/markets/:id` → Borrow tab)** — pre-filled from the manifest:
   **100 WETH collateral → 1,000 USDC borrow**. Step 1 approves WETH to the router (if needed);
   Step 2 calls `Router.executeBorrow(lending, conditionId, weth, usdc)`. Show the health-factor
   (∞ — no forced liquidation). Then **`/simulate`** — the amber `SimulationBanner` makes clear the
   resolution is client-side only (resolving live would destroy the demo pool); trigger it to show
   the net-settlement math.

> Bonus: **`/explorer`** is a standalone block/trade explorer with the live λ\*(P) math surface
> (KaTeX) — useful as a B-roll/“how it works” aside, not part of the 6-act flow.

**Present mode:** append `?present=true` to any route (e.g. `http://localhost:3000/markets/<id>?present=true`)
to hide the readiness panel and dev `DataSourceBadge`s for a clean screen share. The
`SimulationBanner` stays visible.

---

## Full redeploy (only if you need a fresh market)
Not required for the demo above. Use this to deploy everything from scratch.

```bash
./fresh-demo.sh
```
Redeploys the (collateral-agnostic) router, builds a fresh market + lending, writes `router` and a
fresh `createdBlock` into `demo-manifest.json` (and copies it to `frontend/public/`), then resets
the indexer's start block. Requires `contracts-sol/.env` with `DEPLOYER_PRIVATE_KEY`,
`ARB_SEPOLIA_RPC`, `FACTORY_ADDRESS`, `RESOLVER_ADDRESS`, and `ORACLE_ADDRESS`
(**ORACLE_ADDRESS must be set or the lending market is skipped → the borrow tab goes dead**).

---

## Troubleshooting
| Issue | Fix |
|-------|-----|
| Huge / absurd gas fee in MetaMask | Wallet has 0 WETH (mint or import the demo account), or the frontend is pointed at the old router — confirm `demo-manifest.json` `router` is `0xF0AF…515B2`. See HANDOFF.md. |
| Borrow amount looks 1e12× off | USDC is **18-decimal** in this deployment, not 6. Already handled in code; don't re-introduce `parseUnits(..., 6)`. |
| Indexer slow / stuck at genesis | It should start at 275,880,507 from the manifest. If it scans from ~0, a stale `START_BLOCK`/`FACTORY_ADDRESS` in `indexer/.env` is overriding it — remove them. |
| Indexer fails to start | `rm -rf indexer/.ponder && bun run dev` |
| No trades on `/demo` after a swap | Indexer lag — wait one block; the transcript retries automatically and falls back to the wagmi receipt hash. |
| Wrong network | Switch MetaMask to Arbitrum Sepolia (421614). |
| `Pool is frozen` on a preset | The market is too close to expiry; deploy a fresh one via `./fresh-demo.sh`. |
| Permission denied on script | `chmod +x fresh-demo.sh` |

---

## Key addresses (Arbitrum Sepolia)
```
OmniverseRouter: 0xF0AF8C84655a3E25Cf26Cb88E70E765C157515B2  (collateral-agnostic)
Demo account:    0x3a57622F51356fB925081A6D048BAA3eC35D9bAe
WETH:            0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204  (18 decimals)
USDC:            0xBCB53c282F9106f3CBD063824c657Cb5928AEB71  (18 decimals — deployed mock)
```
Full set lives in `frontend/src/config/contracts.ts` and the live `demo-manifest.json`.
Indexer GraphQL: `http://localhost:42069/graphql` · Frontend: `http://localhost:3000`.
