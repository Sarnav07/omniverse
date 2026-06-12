# OMNIVERSE — AI Agent Context File

> **Purpose:** This document provides complete context for any AI coding agent working on the OMNIVERSE project. Read this before writing any code.

---

## 1. What Is OMNIVERSE?

OMNIVERSE is a DeFi protocol for **prediction markets** built on **Arbitrum Stylus** that solves three problems simultaneously:

1. **LP Wipeout Prevention** — Standard prediction market AMMs destroy liquidity providers when events resolve (one token goes to 0, LPs are arbitraged to zero in a single block). OMNIVERSE uses two complementary mechanisms to prevent this.
2. **Liquidation-Free Lending** — Users can borrow against prediction market positions without liquidation risk. When the event resolves, both collateral and debt evaporate together.
3. **Cheap On-Chain Math** — Gaussian distribution functions (CDF/PDF) are computed in a Rust/WASM kernel via Arbitrum Stylus at 10-100× lower gas than Solidity equivalents.

### The 12-Word Pitch
> *"Trade probability curves and borrow with zero liquidation risk—no trusted coordinator."*

---

## 2. Three Core Research Primitives

OMNIVERSE fuses three ideas from recent research:

### 2.1 pm-AMM (Prediction Market AMM)
**Source:** Paradigm Research, Nov 2024

A specialized AMM for binary outcome tokens (YES/NO) that uses a Gaussian invariant:

```
(y - x) · Φ((y-x)/L) + L · φ((y-x)/L) - y = 0
```

- `Φ(z)` = Gaussian CDF (standard normal)
- `φ(z)` = Gaussian PDF
- `x, y` = reserves of YES and NO tokens
- `L` = liquidity parameter

**Key property:** Marginal price (= probability) is closed-form: `P = Φ((y-x)/L)`

**Dynamic liquidity decay:** `L_t = L₀ · √(T - t)` — liquidity shrinks as expiry approaches, bounding LP losses to `E[LVR_t] = V₀/(2T)`. This is the **primary** LP protection mechanism.

### 2.2 PA-AMM (Partially Active AMM) + Gaussian λ* (Novel Derivation)
**Source:** Ko Sunghun, arXiv 2602.09887, Feb 2026 (base PA-AMM); **OMNIVERSE original derivation** (Gaussian λ*)

Partitions pool reserves each block into active (tradeable) and passive (shielded):

```
R_active = λ · R_total
R_passive = (1 - λ) · R_total
```

- `λ ∈ (0, 1]` = activeness parameter
- Rebalancing happens **once per block** on first interaction
- Lower λ → less LVR, but higher tracking error (price drift)

**NOVEL RESULT — Dynamic Gaussian λ*:**
We derived the optimal λ* for the Gaussian pm-AMM invariant from scratch. Key findings:
- The Gaussian invariant makes the gap process **exactly AR(1)** (not a linearization like G3M — strictly stronger).
- The optimal λ* is **dynamic**, depending on the current market probability P_true:
  ```
  λ*(P_true) = (1 + √(1 + 2γ_G)) / (1 + γ_G + √(1 + 2γ_G))
  where: γ_G(z) = γ' / (2·v(z)·φ(z)),  z = Φ⁻¹(P_true),  v(z) = φ(z) + z·(2Φ(z)−1)
  ```
- As P → 0 or 1 (near resolution), φ(z) → 0, so γ_G → ∞ and **λ* → 0 automatically** — maximum LP protection exactly when informed traders are most dangerous.
- γ' is a governance parameter weighting LVR cost vs. tracking error.
- Full derivation: see `GAUSSIAN_LAMBDA_STAR.md`

**For implementers:**
- The degree-0 homogeneity of the Gaussian invariant means scaling reserves AND L by λ gives an active sub-pool quoting the same probability at λ× depth.
- The pool should compute λ* dynamically from the current probability at each rebalancing, not use a hardcoded constant.

### 2.3 Multiverse Lending
**Source:** Omniverse technical spec

Users deposit **outcome-conditional collateral** (e.g., YES-ETH) and borrow **same-outcome debt** (e.g., YES-USDC). Both are conditioned on the same event outcome.

**Why this eliminates liquidation:** If the event resolves to NO:
- Collateral (YES-ETH) → 0
- Debt (YES-USDC) → 0
- Net P&L: exactly 0. No liquidation cascade.

**Health Factor:** `HF = (Collateral · p_ETH · LTV_max(g)) / Debt`
- P(YES) cancels from numerator and denominator
- Only within-universe ETH/USD risk remains (via Chainlink)
- The PA-AMM tracking error gap `g` is used to haircut LTV:
  ```
  LTV_max(g) = LTV_base · (1 - min(1, |g| / g_cap) · h)
  ```

---

## 3. Architecture & Contract Map

### 3.1 Contract Stack

| Contract | Language | Purpose |
|----------|----------|---------|
| `OmniverseMath` | **Rust → WASM (Stylus)** | Stateless math: `Φ(z)`, `φ(z)`, `solveSwap()`. Fixed-point WAD (1e18). |
| `PmAmmPool` | Solidity | Per-market reserves, PA-AMM partition, L_t decay, swap execution. Calls `OmniverseMath` via `IOmniverseMath`. |
| `ConditionalTokens` | Solidity | Per-market ERC-20 YES/NO tokens. Split/merge/redeem against collateral escrow. |
| `MarketFactory` | Solidity | Deploys Pool + Token set for a new event. |
| `MultiverseLending` | Solidity | Deposit conditional collateral, borrow same-outcome debt, gap-haircut LTV. |
| `Resolver` | Solidity | Owner-resolves events (mock UMA for production path). |

### 3.2 Interface Contract (Frozen)

```solidity
interface IOmniverseMath {
    function phi(int256 z) external pure returns (uint256);
    function Phi(int256 z) external pure returns (uint256);
    function PhiInv(uint256 p) external pure returns (int256 z);
    function solveSwap(uint256 x1, uint256 y0, uint256 ell) external pure returns (uint256 y1);
    function poolValue(int256 z) external pure returns (uint256);          // v(z) = φ(z) + z·(2Φ(z)−1)
    function lambdaStarGaussian(uint256 gammaPrime, uint256 pTrue) external pure returns (uint256);
}
```

This interface has **two implementations**:
1. **Primary:** Rust/WASM via Stylus
2. **Fallback:** Solidity using `solstat` (Primitive Finance) + `PRBMath`

### 3.3 Event Schema (Frozen)

```solidity
event OmniverseTrade(
    uint256 indexed marketId,
    address indexed trader,
    uint8 side,            // 0=buyYes 1=sellYes 2=buyNo 3=sellNo
    uint256 size,          // one-sided notional (amount in; NOT double-counted)
    uint256 priceWad,      // probability after the trade (WAD)
    uint256 ellWad,        // active liquidity L_t used (WAD)
    uint256 lambdaWad,     // active fraction λ (WAD)
    int256 gapWad,         // ln(P_active / P_full) (WAD); 0 until the gap is wired on-chain
    uint64 timestamp
);
```

This 9-field schema is frozen and is the single source of truth for the indexer; it matches `IMPLEMENTATION_PLAN.md`. `gapWad` is emitted as 0 until the kernel exposes `ln` and the gap is computed on-chain.

### 3.4 Pool State

```solidity
uint256 xActive;    // YES token active reserves
uint256 xPassive;   // YES token passive reserves
uint256 yActive;    // NO token active reserves
uint256 yPassive;   // NO token passive reserves
uint256 nLast;      // block number of last interaction
uint256 L0;         // initial liquidity parameter
uint256 gammaPrime; // governance param: LVR-vs-tracking-error weight (WAD)
uint256 T;          // event expiry timestamp
uint256 ellActive;  // current effective liquidity for active sub-pool
```

---

## 4. Technical Constraints & Gotchas

### 4.1 Stylus / WASM Constraints
- **NO FLOATING POINT.** `f32`/`f64` instructions cause contract activation failure. ALL math must use fixed-point WAD (1e18 integer arithmetic).
- **24KB compressed WASM limit.** Use `no_std`, `panic = "abort"`, `opt-level = "z"`, strip symbols.
- **Hidden floats:** Watch for `f64` literals, `as f64`, `num-traits::Float`. Run `cargo stylus check` after every change.
- **Activation gas:** ~14M gas per contract (deploy = code tx + activate tx).

### 4.2 Numerical Safety
- Clamp argument `d = (y-x)/L` to `[-8, 8]` (beyond this, Φ is effectively 0 or 1).
- Floor `ell ≥ L_MIN` (prevent division by zero near expiry).
- New reserves rounded **UP** (pool-favoring rounding).
- Newton solver: max 64 iterations, **revert on non-convergence** (never silently return a wrong value).
- `f'(y) = Φ(d) - 1 ∈ (-1, 0)` → unique root guaranteed, no oscillation.
- **Freeze swaps** in the final blocks before T and after T (redeem only).

### 4.3 PA-AMM Implementation
- Rebalance **once per block** — check `block.number > nLast` at entry of every public function.
- **Compute dynamic λ*** from current probability: call `lambdaStarGaussian(gammaPrime, currentP)`.
- Scale **both reserves AND L by λ***: `ell_active = λ* · L₀ · √(T - t)`.
- Post-swap assertion: `φ(R_after) ≥ φ(R_before)` (invariant non-decreasing).
- **Fallback:** If dynamic λ* adds too much gas, use constant `λ = 0.5` and document the deviation.

### 4.4 Lending Safety
- Enforce **same condition-id + same outcome leg** at loan origination.
- P(YES) must cancel from HF calculation.
- Gap `g = ln(P_active / P_full)` measured end-of-block.
- **TWAP the pm-AMM price** across blocks before trusting it for risk (anti-manipulation).
- Settlement must be solvent in **both** YES and NO universes (prove both cases).

---

## 5. Monorepo Structure

```
arbitrum/
├── contracts-stylus/          # Rust/WASM math kernel
│   ├── Cargo.toml             # stylus-sdk ^0.10, no_std
│   └── src/
│       ├── lib.rs             # Entry: phi, Phi, solveSwap
│       ├── fixed_point.rs     # WAD arithmetic
│       └── gaussian.rs        # CDF/PDF implementations
│
├── contracts-sol/             # Solidity contracts (Foundry)
│   ├── foundry.toml
│   ├── src/
│   │   ├── interfaces/
│   │   │   └── IOmniverseMath.sol
│   │   ├── PmAmmPool.sol
│   │   ├── ConditionalTokens.sol
│   │   ├── MarketFactory.sol
│   │   ├── MultiverseLending.sol
│   │   ├── Resolver.sol
│   │   └── OmniverseMathSolidity.sol  # solstat+PRBMath fallback
│   └── test/
│
├── frontend/                  # React 19 / TanStack Start / Vite app
│   └── src/
│       ├── routes/            # File-based routes (TanStack Router)
│       │   ├── index.tsx      # Landing (/)
│       │   ├── markets.$id.tsx# Attack terminal + ExecutionTerminal (swap/borrow)
│       │   ├── demo.tsx       # Proof dashboard (/demo)
│       │   ├── simulate.tsx   # Resolution sim (/simulate)
│       │   └── explorer.tsx   # Block/trade + λ*(P) explorer (/explorer)
│       ├── components/
│       ├── hooks/             # wagmi reads + urql GraphQL hooks
│       └── lib/
│           └── formatters.ts  # WAD formatters + Arbiscan helpers
│
├── indexer/                   # Ponder indexer
│   └── ponder.config.ts
│
├── scripts/                   # Deploy + seed + demo scripts
│   ├── deploy.s.sol
│   ├── seed.ts
│   └── faucet.ts
│
├── CONTEXT.md                 # This file
└── IMPLEMENTATION_PLAN.md     # Detailed implementation plan
```

---

## 6. Technology Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts (math) | Rust, `stylus-sdk` ^0.10, `no_std`, `wasm32-unknown-unknown` |
| Smart Contracts (logic) | Solidity, Foundry |
| Frontend | React 19, TanStack Start/Router, Vite, TypeScript, wagmi v3, viem, RainbowKit, urql |
| Charts | Recharts |
| Animations | Framer Motion |
| Styling | Tailwind CSS + shadcn/ui |
| Indexer | Ponder (self-hosted, Railway, auto GraphQL) |
| Chain | Arbitrum Sepolia (testnet), Arbitrum One (production) |
| Oracles | Chainlink ETH/USD (within-universe pricing) |
| Local dev | Nitro `--dev` node (Docker, Stylus-enabled) |

---

## 7. Build Order Summary

```
Hour 0-4:   M0 → Scaffold, freeze interfaces, cargo stylus check on Φ stub
Hour 4-12:  M1 → OmniverseMath (Rust) + ConditionalTokens (parallel) + Demo 2 (TS)
Hour 12-22: M2 → PmAmmPool + MarketFactory + Trade UI + Ponder indexer
Hour 22-32: M3 → MultiverseLending + Resolver + Lending UI + Demo 1
Hour 32-40: M4 → Hardening, LP panel, charts, pitch deck, backup recording
Hour 40+:   Stretch → Distribution Markets (μ/σ shares)
```

---

## 8. Coding Guidelines

1. **Think before coding.** State assumptions. Ask when uncertain.
2. **Simplicity first.** Minimum code that solves the problem. No speculative features.
3. **Surgical changes.** Touch only what you must. Match existing style.
4. **Goal-driven execution.** Define success criteria. Loop until verified.

---

## 9. Key Mathematical Reference

### Gaussian CDF (A&S 26.2.17 Approximation)
```
For z ≥ 0:
  t = 1 / (1 + 0.2316419 · z)
  Φ(z) ≈ 1 - φ(z) · (a₁t + a₂t² + a₃t³ + a₄t⁴ + a₅t⁵)

where:
  a₁ = 0.319381530, a₂ = -0.356563782, a₃ = 1.781477937
  a₄ = -1.821255978, a₅ = 1.330274429

For z < 0: Φ(z) = 1 - Φ(-z)
```

### pm-AMM Invariant
```
f(x, y, L) = (y - x) · Φ((y-x)/L) + L · φ((y-x)/L) - y = 0
```

### Swap Solver
Given new `x₁` (after trade), solve for `y₁`:
```
f(y) = (y - x₁) · Φ((y - x₁)/ℓ) + ℓ · φ((y - x₁)/ℓ) - y = 0
f'(y) = Φ((y - x₁)/ℓ) - 1    ← always in (-1, 0), guarantees convergence
```
Use Newton's method with bisection fallback. Round y₁ UP (pool-favoring).

### Liquidity Decay
```
L_t = L₀ · √(T - t)
ell_active = λ*(P) · L_t = λ*(P) · L₀ · √(T - t)
```

### Gaussian λ* (Dynamic Optimal Activeness)
```
λ*(P_true) = (1 + √(1 + 2γ_G)) / (1 + γ_G + √(1 + 2γ_G))

γ_G(z) = γ' / (2 · v(z) · φ(z))
z = Φ⁻¹(P_true)
v(z) = φ(z) + z · (2Φ(z) − 1)

As P → 0 or 1:  φ(z) → 0  →  γ_G → ∞  →  λ* → 0  (auto-protection)
At P = 0.5:      φ(z) = max  →  γ_G = min  →  λ* = max  (max liquidity)
```

### Health Factor (Lending)
```
HF = (C · p_ETH · LTV_max(g)) / D

LTV_max(g) = LTV_base · (1 - min(1, |g| / g_cap) · h)
g = ln(P_active / P_full)
```

---

## 10. What NOT to Do

1. **Don't use floating point in Stylus.** Contract will fail activation.
2. **Don't use the G3M λ* formula directly** — use our derived Gaussian λ*(P) which accounts for the Gaussian invariant's probability-dependent curvature.
3. **Don't use Gnosis CTF (ERC-1155)** for MVP — use custom ERC-20 YES/NO pairs for lending compatibility.
4. **Don't use The Graph** — it's deprecated for hosted service. Use Ponder.
5. **Don't use websockets** for real-time — use block-polling (`pollingInterval: 2000`).
6. **Don't trust instantaneous pm-AMM price** for lending risk — TWAP it.
7. **Don't allow swaps after expiry T** — redeem only.
8. **Don't let Newton solver silently return** — revert on non-convergence.
9. **Don't confuse the three LP protection layers** — pm-AMM's `√(T-t)` decay bounds lifetime LVR, constant λ bounds per-block extraction, and dynamic λ*(P) adds probability-aware auto-tightening near resolution. Each is a distinct guarantee.
