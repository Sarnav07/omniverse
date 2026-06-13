# OMNIVERSE

> **Trade probability curves and borrow with zero liquidation risk—no trusted coordinator.**

Omniverse is a next-generation DeFi protocol for **prediction markets** built on **Arbitrum Stylus**. It solves three fundamental problems in the current prediction market landscape:

1. **LP Wipeout Prevention** — Standard prediction market AMMs destroy liquidity providers when events resolve (one token goes to 0, LPs are arbitraged to zero in a single block). OMNIVERSE uses novel Partially Active AMM (PA-AMM) mechanics to protect LPs.
2. **Liquidation-Free Lending** — Users can borrow against prediction market positions without liquidation risk. When an event resolves, both collateral and debt evaporate together.
3. **Cheap On-Chain Math** — Complex Gaussian distribution functions (CDF/PDF) are computed natively in a Rust/WASM kernel via Arbitrum Stylus at 10-100× lower gas than Solidity equivalents.

---

## Architecture & Primitives

Omniverse is built upon three core research primitives that work together to create a mathematically sound, liquidation-free prediction market environment:

### 1. pm-AMM (Prediction Market AMM)
A specialized automated market maker designed specifically for binary outcome tokens (YES/NO). It utilizes a **Gaussian invariant**:
```text
(y - x) · Φ((y-x)/L) + L · φ((y-x)/L) - y = 0
```
- The marginal price (which represents the market's implied probability) is closed-form: `P = Φ((y-x)/L)`.
- **Dynamic Liquidity Decay:** The pool's depth shrinks as the event's expiry approaches (`L_t = L₀ · √(T - t)`). This bounds the lifetime Loss-Versus-Rebalancing (LVR) and serves as the primary protection layer against arbitrageurs.

### 2. PA-AMM + Gaussian $\lambda^*$ (LP Wipeout Prevention)
Standard AMMs leave liquidity providers exposed to catastrophic losses when a prediction market resolves (one token goes to 0, wiping out LPs). Omniverse solves this using a Partially Active AMM model.
- Each block, the pool's reserves are partitioned into **active (tradeable)** and **passive (shielded)** fractions.
- Omniverse dynamically computes the optimal activeness factor ($\lambda^*$) based on the current market probability.
- **The "W-shape" and Tail Collapse:** As the market approaches certainty ($P \to 0$ or $1$), the mathematical weight of adverse selection diverges. The protocol automatically forces $\lambda^* \to 0$, hiding the vast majority of LP funds from informed traders right before the event resolves.

### 3. Multiverse Lending (Zero Liquidation Risk)
A novel money market built directly on top of prediction market tokens.
- **Outcome-Conditional Pairs:** Users deposit collateral tied to an outcome (e.g., `YES-ETH`) and borrow debt tied to the *exact same outcome* (e.g., `YES-USDC`).
- **Mathematical Immunity:** If the event resolves to `NO`, both the collateral (`YES-ETH`) and the debt (`YES-USDC`) go to zero simultaneously. The net position cleanly evaporates. There are no margin calls, no cascading liquidations, and no bad debt.
- **Isolated Risk:** The Health Factor (HF) completely cancels out the probability of the event. The only remaining risk is standard cross-currency volatility (e.g., ETH/USD), which is handled using a Time-Weighted Average Price (TWAP) and standard Chainlink Oracles.

### 4. Arbitrum Stylus Math Kernel
Executing Gaussian probability density functions ($\phi(z)$) and cumulative distribution functions ($\Phi(z)$) in native Solidity is prohibitively expensive. Omniverse offloads all heavy computation to a highly optimized **Rust/WASM Kernel** deployed via Arbitrum Stylus.
- **Stateless Execution:** The kernel is purely functional. It exposes `phi`, `Phi`, `lambdaStarGaussian`, and a highly optimized Newton-Raphson `solveSwap` algorithm.
- **Fixed-Point WAD Arithmetic:** Because floating-point operations (`f32`/`f64`) are incompatible with blockchain consensus and cause Stylus contract activation failures, the entire math kernel operates strictly on 18-decimal integer arithmetic (`no_std`).
- **Gas Efficiency:** Computations are completed at 10-100× lower gas costs than EVM-native Solidity equivalents, enabling complex on-chain probability pricing. 

---

## Contract Stack

| Contract | Language | Purpose |
|----------|----------|---------|
| `OmniverseMath` | **Rust → WASM (Stylus)** | Stateless math: Gaussian CDF/PDF, swap solver. Avoids floating point entirely using fixed-point WAD arithmetic. |
| `PmAmmPool` | Solidity | Per-market reserves, PA-AMM partition, liquidity decay, and swap execution. |
| `ConditionalTokens` | Solidity | Per-market ERC-20 YES/NO tokens. Split/merge/redeem against collateral escrow. |
| `MarketFactory` | Solidity | Deploys Pool + Token set for a new event. |
| `MultiverseLending` | Solidity | Deposit conditional collateral, borrow same-outcome debt, gap-haircut LTV. |
| `Resolver` | Solidity | Owner-resolves events (designed as a mock for production Oracle paths). |

---

## Technology Stack

- **Smart Contracts (Math Kernel):** Rust, `stylus-sdk` (no_std, wasm32-unknown-unknown)
- **Smart Contracts (Core Logic):** Solidity, Foundry
- **Frontend:** React 19, TanStack Start/Router, Vite, Tailwind CSS, shadcn/ui, wagmi v3, viem
- **Indexer:** Ponder
- **Network:** Arbitrum Sepolia (Testnet)

---

## Repository Structure

```
arbitrum/
├── contracts-stylus/          # Rust/WASM math kernel (OmniverseMath)
├── contracts-sol/             # Core Solidity contracts & Foundry tests
├── frontend/                  # React 19 / TanStack Router frontend
├── indexer/                   # Ponder indexer & GraphQL API
├── scripts/                   # Deployment and seeding scripts
├── CONTEXT.md                 # Detailed AI agent context file
├── DEMO_EXECUTION_GUIDE.md    # Instructions to run the live demo
└── IMPLEMENTATION_PLAN.md     # Original technical implementation steps
```

---

## Getting Started

To run the full stack locally or execute the live demo, please refer to the detailed instructions in the [Demo Execution Guide](DEMO_EXECUTION_GUIDE.md).

### Prerequisites
- Node.js (v20+)
- Bun
- Rust (with `wasm32-unknown-unknown` target)
- Foundry / Forge
- Docker (for local Postgres database)
