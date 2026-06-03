# OMNIVERSE — Implementation Plan

> *"Trade probability curves and borrow with zero liquidation risk — no trusted coordinator."*

**Team size:** 3 · **Format:** ~40-hour hackathon · **Chain:** Arbitrum Sepolia (only Stylus-enabled testnet path)

This plan is the synthesis of three parallel deep-dives (one per vertical), grounded in a full read of both source documents — the **pm-AMM** idea (Paradigm) + the **PA-AMM** whitepaper (Ko Sunghun, arXiv 2602.09887, Feb 2026) — plus an independent numerical verification of the project's headline math. Source files: `overview.md`, `Omniverse/omniverse_technical_spec-v2.pdf`, `Omniverse/pamm.pdf`.

---

## Overview

OMNIVERSE turns passive prediction bets into composable, liquidation-free DeFi collateral. A **Gaussian-score pm-AMM** prices binary YES/NO outcome tokens as live probabilities (`P = Φ((y−x)/L)`, closed-form, no oracle); a **PA-AMM** per-block liquidity partition (`λ`) plus pm-AMM's `√(T−t)` liquidity decay together bound LP losses; and a **Multiverse Lending** money market lets users borrow *same-outcome* debt against *same-outcome* collateral so loans **settle, never liquidate** when the event resolves. The headline tech is a **Rust→WASM (Arbitrum Stylus) fixed-point math kernel** for the on-chain Gaussian functions and the swap solver — 10–100× cheaper transcendental compute than EVM Solidity.

**Three deliberate architecture decisions** (updated after scaffolding):

1. **No native floats.** Stylus rejects all `f32`/`f64` ops at contract activation (determinism). The spec's "native floating-point WASM execution" would fail at deploy. → Use **fixed-point WAD (1e18)** math in Rust, with a Solidity `solstat`+PRBMath kernel as a hot-swap fallback behind one interface.
2. **Use Gnosis Conditional Tokens Framework (ERC-1155) for production.** The previous MVP plan used custom ERC-20 YES/NO tokens for lending convenience. That is no longer the target. Production OMNIVERSE should use CTF positions as canonical outcome assets, with ERC-1155-aware pool/lending custody and optional ERC-20 wrapper adapters only where an integration truly requires ERC-20 semantics.
3. **Hybrid Stylus + Solidity, not Stylus-only.** Isolate all toolchain risk to one small, stateless Rust math kernel; everything else (pool shell, CTF adapters/custody, lending, factory, resolver) in Solidity/Foundry.

---

## Current Implementation Status

**Already done**

- `contracts-stylus/` math kernel exists and implements fixed-point `phi`, `Phi`, `PhiInv`, `solveSwap`, `poolValue`, and `lambdaStarGaussian`.
- Host-side Rust tests cover Gaussian primitives, inverse-CDF round trips, solver behavior, pool value, and lambda symmetry/tail behavior. Latest local run: `cargo test` passed **37/37**. `cargo clippy` passes cleanly.
- `contracts-stylus/Stylus.toml` has been added. `cargo stylus check --verbose` now builds the WASM and reports compressed contract size **20.5 KB / 20,476 bytes** (under the 24 KB target).
- `contracts-sol/` Foundry project has been initialized.
- `contracts-sol/src/interfaces/IOmniverseMath.sol` exists and matches the actual Stylus selectors, including case-sensitive `Phi` and `PhiInv`.
- `contracts-sol/src/PmAmmPool.sol` scaffold exists with active/passive reserve accounting, `buyYes`, `buyNo`, dynamic/static lambda rebalance, and `uint128` guardrails before calls into the Stylus kernel.
- Foundry tests for the pool wrapper exist, including oversized-input interception before the math boundary. Latest local run: `forge test -vv` passed **6/6**.

**Still left to do**

- Complete the RPC-backed activation portion of `cargo stylus check` against a Stylus-enabled local Nitro node or Arbitrum Sepolia RPC. Current blocker: no RPC is listening at the default `http://localhost:8547`.
- Replace the pool scaffold's simplified accounting with full token custody and ERC-1155 CTF transfers.
- Implement CTF condition preparation, split/merge/redeem flows, and the production resolver/UMA path.
- Implement `MarketFactory`, `MultiverseLending`, CTF position bookkeeping, Chainlink integration, and same-condition/same-outcome enforcement.
- Add integration tests connecting the Solidity pool to either a deployed Stylus kernel or a high-fidelity Solidity mock with the exact same rounding and failure behavior.
- Build the frontend, Ponder indexer, deploy/seed/reset scripts, and demos.
- Revisit the exact `L_t = L0 * sqrt(T - t)` scaling in Solidity before demo deployment; the scaffold uses a placeholder integer convention that must be normalized against WAD/time units.

---

## ⚠️ The λ*(P) Verdict — read this before you pitch the math

The project's hero research claim is a **dynamic** optimal activeness `λ*(P)` for the Gaussian pm-AMM invariant, versus the whitepaper's **constant** `λ*` for G3M pools. We pressure-tested it analytically and numerically. **The conclusion shapes how you build *and* how you present.**

| Sub-claim | Verdict | Evidence |
|---|---|---|
| z-gap dynamics are **exactly AR(1)** for the pm-AMM invariant (no `O(g²)` remainder, unlike G3M) | ✅ **TRUE — the genuine novelty** | `z_new = λ·z_true + (1−λ)·z_old` verified to max error **4.4e-16** across a λ×z grid. The paper's own G3M AR(1) is only a Taylor approximation (`|r(g)|≤g²/8`, their eq 21). Ours is exact because `z=(y−x)/L` is linear and the partition is degree-0 homogeneous. |
| `v(z) = φ(z)+z(2Φ(z)−1)` is the pool value; `φ(z)` is the LVR curvature | ✅ **Exact identities** | `V(z)=(1−P)x(z)+P·y(z)=v(z)` and `LVR≈½φ(z)g²` both verified to machine precision. |
| The λ*(P) **curve** reproduces the overview table | ✅ **Self-consistent** | Independently recomputed at γ'=2: P=0.5→**0.427**, 0.2/0.8→**0.479** (peak), 0.05/0.95→**0.431**, 0.01/0.99→**0.295**, 0.001/0.999→**0.134**. Symmetric in P↔1−P (because `v(z)·φ(z)` is even in z), monotone, →0 at resolution. |
| The *specific* weighting `γ_G(z)=γ'/(2·v(z)·φ(z))` is the **unique optimum** forced by the index-tracking objective | ⚠️ **NO — it is a defensible modeling choice, not a theorem** | Following the paper's own TE-vs-LVR recipe with a `w'(z)`-based tracking error gives a *different*, non-constant ratio. `v(z)·φ(z)` is a reasonable value-weighting; the *shape* it produces (auto-shutdown near resolution) is correct and desirable, but the exact numbers are not uniquely justified. |

**Build decision:** compute `λ*(P)` on-chain as the hero feature, but **behind a `useDynamicLambda` flag with a constant-λ = 0.5 governance fallback**, so the live demo never depends on the unproven step.

**Pitch decision (honesty wins technical judges):**
- **Claim as proven:** exact AR(1) z-dynamics (strictly cleaner than G3M's approximation); `v(z)`/`φ(z)` exact identities; correct boundary behavior (`λ*→0` as `P→0/1`, i.e. the pool auto-locks reserves exactly when informed traders are most dangerous).
- **Frame as novel construction, not theorem:** the specific `γ_G` weighting and exact λ*(P) numbers. Say *"first PA-AMM construction for a non-G3M invariant with an exact-dynamics core,"* **not** *"first closed-form optimal PA-AMM for non-G3M."*
- **Credit the formal bounded-loss guarantee to pm-AMM's `L_t=L₀√(T−t)` decay (`E[LVR]=V₀/2T`)** — that is the rigorous result. The PA-AMM λ is an additional, empirically-motivated LVR reducer.

---

## Architecture Diagram (ASCII)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND  ·  Vercel   ·  [ Dev C ]                          │
│   Next.js 15 (app-router) · wagmi v2 · viem · RainbowKit · Recharts · Framer     │
│   /markets   /markets/[id]   TradePanel · LP(λ)Panel · LendingPanel              │
│   Demo 1 Zero-Liquidation (synced crash) · Demo 2 λ-Explorer (offline TS math)   │
│   Demo 3 PA-AMM Visualizer (offline)                                             │
└──────┬──────────────────────────────────────────────────────┬────────────────────┘
       │ viem reads/writes (poll 2s, fallback() RPC transport) │ GraphQL (poll 3s)
       ▼                                                        ▼
┌──────────────────────────────────────────────┐   logs   ┌──────────────────────────┐
│           ARBITRUM SEPOLIA (chain)            │ ───────► │  Ponder Indexer · Railway │
│                                               │          │  [ Dev C ]                │
│  ┌─────────────────────┐                      │          │  OmniverseTrade events    │
│  │ MarketFactory  [B]  │ deploys/registers    │          │  one-sided volume acct.   │
│  └─────────┬───────────┘                      │          │  → GraphQL (vol, history) │
│            ▼                                   │          └──────────────────────────┘
│  ┌─────────────────────┐  IOmniverseMath  ┌─────────────────────────────────────┐  │
│  │ PmAmmPool      [A]   │ ───────────────► │ OmniverseMath  STYLUS/Rust→WASM [A] │  │
│  │ PA-AMM λ*(P) split   │ ◄─────────────── │ fixed-point WAD: Φ(z) φ(z) Φ⁻¹(p)   │  │
│  │ L_t=L₀√(T−t) decay   │                  │ solveSwap() Newton+bisection        │  │
│  │ swap/quote · emits   │                  │ lambdaStarGaussian(γ',P)             │  │
│  │ OmniverseTrade       │                  │ (Solidity solstat+PRBMath fallback) │  │
│  └─────────┬───────────┘                  └─────────────────────────────────────┘  │
│            │ price P=Φ(·) + gap g                                                   │
│            ▼                                                                        │
│  ┌─────────────────────┐  holds/values  ┌─────────────────────────────────────┐   │
│  │ MultiverseLending[B] │ ─────────────► │ Gnosis CTF + adapters      [B]      │   │
│  │ HF=C·pETH·LTV(g)/D   │                │ ERC-1155 YES/NO positions          │   │
│  │ gap-haircut · 0-liq  │                │ 1 conditionId → {WETH mkt, USDC mkt}│   │
│  └────┬──────────────┬──┘                └──────────────────┬──────────────────┘   │
│       │ Chainlink ETH/USD (within-universe)                 │ resolves              │
│       ▼                                                     ▼                       │
│  ┌─────────────────────┐                  ┌─────────────────────────────────────┐  │
│  │ Chainlink ETH/USD    │                 │ Resolver  owner(demo) | mock-UMA(prod)│ │
│  └─────────────────────┘                  └─────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
   [A] = Dev A (Stylus/Math)   [B] = Dev B (Solidity lending/markets)   [C] = Dev C (Frontend/Infra)
```

---

## Components

### Smart Contracts

All cross-contract calls use these **frozen interfaces** (agreed day-0; mock until live addresses exist):

```solidity
// IOmniverseMath — Stylus(Rust)↔Solidity, all WAD 1e18; z/d/gap signed int256, prob/reserves uint256
function phi(int256 z)  external pure returns (uint256);            // Gaussian PDF φ(z)
function Phi(int256 z)  external pure returns (uint256);            // Gaussian CDF Φ(z) ∈ [0,1]
function PhiInv(uint256 p) external pure returns (int256);         // inverse CDF Φ⁻¹(p); selector case matters
function solveSwap(uint256 x1,uint256 y0,uint256 ell) external pure returns (uint256 y1);
function poolValue(int256 z) external pure returns (uint256);      // v(z)
function lambdaStarGaussian(uint256 gammaPrime,uint256 p) external pure returns (uint256); // dynamic λ*(P)

// Unified event (one-sided volume) — side: 0=buyYes 1=sellYes 2=buyNo 3=sellNo; size = one-sided notional
event OmniverseTrade(uint256 indexed marketId,address indexed trader,uint8 side,uint256 size,
                     uint256 priceWad,uint256 ellWad,uint256 lambdaWad,int256 gapWad,uint64 timestamp);
```

#### 1. OmniverseMath — *Stylus / Rust→WASM, stateless, fixed-point WAD(1e18)* · **[Dev A]**

Pure functions, no storage; `no_std`, `panic=abort`, `opt-level="z"`, `lto=true`, strip. All math in `alloy_primitives::{I256,U256}` — **never `f64`** (a single float literal or `as f64` bricks activation; `cargo stylus check` is the gate).

- **`phi(z)`** — `φ(z)=exp(−z²/2)/√(2π)`; clamp `z∈[−8,8]` (→0 outside); `exp` via PRBMath-style SD59x18 port; multiply by `0.398942280401432677` WAD; round **down** (pool-favoring).
- **`Phi(z)`** — A&S **26.2.17** (`t=1/(1+0.2316419|z|)`, abs err 7.5e-8, 5 mults; matches solstat's ~1.2e-7) for MVP; symmetry `Φ(z)=1−Φ(|z|)` for z<0; clamp to `[0,1e18]`. Verified: Φ(0)=0.5, Φ(1.96)=0.97500, φ(0)=0.39894, Φ(−1)+Φ(1)=1.
- **`PhiInv(p)`** — Acklam/Beasley-Springer-Moro rational approx + **one Halley step**; tested max err **1.78e-13** in z-units over p∈[1e-4,1−1e-4]; clamp z∈[−8,8]; revert on p≤0 or p≥1. Selector case matters: Solidity must call `PhiInv`, not `phiInv`.
- **`solveSwap(x1,y0,ell)`** — the **only** function that solves (quotes are closed-form). Invariant `f(x,y,L)=(y−x)Φ(z)+Lφ(z)−y=0`. Use `f'(y)=Φ(d)−1∈(−1,0)` ⇒ unique root ⇒ **safeguarded Newton + bisection fallback**; bracket `[0, x1+y0+ell]`; `MAX_ITER=40`; **REVERT** if `|f|>EPS` (never silently return); round output reserve **up**; floor `ell≥L_MIN=1e6`.
- **`lambdaStarGaussian(γ',p)`** — `z=PhiInv(p)`; `v=φ(z)+z(2Φ(z)−1)`; `γ_G=γ'/(2·v·φ(z))`; `λ*=(1+√(1+2γ_G))/(1+γ_G+√(1+2γ_G))` (PRBMath `sqrt`). **Near-resolution guard:** clamp `φ(z)≥φ_MIN≈1e-9` and `λ*∈[0.05e18, 1e18]`. In the Solidity pool, dynamic mode is controlled by `useDynamicLambda`; constant fallback uses `0.5e18`. Curve verified against the overview table (see λ*(P) Verdict).
- **WASM budget:** A&S Φ + Acklam Φ⁻¹ + PRBMath-equiv exp/sqrt fit comfortably under the **24KB compressed** limit; the solver is the only loop.

#### 2. PmAmmPool — *Solidity* · **[Dev A]**

Storage (per market): `xActive,xPassive,yActive,yPassive, L0,T,ellActive, lambdaWad, nLast, useDynamicLambda, gammaPrimeWad, createdAt, IOmniverseMath math` (x=NO reserve, y=YES reserve; YES price = `Φ((y−x)/L)`).

- **Per-block rebalance (once/block, on first interaction):** merge passive→total → compute `Lt=L0·√(T−t)` → `z=(yT−xT)/Lt` → `p=Φ(z)` → `lam = useDynamicLambda ? lambdaStarGaussian(γ',p) : 0.5e18` → repartition `{x,y}Active=lam·total`, `ellActive=lam·Lt` → set `nLast`.
- **Degree-0 homogeneity (exact, verified):** scaling reserves *and* L by λ leaves `z` invariant ⇒ the active sub-pool quotes the **identical probability** at λ× depth. Pricing is free; only swap depth changes.
- **Swap flow:** `_rebalance()` → `out=solveSwap(...)` → `require(out≥minOut)` → update active reserves → **assert** `φ(R_after)≥φ(R_before)` and `|invariant|<EPS` → emit `OmniverseTrade`.
- **Near-T safety:** **freeze swaps** when `T−now < FREEZE_WINDOW` (ellActive→0, numerics blow up, informed-trader edge is maximal); redeem-only after T.

#### 3. Gnosis CTF ConditionalTokens — *ERC-1155 canonical outcomes* · **[Dev B]**

Use the **Gnosis Conditional Tokens Framework** as the source of truth for all outcome positions. Each collateral universe is a CTF condition/collateral pair, represented by ERC-1155 position ids rather than bespoke ERC-20 contracts.

- **CTF primitives:** `prepareCondition(oracle, questionId, 2)`, `splitPosition(collateral, parentCollectionId, conditionId, partition, amount)`, `mergePositions(...)`, and `redeemPositions(...)`.
- **Binary partition:** YES/NO use the standard two-outcome partition, e.g. index sets `[1, 2]`. The factory stores `yesPositionId` and `noPositionId` for each `(conditionId, collateralToken)` pair.
- **Pool custody:** `PmAmmPool` holds ERC-1155 YES/NO positions directly. Swaps move balances by `safeTransferFrom` or internal custody accounting after users approve the pool via `setApprovalForAll`.
- **Lending custody:** `MultiverseLending` escrows ERC-1155 collateral/debt positions directly. If an external integration needs ERC-20, add a thin audited wrapper around a single CTF `positionId`; do not replace CTF as the canonical asset.
- **Conservation invariant:** for each collateral universe, CTF split/merge guarantees one full set of YES+NO positions is backed by one unit of collateral. Tests assert ERC-1155 balances and collateral escrow, not ERC-20 total supplies.
- **One event condition, two collateral universes:** the same `conditionId` is paired with **WETH collateral** (YES-WETH / NO-WETH collateral leg) and **USDC collateral** (YES-USDC / NO-USDC debt leg), so positions resolve simultaneously and identically. `marketsOfCondition[conditionId]` enumerates both collateral universes and their position ids.

#### 4. MultiverseLending — *Solidity, the killer feature* · **[Dev B]**

Deposit conditional collateral, borrow **same-universe** debt; settle at resolution.

- **HF excludes P(YES) — the safety proof, written out:** with collateral `C` YES-ETH and debt `D` YES-USDC on the same condition, `p=P(YES)`:
  ```
        C·p·p_ETH·LTV_max(g)     C·p_ETH·LTV_max(g)
  HF = ───────────────────── = ────────────────────   ← p cancels (shared condition)
              D·p·1                     D
  ```
  A 50-point swing in P(YES) moves HF by **zero**. The only surviving risk is `p_ETH`, the **within-universe ETH/USD** price (Chainlink) — exactly an ordinary over-collateralized loan's risk.
- **Gap-haircut LTV (clamped-linear, monotone, no `exp`):** `LTV_max(g)=LTV_base·(1 − min(1,|g|/g_cap)·h)`, e.g. `LTV_base=0.80e18`, `h=0.50e18`. The gap is the PA-AMM's **log-price gap** `g=ln(P_active/P_full)` with stationary variance `E[g²]=σ²Δt/(λ(2−λ))` (paper Prop 2). **`g_cap` self-calibrates:** `g_cap = k·√(σ²Δt/(λ(2−λ)))`, `k≈3` (≈3 stationary σ). Hardcoded constant is the fallback.
- **Both-universe settlement solvency (proof sketch):** *YES* → YES-ETH redeems for WETH worth `p_ETH`, YES-USDC redeems 1:1; `C·p_ETH−D≥0` (guaranteed by `HF≥1` at origination) → lender whole, borrower keeps equity. *NO* → YES-ETH **and** YES-USDC → 0 simultaneously → collateral worth 0, debt worth 0 → net P&L 0, no shortfall. Rests on **simultaneity** (shared conditionId) + **same-leg origination**.
- **Supply side (non-obvious correctness trap):** seed the borrowable reserve in the **CTF position id for YES-USDC** — obtained by splitting USDC through CTF — **never raw USDC the protocol expects back unconditionally**. Otherwise the NO universe is silently insolvent.
- **Interest = zero/flat for MVP** (the innovation is liquidation-free *settlement*, not the rate curve). `settle(marketId)` is idempotent & permissionless once resolved.

#### 5. MarketFactory · **[Dev B]**
`createEvent(question, T, resolver, L0, λ)` → derive CTF `questionId` → call `prepareCondition(resolver, questionId, 2)` → derive/store the shared `conditionId` → split/register the **two collateral universes** (WETH + USDC) under it → deploy a **PmAmmPool** per tradeable CTF collateral universe wired to `OmniverseMath` → register the lending pair in `MultiverseLending` → `getMarkets()` enumeration for the grid. MVP ships **one** pre-seeded event.

#### 6. Resolver · **[Dev B]** — keep "price oracle" and "event resolver" strictly separate
| | Answers | MVP | Production |
|---|---|---|---|
| **AMM price** | fair price now? | none — `P=Φ(·)` + internal gap `g` | same (the real "no trusted coordinator" claim) |
| **Within-universe price** | ETH/USD inside YES? | Chainlink ETH/USD | same |
| **Event resolution** | did it happen? | owner-resolve | mock-UMA optimistic (propose/dispute/finalize) |

> Do **not** pitch the demo resolver as trustless — only the AMM *price* is coordinator-free.

#### 7. *(Phase 2 / stretch)* DistributionMarket — *Stylus*
Parametric `N(μ,σ²)` markets; trade μ-shares/σ-shares; PA-AMM rate-limits per-block μ/σ updates; on-chain `p(z)=1/(σ√2π)·e^(−(z−μ)²/2σ²)`. Independent module; only after the MVP demos work.

### Frontend · **[Dev C]**

*Next.js 15 app-router · wagmi v2 · viem · RainbowKit · TanStack Query v5 · Tailwind/shadcn · Recharts · Framer Motion.*

- **Providers** (`"use client"`): `WagmiProvider → QueryClientProvider → RainbowKitProvider`; chain `arbitrumSepolia`; **`fallback([http(primary), http(publicRpc)])`** transport (RPC failover for the live demo); connectors `injected()` + `walletConnect`.
- **Real-time = block-polling, not WebSockets:** `useWatchContractEvent({poll:true, pollingInterval:2000})`; `useWaitForTransactionReceipt → invalidateQueries()` after own txs; Ponder GraphQL `refetchInterval:3000`.
- **`/markets`** — `MarketCard` grid: question, YES% (`currentPrice()`), Recharts sparkline + 24h volume (Ponder), expiry countdown.
- **`/markets/[id]`** — `ProbabilityChart` (area, real-time point appended per `OmniverseTrade`), `ReservesGauge` (xActive/xPassive/yActive/yPassive, L, live `L_t`, λ split bar), `ExpiryCountdown` (disables trading at T), and the three panels.
- **TradePanel** — `useQuote(side,size)` → shows `out`, price-after (as YES%), impact → `buyYes/sellYes/buyNo/sellNo(size,minOut)`, `minOut=out·(1−slippage)`. Price is displayed as probability ("35% YES").
- **LP(λ)Panel** — `R_active` vs `R_passive` stacked bar; add/remove liquidity; projected LVR bound `V₀/(2T)`; λ read-only here (interactive λ lives in Demo 2).
- **LendingPanel** — deposit/borrow; **HF radial gauge** driven by `healthFactor` (green >1.5 / yellow / red <1); gap `g` readout; persistent **"No liquidation — settles at resolution"** banner.
- **Hooks:** `useMarket`, `useMarketList`, `useQuote`, `useTrade`, `useLiquidity`, `useLending`, `usePonderQuery`. **`lib/lambdaMath.ts`** holds the offline Demo-2 math. **`lib/formatters.ts`** must divide WAD by `1e18` before display (forgetting this shows `350000000000000000%`).

### Backend / Off-chain · **[Dev C]**

- **Indexer: Ponder** (TS-native, Railway + Postgres, auto GraphQL — The Graph hosted service is deprecated). Tables `Market` (totalVolume, lastPrice, expiry) and `Trade`. **One-sided volume accounting:** the handler sums **only `Trade.size`** (the amount-in) → `totalVolume`, `priceHistory`; `volume24h` filtered client-side (`timestamp > now−86400`). No double-counting.
- **No bespoke REST API** — frontend reads contracts directly for live state, Ponder GraphQL for aggregates.
- **Scripts:** `Deploy.s.sol`, `SeedMarket.s.sol` (prepare CTF condition + split WETH/USDC positions + add liquidity + open both Demo-1 loans), `TriggerCrash.s.sol` (resolve CTF condition + `settle()`), `ResetDemo.s.sol`, `faucet.ts` (mint test WETH/USDC), `tradeBot.ts` (drip trades to populate price history pre-demo).

### Infrastructure · **[Dev C, with Dev A on Stylus toolchain]**

- **Monorepo:** `contracts-stylus/` (cargo-stylus, `stylus-sdk ^0.10`, Rust 1.88+, `no_std`), `contracts-sol/` (Foundry), `web/` (Next.js), `indexer/` (Ponder), `scripts/`.
- **Local dev:** Arbitrum **Nitro `--dev`** node (Docker, Stylus-enabled) at `:8547` → `cargo stylus deploy` then `forge script Deploy/SeedMarket`. Budget **~14M gas/Stylus activation**.
- **Deploy targets:** frontend→**Vercel**, indexer→**Railway** (persistent Postgres volume so Ponder resumes from checkpoint, not genesis), contracts + Stylus kernel→**Arb Sepolia**.
- **Env/secrets:** `DEPLOYER_PK`, `ARB_SEPOLIA_RPC`, `NEXT_PUBLIC_RPC_URL_PRIMARY` (+ public fallback), `NEXT_PUBLIC_WC_PROJECT_ID`, `NEXT_PUBLIC_CONTRACT_{FACTORY,POOL,LENDING,CTF,MATH}`, `NEXT_PUBLIC_MARKET_ID`, `NEXT_PUBLIC_INDEXER_URL`, `DATABASE_URL`, `CHAINLINK_ETHUSD_FEED`, `NEXT_PUBLIC_USE_MOCK`.
- **CI (optional):** GitHub Actions — `cargo stylus check` (float-free gate), `forge test -vv`, `tsc --noEmit` + `ponder typecheck`.

### Integrations

- **Arbitrum Stylus SDK** (Rust, `sol_interface!` for Rust↔Solidity ABI calls).
- **solstat** (Primitive Finance — on-chain Φ/φ, err ~1.2e-7; ⚠️ **AGPL — license-check** before bundling) + **PRBMath** (`SD59x18`: exp/ln/sqrt/mulDiv) — the Solidity fallback kernel behind `IOmniverseMath`.
- **Chainlink ETH/USD** (Arb Sepolia aggregator) — within-universe price for HF; revert HF-relevant actions if `answer≤0`, `answeredInRound<roundId`, or older than heartbeat (~3600s). Fail **closed**.
- **RainbowKit / wagmi / viem**, **Recharts**, **Ponder**.
- **Gnosis Conditional Tokens Framework** (ERC-1155 canonical outcome positions), **UMA Optimistic Oracle** production resolver path.

### The Three Demos · **[Dev C]**

- **Demo 1 — Zero-Liquidation** (visceral; `/demos/zero-liquidation`): two synced panels, one **"Trigger Crash"** click. Left = simulated Aave loan with a **probability-driven** HF → animates 1.4→0.7, red **"LIQUIDATED"** stamp + penalty counter. Right = OMNIVERSE → collateral **and** debt animate to 0 *simultaneously*, green flash **"Event Resolved: Loan Settled Safely (Net P&L: 0)."** On-chain path calls `settle()`; `USE_MOCK` path drives animations from a snapshot. **"Reset Demo"** re-arms via `ResetDemo.s.sol` (~15s; test 3×).
- **Demo 2 — λ Explorer** (research showpiece, **offline, guaranteed to work**; `/demos/lambda-explorer`): pure-TS `lambdaMath.ts` — `phi`, `Phi`, `PhiInv`, `v(z)=φ(z)+z(2Φ(z)−1)`, `gammaG(γ',z)`, `lambdaStarG3M(γ)`, `lambdaStarGaussian(γ',P)=lambdaStarG3M(gammaG(γ',PhiInv(P)))`, `simulateLvr(...)`, `computeFrontier(...)`. Sliders λ/γ'/P + "Informed Trader Attack" toggle; two Recharts panels (LVR drain over blocks: dynamic λ*(P) vs constant λ; the LVR-vs-tracking-error efficient frontier with a live marker). All `useMemo`, no network. **Validate before demo:** `lambdaStarGaussian(2,0.001)≈0.134`, `(2,0.5)≈0.427`, `(2,0.2)≈0.479` — these numbers are in the pitch; if they don't match, fix the TS, not the slide.
- **Demo 3 — PA-AMM Visualizer** (education; `/demos/pa-amm-visualizer`): block-by-block animation — reserves split into active(green)/passive(gray), arbitrageur trades the active bucket, merge + repartition, λ* adapts as P drifts to resolution; `P_active` vs `P_true` gap tracker. Same offline `lambdaMath.ts`.

---

## Division of Work

### Strategy 1: By Layer (recommended for this 3-person team)

| Dev | Owns | Why this split |
|---|---|---|
| **Dev A — Stylus / Math** | `OmniverseMath` (Φ, φ, Φ⁻¹, solveSwap, lambdaStarGaussian) in fixed-point Rust + the Solidity `solstat` fallback behind `IOmniverseMath`; **`PmAmmPool`** (PA-AMM partition + `L_t` decay + `OmniverseTrade`); the λ*(P) math verdict; Stylus toolchain/CI; reference values + formulas for Demo 2/3. | Hardest + most novel; kernel and pool are tightly coupled through the math, so one owner avoids an interface seam mid-build. **Starts first.** |
| **Dev B — Solidity / Lending** | Gnosis CTF integration/adapters, `MultiverseLending` (HF + gap-haircut + both-universe settlement), `MarketFactory`, `Resolver`, Chainlink wiring, the security checklist, Demo-1 contract/script support; Foundry tests. | Self-contained Solidity surface; consumes Dev A's pool reads (`currentPrice`, `gap`) and CTF position ids/balances end-to-end. |
| **Dev C — Frontend / Infra** | Next.js app + wallet, Trade/LP/Lending panels, **all three demo dashboards** + the Demo-2 TS math port, Ponder indexer, Vercel/Railway, seed/faucet/crash/reset scripts, demo hardening, monorepo/CI. | Broadest but lowest-novelty; can start against mocked ABIs day-0 and swap in live addresses as A/B deliver. |

**Freeze in M0 (day-0 contract between devs):** `IOmniverseMath`, the `OmniverseTrade` event schema, and the pool/lending read ABIs (all given above). Dev C mocks these until live addresses exist.

### Strategy 2: By Feature (vertical slices)

- **Slice 1 — Trading** *(A + C)*: pm-AMM pool + Stylus math + Trade UI + probability chart + indexer wiring. **Critical-path producer of the price feed everyone consumes.**
- **Slice 2 — LP & Protection** *(A + C)*: PA-AMM λ*(P) partition + LP UI + **Demo 2 λ-Explorer** + LVR/decay charts.
- **Slice 3 — Lending & Settlement** *(B + C)*: Gnosis CTF positions + MultiverseLending + Lending UI + **Demo 1 Zero-Liquidation**.
- **Slice 4 — Infra & Resolution** *(B + C)*: Factory + Resolver + indexer + deploy/seed/faucet + hardening.

> With 3 people the By-Layer split is cleaner (disjoint file ownership, fewer merge conflicts). By-Feature is the fallback if you want each dev to own a demo end-to-end. Either way: **agree the CTF position-id + pool interfaces on day 1**; Slice 1 unblocks the rest.

---

## Build Order / Dependency Chain

1. **M0 — Spike & scaffold.** Monorepo; freeze `IOmniverseMath` + `OmniverseTrade`; prove **`cargo stylus check` passes on a fixed-point Φ stub** on a local Nitro `--dev` node; Next.js + RainbowKit shell against mocked ABIs. **Gate: if Stylus is blocked by hour 4, switch to the Solidity `solstat` kernel and keep moving.**
2. **OmniverseMath + CTF integration** (independent, parallel). Math has no deps; CTF integration needs the resolver/oracle interface and collateral-token mocks. **Demo 2 can be built now** (pure TS, no contracts).
3. **PmAmmPool + MarketFactory** — need OmniverseMath + CTF position ids/custody. Unblocks Trade UI + indexer.
4. **MultiverseLending + Resolver** — need PmAmmPool (price/gap) + CTF positions. Unblocks Demo 1.
5. **Indexer + LP/charts + hardening + pitch** — need deployed contracts + the `OmniverseTrade` event.
6. **(Stretch) Distribution markets** — independent Stylus module, only after the MVP demos work.

---

## Things You Might Have Missed

**Math / Stylus (Dev A)**
- **Stylus has no floating point (P0 blocker).** A single `f64` literal / `as f64` / `num-traits::Float` bricks activation. CI must run `cargo stylus check`, not just `cargo build`. Pitch "deterministic high-precision **fixed-point** quant math, 10–100× cheaper" — drop "native floating-point."
- **Near-resolution numerics:** `φ(z)→0` at `P→0/1` causes div-by-zero in `γ_G` and `ellActive→0`; clamp `φ_MIN`, `λ_MIN`, floor `ell`, and **freeze swaps in the final blocks before T**.
- **Strict signed/unsigned boundary:** z and gap are `int256`; reserves/probabilities `uint256`. Mixing them is the #1 fixed-point bug.
- **Pool-favoring rounding must be consistent** (φ down, output reserve up, λ* clamped) — assert directions in tests or you leak value to the exact arbitrageurs PA-AMM is meant to stop.
- **`quote()` must be a pure `view`/staticcall** — if it accidentally writes (e.g. caching), the pre-trade preview breaks.
- **Don't over-claim the math** (see the λ*(P) Verdict). Say "exact AR(1) z-dynamics (verified)"; frame `γ_G`/λ*(P) as a *novel construction*, not a proven optimum — that turns the sharpest judge question into a strength.

**Lending / Security (Dev B)**
- **Seed the debt reserve in the CTF YES-USDC position, not raw USDC** — else the NO universe is silently insolvent. The single most important non-obvious correctness trap.
- **Enforce same-conditionId + same-outcome-leg at `borrow`** — a YES-ETH / NO-USDC loan is an ordinary liquidatable position wearing the protocol's badge. This one check is what makes the whole safety claim true (test T6, non-negotiable).
- **HF needs no probability, but `LTV_max(g)` needs the gap** — TWAP / end-of-block-sample the **gap** (not the price) before it touches risk; clamp direction is fail-safe (a spoofed huge gap only *tightens* LTV).
- **Two collateral universes, one CTF conditionId** — Factory must wire WETH + USDC positions to the *same* conditionId or settlement isn't simultaneous and the cancellation is a lie.
- **"No trusted coordinator" = the AMM price only.** Disclose residual trust: owner-resolver, zero/fixed interest, one Chainlink feed. Reentrancy guards + checks-effects-interactions on every lending entrypoint; Chainlink fails **closed**.

**Frontend / Infra / Demo (Dev C)**
- **RPC flakiness:** both transports in `fallback([...])`; test with primary RPC down; keep `USE_MOCK=true` ready to flip in Vercel in <30s.
- **Indexer cold start:** Ponder replays from genesis without a persistent Postgres volume — a Railway restart mid-demo costs 2–10 min. Give it a volume; test a restart 2h before.
- **Burner-wallet gas:** Arb Sepolia faucet gives ~0.1 ETH/day and Stylus calls cost more — pre-fund all wallets 24h ahead (≥0.5 ETH each). The judge-facing one-click faucet must work with a fresh MetaMask (test the night before).
- **WAD display, projector aspect ratio (design at 1280×720), `useWatchContractEvent` re-render thrash (memoize on trade-array length), Ponder CORS (`CORS_ORIGIN`=Vercel URL), mobile viewport meta** — small things that break a live demo.
- **Record a 60–90s backup video** of the full judge flow; if live fails, screen-share it.

---

## Milestones

| Milestone | Description | Target | Status |
|---|---|---|---|
| **M0** | Monorepo scaffold; freeze `IOmniverseMath` + `OmniverseTrade`; **`cargo stylus check` passes on fixed-point Φ stub** on local Nitro; Next.js + RainbowKit shell on mocked ABIs. *Gate to solstat fallback by hour 4.* | **H0–4** | **Partially done:** Stylus kernel + Foundry scaffold exist; `cargo stylus check`, Nitro, and frontend shell still pending. |
| **M1** | `OmniverseMath` (Φ, φ, Φ⁻¹, solveSwap, lambdaStarGaussian) + host-side tests vs reference Gaussians; Gnosis CTF condition/split/merge/redeem integration + conservation tests; **Demo 2 (λ Explorer)** working offline. | **H4–12** | **Partially done:** math kernel and Rust tests done; CTF integration and Demo 2 still pending. |
| **M2** | `PmAmmPool` (PA-AMM partition + `L_t` decay + ERC-1155 CTF custody + `OmniverseTrade`) + `MarketFactory` deployed to Arb Sepolia; Trade UI + market list/detail live; Ponder ingesting trades. | **H12–22** | **Started:** Solidity pool wrapper scaffold + tests done; CTF custody, factory, deployment, UI, and indexer pending. |
| **M3** | `MultiverseLending` (ERC-1155 CTF collateral/debt custody, HF + gap-haircut + both-universe settlement) + `Resolver`; Lending UI; **Demo 1 (Zero-Liquidation)** synced crash working; **Demo 3** visualizer. | **H22–32** | **Not started.** |
| **M4** | Hardening (seed/faucet/reset, `USE_MOCK` fallback, pre-funded wallets); LP panel + LVR/decay charts; README + pitch deck; **backup recording**; rehearse the judge runbook. | **H32–40** | **Not started.** |
| **Stretch** | Parametric Distribution Markets (μ/σ shares). | **H40+** | **Not started.** |

---

## Open Questions

*(Defaults assumed below — revisit early in M0 if the team disagrees.)*

1. **Dynamic vs constant λ on-chain for the demo:** ship `lambdaStarGaussian(P)` live behind the flag, or demo with constant λ=0.5 and show dynamic λ*(P) only in Demo 2? *Assumed: live `lambdaStarGaussian(P)` behind the flag, constant-λ fallback armed.*
2. **Conditional tokens:** Gnosis CTF ERC-1155 is now the production target. Open implementation detail: direct ERC-1155 custody everywhere vs optional ERC-20 wrappers around individual CTF position ids for selected integrations.
3. **Stylus scope:** stateless math kernel only (assumed) vs porting `PmAmmPool` to Stylus too.
4. **Resolution oracle:** owner-resolve (assumed, demo) vs mock-UMA optimistic.
5. **`g_cap` calibration:** self-calibrate from governance σ via `√(σ²Δt/(λ(2−λ)))` (assumed) vs hardcoded constant.
6. **Demo market scope:** single pre-seeded market (assumed) vs multi-market factory UX.
7. **Lending supply/interest:** protocol-seeded conditional debt + zero/fixed rate (assumed) vs a utilization rate-curve.
8. **WASM reuse for Demo 2:** TS re-implementation (assumed) vs compiling an `omniverse-core` Rust crate to wasm for "same engine on-chain and in browser" (stretch pitch-boost).

---

## Verification (acceptance criteria)

- **Kernel (cargo test, host-side):** `Φ(0)=0.5`, `Φ(1.96)≈0.975`, `φ(0)≈0.3989`, `Φ(−z)=1−Φ(z)`; `PhiInv∘Phi` round-trip `|err|<1e-9`; `solveSwap` round-trip pool-favoring + converges within `MAX_ITER` across `P∈(0.01,0.99)` + **reverts** when forced non-convergent; `lambdaStarGaussian` matches the overview table within 1e-4. **`cargo stylus check` is the deploy-readiness gate.**
- **Pool (forge):** rebalance fires once/block; `P=Φ(z)` matches closed form; `φ(R_after)≥φ(R_before)` always; no-drain under adversarial sequences; `L_t` decays and swaps freeze near T; price identical immediately before/after repartition.
- **CTF / Lending (forge):** CTF split/merge/redeem preserves collateral conservation across ERC-1155 YES/NO position ids; redeem pays winner 1:1 / loser 0; pool/lending custody handles `onERC1155Received`/batch flows safely; **settlement solvent in BOTH universes**; **HF invariant to P(YES)**; gap widening lowers `LTV_max` monotonically; **cross-universe `borrow` reverts** (T6); Chainlink staleness fails closed; reentrancy guarded.
- **E2E (Arb Sepolia):** deploy → seed → trade from UI → see it indexed (Ponder GraphQL) → reflected in the probability chart → open a loan → HF gauge + zero-liq banner.
- **Demos:** Demo 1 — one click crashes both panels (Aave liquidates, OMNIVERSE settles to Net P&L 0) + Reset re-arms; Demo 2 — dragging λ down flattens the LVR curve while tracking error rises, fully offline; Demo 3 — block stepping shows split→trade→merge→repartition with λ* adapting.

---

*Planned by a 3-agent team (Stylus/math · lending/security · frontend/infra), synthesized by the lead, and cross-checked against both source documents and an independent numerical verification of the λ*(P) result.*
