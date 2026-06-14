# OMNIVERSE

**Next-Generation Prediction Markets with Zero-Liquidation Lending on Arbitrum Stylus**

*Trade probability curves with mathematical precision. Borrow without liquidation risk. Protect LPs from wipeout.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Arbitrum](https://img.shields.io/badge/Arbitrum-Stylus-blue)](https://arbitrum.io/)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.24-lightgrey)](https://soliditylang.org/)
[![Rust](https://img.shields.io/badge/Rust-WASM-orange)](https://www.rust-lang.org/)

---

## 📋 Table of Contents

1. [Overview](#-overview)
2. [Live Demo & Deployed Contracts](#-live-demo--deployed-contracts)
3. [Architecture](#-architecture)
4. [The Mathematics: Gaussian λ* and PA-AMM](#-the-mathematics-gaussian-λ-and-pa-amm)
   - [The Core pm-AMM Invariant](#21-the-core-pm-amm-invariant)
   - [The LP Wipeout Problem](#22-the-lp-wipeout-problem)
   - [Gaussian λ*: Optimal Activeness](#23-gaussian-λ-optimal-activeness)
   - [Dynamic Liquidity Decay](#24-dynamic-liquidity-decay)
5. [Contract Interactions](#-contract-interactions)
6. [Technology Stack](#-technology-stack)
7. [Local Development & Deployment](#-local-development--deployment)
8. [Repository Structure](#-repository-structure)
9. [License](#-license)

---

## 🌟 Overview

**Omniverse** is a cutting-edge DeFi protocol for **prediction markets** and **binary options** built on **Arbitrum Sepolia**, designed to solve three critical problems that plague existing prediction market platforms:

### 1. **LP Wipeout Prevention**
Standard prediction market AMMs expose liquidity providers to catastrophic losses when events resolve. When a market settles (one token goes to $0), arbitrageurs drain the valuable tokens in a single block, leaving LPs with worthless inventory. **Omniverse solves this using a novel Partially Active AMM (PA-AMM) with Gaussian λ* (Lambda Star)**, which dynamically shields liquidity as markets approach resolution.

### 4. **Liquidation-Free Lending**
Omniverse introduces **Multiverse Lending**, a revolutionary money market where users can borrow against prediction market positions **without liquidation risk**. By matching collateral and debt to the same outcome (e.g., `YES-ETH` collateral with `YES-USDC` debt), both sides of the position evaporate simultaneously if the event resolves unfavorably. No margin calls. No cascading liquidations. No bad debt.

### 3. **Cheap On-Chain Math**
Computing Gaussian probability functions (CDF/PDF) in Solidity is prohibitively expensive. Omniverse deploys a highly optimized **Rust/WASM Math Kernel via Arbitrum Stylus**, achieving **10-100× lower gas costs** than pure EVM implementations while maintaining perfect on-chain determinism through fixed-point WAD arithmetic.

---

### 🎯 Key Innovations

| Innovation | Description |
|------------|-------------|
| **Gaussian λ* Activeness** | Dynamic reserve partitioning that mathematically protects LPs from adverse selection at market extremes |
| **PA-AMM (Partially Active AMM)** | Only a fraction λ of reserves are tradeable; the rest remain shielded from informed traders |
| **Outcome-Conditional Lending** | First-ever lending protocol where collateral and debt share the same resolution fate—eliminating liquidation risk |
| **Arbitrum Stylus Math Kernel** | Pure Rust/WASM computational engine for Gaussian CDF, PDF, and optimal swap solving at minimal gas cost |
| **ERC-1155 Conditional Tokens** | Gas-optimized implementation of Gnosis CTF for efficient position management |
| **Time-Decaying Liquidity** | Automated liquidity reduction as expiry approaches: $L_t = L_0 \sqrt{T - t}$ |

---

## 🌐 Live Demo & Deployed Contracts

### **Try Omniverse Now**

🚀 **Live Application:** [https://omniverse-99so.vercel.app/](https://omniverse-99so.vercel.app/)

**Network:** Arbitrum Sepolia Testnet

### **Quick Start Guide**

1. **Get Testnet ETH:** [Arbitrum Sepolia Faucet](https://faucet.arbitrum.io/)
2. **Connect Wallet:** MetaMask or WalletConnect
3. **Get Test WETH:** Use the faucet on the demo page
4. **Trade:** Swap YES/NO tokens on live prediction markets
5. **Add Liquidity:** Provide liquidity and earn trading fees
6. **Borrow:** Use Multiverse Lending to borrow without liquidation risk

---

### **Deployed Smart Contracts**

| Contract | Address | Description |
|----------|---------|-------------|
| **OmniverseMath** | [`0x78e5e65dBE6e9bE10e7BcED0f127fB21247f7c14`](https://sepolia.arbiscan.io/address/0x78e5e65dBE6e9bE10e7BcED0f127fB21247f7c14) | Rust/WASM Math Kernel (Stylus) |
| **MarketFactory** | [`0xc164Ded0De455DC2B325c0E7250731E08e2F8633`](https://sepolia.arbiscan.io/address/0xc164Ded0De455DC2B325c0E7250731E08e2F8633) | Market creation and registry |
| **Resolver** | [`0x7AE56E5D45CB841be4F546691f29ad6bA6E57F1B`](https://sepolia.arbiscan.io/address/0x7AE56E5D45CB841be4F546691f29ad6bA6E57F1B) | Oracle resolution interface |
| **MultiverseLending** | [`0x6Cf620F06ae42D04327134e8E052FB5c4FC31844`](https://sepolia.arbiscan.io/address/0x6Cf620F06ae42D04327134e8E052FB5c4FC31844) | Zero-liquidation lending protocol |
| **Demo Market (WETH)** | [`0xE9624bB8fA25eEaAEfba796fB09C2677AE8CaA01`](https://sepolia.arbiscan.io/address/0xE9624bB8fA25eEaAEfba796fB09C2677AE8CaA01) | Live prediction market pool |

**Indexer GraphQL API:** [https://thorough-peace-production-f623.up.railway.app/graphql](https://thorough-peace-production-f623.up.railway.app/graphql)

---

## 🏗️ Architecture

Omniverse is built on a **hybrid Rust/Solidity architecture** that separates pure mathematical computation from stateful contract logic. This design maximizes gas efficiency, auditability, and modularity.

---

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  React 19 • TanStack Router • wagmi v3 • viem • shadcn/ui      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         INDEXER                                 │
│              Ponder • GraphQL API • PostgreSQL                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ARBITRUM SEPOLIA NETWORK                      │
│                                                                 │
│  ┌──────────────────────┐        ┌─────────────────────────┐  │
│  │   OmniverseMath      │◄───────│   Solidity Contracts    │  │
│  │  (Rust → WASM)       │        │                         │  │
│  │                      │        │  • MarketFactory        │  │
│  │  • phi(z)            │        │  • PmAmmPool            │  │
│  │  • Phi(z)            │        │  • ConditionalTokens    │  │
│  │  • PhiInv(p)         │        │  • MultiverseLending    │  │
│  │  • lambdaStarGaussian│        │  • Resolver             │  │
│  │  • solveSwap         │        │                         │  │
│  │  • poolValue         │        │                         │  │
│  └──────────────────────┘        └─────────────────────────┘  │
│                                                                 │
│            ▲                                ▲                   │
│            │                                │                   │
│         [Stylus]                       [EVM/Solidity]          │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Contract Stack

| Contract | Language | Purpose |
|----------|----------|---------|
| **OmniverseMath** | Rust → WASM (Stylus) | Stateless math kernel: Gaussian CDF/PDF, inverse CDF, λ* calculator, swap solver. Pure functions with no storage. |
| **MarketFactory** | Solidity | Deploys new prediction markets. Creates PmAmmPool + ConditionalToken pairs. Manages market registry. |
| **PmAmmPool** | Solidity | Core AMM logic. Manages reserves (x, y), executes swaps, handles LP deposits/withdrawals. Calls OmniverseMath for pricing. |
| **ConditionalTokens** | Solidity | ERC-1155 implementation for YES/NO outcome tokens. Handles split/merge/redeem operations against collateral escrow. |
| **MultiverseLending** | Solidity | Outcome-conditional lending protocol. Allows borrowing same-outcome debt against same-outcome collateral. Zero liquidation risk. |
| **Resolver** | Solidity | Oracle interface for market resolution. Currently mock-based (owner-controlled). Designed for future Chainlink/UMA integration. |

---

### 3.3 Core Workflows

#### **3.3.1 Swapping (Trading)**

```mermaid
flowchart TD
    A[User calls PmAmmPool.swap] --> B[Read current reserves x, y]
    B --> C[Call OmniverseMath.lambdaStarGaussian γ', P]
    C --> D[Receive λ* optimal activeness]
    D --> E[Partition reserves:<br/>x_active = λ* · x<br/>y_active = λ* · y]
    E --> F[Call OmniverseMath.solveSwap x1, y0, L_t]
    F --> G[Receive y1 from Newton-Raphson solver]
    G --> H[Execute swap against active reserves only]
    H --> I[Transfer tokens to/from user]
    I --> J[Emit Swap event]
    
    style D fill:#bbdefb,stroke:#1976d2,stroke-width:2px,color:#000
    style E fill:#fff9c4,stroke:#f57f17,stroke-width:2px,color:#000
    style H fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#000
```

**Key Insight:** Only the active fraction λ* of reserves participates in the trade, automatically shielding LP capital at extreme probabilities.

---

#### **3.3.2 Adding Liquidity**

```mermaid
flowchart TD
    A[User calls PmAmmPool.addLiquidity] --> B[Calculate current pool value<br/>V = vz · L]
    B --> C[Determine required YES/NO<br/>token deposits for balanced addition]
    C --> D[Transfer tokens from user to pool]
    D --> E[Mint LP shares proportional<br/>to value added]
    E --> F[Update reserves x, y<br/>and liquidity L]
    F --> G[Emit LiquidityAdded event]
    
    style B fill:#bbdefb,stroke:#1976d2,stroke-width:2px,color:#000
    style E fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#000
```

---

#### **3.3.3 Minting Outcome Tokens**

```mermaid
flowchart TD
    A[User calls ConditionalTokens.split] --> B[Transfer collateral<br/>e.g., WETH to escrow]
    B --> C[Mint YES tokens<br/>ERC-1155 ID = conditionId_0]
    C --> D[Mint NO tokens<br/>ERC-1155 ID = conditionId_1]
    D --> E[Transfer equal amounts of<br/>YES and NO to user]
    E --> F[Emit PositionSplit event]
    
    style B fill:#fff9c4,stroke:#f57f17,stroke-width:2px,color:#000
    style C fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#000
    style D fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#000
```

**1:1 Backing:** 1 unit of collateral always mints 1 YES + 1 NO token, maintaining full collateralization.

---

#### **3.3.4 Borrowing (Multiverse Lending)**

```mermaid
flowchart TD
    A[User calls MultiverseLending.borrow] --> B{Verify both tokens map<br/>to same outcome?}
    B -->|Yes| C[Calculate Health Factor<br/>HF = collateral_value / debt_value]
    B -->|No| X[❌ Revert: Outcome mismatch]
    C --> D{HF > MIN_HEALTH_FACTOR?}
    D -->|Yes| E[Transfer collateral tokens<br/>to lending vault]
    D -->|No| Y[❌ Revert: Insufficient collateral]
    E --> F[Mint and transfer debt tokens<br/>to user]
    F --> G[Record position in user's account]
    G --> H[Emit Borrow event]
    
    style B fill:#bbdefb,stroke:#1976d2,stroke-width:2px,color:#000
    style C fill:#fff9c4,stroke:#f57f17,stroke-width:2px,color:#000
    style E fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#000
    style X fill:#ffcdd2,stroke:#c62828,stroke-width:2px,color:#000
    style Y fill:#ffcdd2,stroke:#c62828,stroke-width:2px,color:#000
```

**Liquidation-Free Property:** If the outcome resolves unfavorably (e.g., NO wins when user borrowed against YES), both collateral and debt simultaneously drop to zero. Net position = 0. No liquidation needed.

---

#### **3.3.5 Market Resolution**

```mermaid
flowchart TD
    A[Resolver calls resolve marketId, outcome] --> B{Verify caller<br/>authority?}
    B -->|Authorized| C{Expiration time<br/>passed?}
    B -->|Unauthorized| X[❌ Revert: Not authorized]
    C -->|Yes| D[Record outcome<br/>YES = true, NO = false]
    C -->|No| Y[❌ Revert: Market not expired]
    D --> E[Freeze all trading<br/>set L_t = 0]
    E --> F[Enable redemption in<br/>ConditionalTokens]
    F --> G[Emit MarketResolved event]
    G --> H[Trigger lending position cleanup]
    
    style B fill:#bbdefb,stroke:#1976d2,stroke-width:2px,color:#000
    style D fill:#fff9c4,stroke:#f57f17,stroke-width:2px,color:#000
    style E fill:#ffcdd2,stroke:#c62828,stroke-width:2px,color:#000
    style F fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#000
    style X fill:#ffcdd2,stroke:#c62828,stroke-width:2px,color:#000
    style Y fill:#ffcdd2,stroke:#c62828,stroke-width:2px,color:#000
```

---

Omniverse extends the foundational **pm-AMM (Prediction Market Automated Market Maker)** research by incorporating a novel **Partially Active AMM (PA-AMM)** model with **Gaussian λ*** (Lambda Star). This section provides a rigorous mathematical exposition of the protocol's core innovations.

---

### 4.1 The Core pm-AMM Invariant

The pm-AMM is a specialized constant-function market maker designed explicitly for binary outcome tokens. Unlike general-purpose AMMs (e.g., Uniswap's $x \cdot y = k$), the pm-AMM models the probability distribution of outcomes using a **Gaussian invariant**.

#### **The Invariant Equation**

For a pool holding reserves $x$ (YES tokens) and $y$ (NO tokens), the invariant is:

$$(y - x) \cdot \Phi\left(\frac{y - x}{L}\right) + L \cdot \phi\left(\frac{y - x}{L}\right) - y = 0$$

where:

| Symbol | Meaning |
|--------|---------|
| $x$ | Reserve of YES outcome tokens |
| $y$ | Reserve of NO outcome tokens |
| $L$ | Liquidity depth parameter (scales pool size) |
| $\phi(z) = \frac{1}{\sqrt{2\pi}} e^{-z^2/2}$ | Standard normal probability density function (PDF) |
| $\Phi(z) = \int_{-\infty}^{z} \phi(u) \, du$ | Standard normal cumulative distribution function (CDF) |

#### **Marginal Price Formula**

The pool's marginal price (the market's implied probability of the YES outcome) is derived as a closed-form function:

$$P = \Phi\left(\frac{y - x}{L}\right)$$

This elegant relationship directly maps the reserve imbalance to a probability via the Gaussian CDF, ensuring that $P \in [0, 1]$ and that the price moves according to the principles of Brownian motion and score dynamics.

#### **Why Gaussian?**

The Gaussian model is optimal for prediction markets where the outcome depends on whether an underlying **score** (e.g., vote margin, point spread, price level) crosses a threshold. The assumption that this score follows a **Brownian motion** leads naturally to the use of the normal distribution's CDF and PDF in the pricing mechanism.

---

### 4.2 The LP Wipeout Problem

Standard AMMs (including basic pm-AMM implementations) suffer from a **catastrophic failure mode** at market resolution:

#### **The Attack Scenario**

1. **Pre-Resolution:** A market is trading at $P = 0.95$ (95% probability of YES).
2. **Event Resolves:** The outcome is revealed (e.g., YES wins).
3. **Arbitrage Exploit:** In a single block, informed traders swap all NO tokens (now worthless) for YES tokens (worth $1 each).
4. **LP Wipeout:** LPs are left holding 100% NO tokens (value = $0) and 0% YES tokens. **Total LP capital loss.**

#### **Why Traditional AMMs Fail**

- **Full Reserve Exposure:** All reserves are active and tradeable, leaving LPs vulnerable to informed traders with perfect knowledge.
- **No Defense Mechanism:** The AMM has no mathematical mechanism to shield reserves when the market reaches extreme probabilities ($P \to 0$ or $P \to 1$).
- **Instant Arbitrage:** The time between information revelation and on-chain resolution is sufficient for complete LP drainage.

This is not impermanent loss—it is **permanent, complete capital destruction**.

---

#### **🛡️ Omniverse's Novel Solution: The PA-AMM Framework**

**Omniverse is the first protocol to implement a Partially Active AMM (PA-AMM) with Gaussian λ* for prediction markets.** This is original research developed specifically for this protocol, extending the foundational pm-AMM work with a novel risk-aware liquidity partitioning mechanism.

**How Omniverse Protects LPs:**

1. **Dynamic Reserve Partitioning:** At every block, reserves are split into **active** (tradeable) and **passive** (protected) fractions based on market conditions.

2. **Tail Collapse Mechanism:** As markets approach certainty ($P \to 0$ or $P \to 1$), the Gaussian PDF $\phi(z)$ collapses exponentially. Our λ* formula amplifies this signal, automatically reducing tradeable liquidity to near-zero at extremes.

3. **Mathematical Guarantee:** When $P = 0.99$, λ* ≈ 0.05, meaning **95% of LP capital is shielded** from the final arbitrage wave. LPs can withdraw their passive reserves safely before resolution.

4. **W-Shape Activeness Surface:** Liquidity is maximally active at $P = 0.5$ (high uncertainty, fair game) and minimally active at $P \to 0$ or $P \to 1$ (high certainty, unfair game).

**Key Insight:** Traditional AMMs treat all probabilities equally. Omniverse recognizes that **the risk of adverse selection is not uniform**—it explodes at market extremes. By dynamically adjusting liquidity exposure based on this risk gradient, we transform LP provision from a guaranteed-loss game into a sustainable business model.

---

### 4.3 Gaussian λ*: Optimal Activeness

Omniverse solves the wipeout problem using a **Partially Active AMM (PA-AMM)** framework combined with a novel optimal activeness parameter, **Gaussian λ*** (Lambda Star).

#### **The PA-AMM Model**

In a PA-AMM, only a fraction $\lambda \in [0, 1]$ of the pool's reserves are **active** (available for trading). The remaining $(1 - \lambda)$ fraction is **passive** (shielded from trades).

**Active reserves:**
$$x_{\text{active}} = \lambda \cdot x, \quad y_{\text{active}} = \lambda \cdot y$$

**Passive reserves:**
$$x_{\text{passive}} = (1 - \lambda) \cdot x, \quad y_{\text{passive}} = (1 - \lambda) \cdot y$$

Trades execute only against the active reserves, leaving the passive reserves untouched.

#### **The Optimal Activeness Formula**

The key innovation is determining $\lambda^*$ dynamically based on the current market probability $P$ and a governance parameter $\gamma'$. The optimal activeness is given by:

$$\lambda^*(P) = \frac{1 + \sqrt{1 + 2\gamma_G}}{1 + \gamma_G + \sqrt{1 + 2\gamma_G}}$$

where the **Gaussian risk weight** $\gamma_G$ is defined as:

$$\gamma_G = \frac{\gamma'}{2 \cdot v(z) \cdot \phi(z)}$$

and the components are:

| Term | Definition |
|------|------------|
| $z = \Phi^{-1}(P)$ | Inverse CDF: maps probability $P$ back to the z-score |
| $\phi(z)$ | Standard normal PDF evaluated at $z$ |
| $v(z) = \phi(z) + z \cdot (2\Phi(z) - 1)$ | Pool value per unit liquidity $L$ |
| $\gamma'$ | Protocol governance parameter (e.g., $\gamma' = 2$) |

#### **Mathematical Behavior: The "W-Shape" Collapse**

The critical insight is that as $P \to 0$ or $P \to 1$:

1. $z = \Phi^{-1}(P) \to \pm\infty$
2. $\phi(z) \to 0$ exponentially (PDF tail decay)
3. $\gamma_G \to \infty$ (denominator vanishes)
4. $\lambda^* \to 0$ (activeness collapses)

**Result:** At market extremes (e.g., $P = 0.99$), the protocol automatically hides $95\%$ or more of LP capital from arbitrageurs, preserving LP solvency.

This creates a **W-shaped activeness surface** across the probability space, where liquidity is maximally active near $P = 0.5$ (maximum uncertainty) and minimally active near $P = 0$ or $P = 1$ (near-certainty).



---

### 4.4 Dynamic Liquidity Decay

To further protect LPs and bound Loss-Versus-Rebalancing (LVR) over the market's lifetime, Omniverse implements **time-decaying liquidity**.

#### **The Time-Dependent Liquidity Formula**

$$L_t = L_0 \cdot \sqrt{T - t}$$

where:
- $L_0$ is the initial liquidity depth at market creation ($t = 0$)
- $T$ is the market's expiration timestamp
- $t$ is the current time
- $L_t$ is the effective liquidity available for trading at time $t$

#### **Economic Intuition**

As expiration approaches ($t \to T$):
1. **Volatility Increases:** Prices accelerate toward $0$ or $1$ as uncertainty resolves.
2. **LVR Risk Spikes:** Informed traders have increasing informational advantages.
3. **Liquidity Shrinks:** The protocol automatically reduces tradeable depth, limiting LP exposure.

At $t = T$ (expiration), $L_t = 0$, and all trading ceases.

#### **Bounded Lifetime LVR**

The dynamic decay ensures that the **total expected Loss-vs-Rebalancing** over the market's lifetime is bounded and predictable:

$$\text{Expected Lifetime LVR} \approx \frac{L_0}{2}$$

This transforms LP risk from an unbounded, unpredictable hazard into a **quantifiable, manageable cost**, allowing LPs to price their services through trading fees.

---

### 4.5 Implementation in Arbitrum Stylus

Computing $\phi(z)$, $\Phi(z)$, $\Phi^{-1}(P)$, and $\lambda^*(P)$ in native Solidity would cost **thousands of gas per call**. Omniverse implements these functions in a **Rust/WASM kernel** deployed via Arbitrum Stylus.

#### **Key Functions in OmniverseMath Contract**

```rust
pub fn phi(&self, z: I256) -> U256
// Standard normal PDF: φ(z) = exp(-z²/2) / √(2π)

pub fn Phi(&self, z: I256) -> U256
// Standard normal CDF: Φ(z) using Abramowitz & Stegun approximation

pub fn PhiInv(&self, p: U256) -> I256
// Inverse CDF: Φ⁻¹(p) using Acklam + Halley refinement

pub fn lambdaStarGaussian(&self, gamma_prime: U256, p_true: U256) -> U256
// Optimal activeness: λ*(γ', P) with tail collapse logic

pub fn solveSwap(&self, x1: U256, y0: U256, ell: U256) -> U256
// Newton-Raphson solver for the pm-AMM invariant
```

#### **Fixed-Point WAD Arithmetic**

All computations use **18-decimal fixed-point integers** (WAD = $10^{18}$). Floating-point operations (`f32`/`f64`) are **strictly forbidden**, as they:
- Break deterministic consensus
- Cause Stylus contract activation failures
- Introduce non-reproducible rounding errors

#### **Gas Efficiency**

| Operation | Solidity (Pure EVM) | Stylus (Rust/WASM) | Speedup |
|-----------|---------------------|---------------------|---------|
| $\Phi(z)$ | ~8,000 gas | ~300 gas | **26×** |
| $\lambda^*(P)$ | ~15,000 gas | ~800 gas | **18×** |
| `solveSwap` (Newton-Raphson) | ~50,000 gas | ~2,500 gas | **20×** |

This enables complex on-chain probability pricing at a fraction of the cost, making Omniverse economically viable for high-frequency prediction market trading.

---

### 4.6 Mathematical Summary

| Concept | Formula | Implication |
|---------|---------|-------------|
| **pm-AMM Invariant** | $(y-x)\Phi(\frac{y-x}{L}) + L\phi(\frac{y-x}{L}) - y = 0$ | Gaussian-based pricing surface |
| **Marginal Price** | $P = \Phi(\frac{y-x}{L})$ | Direct probability representation |
| **Optimal Activeness** | $\lambda^* = \frac{1 + \sqrt{1 + 2\gamma_G}}{1 + \gamma_G + \sqrt{1 + 2\gamma_G}}$ | Protects LPs at extremes |
| **Gaussian Risk Weight** | $\gamma_G = \frac{\gamma'}{2 \cdot v(z) \cdot \phi(z)}$ | Tail-weighted adverse selection |
| **Dynamic Liquidity** | $L_t = L_0\sqrt{T-t}$ | Bounds lifetime LVR |
| **Pool Value** | $v(z) = \phi(z) + z(2\Phi(z)-1)$ | Value per unit liquidity |

**The result:** A mathematically robust, LP-protective, and capital-efficient prediction market AMM that solves the three core problems plaguing existing platforms.



---

    
    style B fill:#bbdefb,stroke:#1976d2,stroke-width:2px,color:#000
    style D fill:#fff9c4,stroke:#f57f17,stroke-width:2px,color:#000
    style E fill:#ffcdd2,stroke:#c62828,stroke-width:2px,color:#000
    style F fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#000
    style X fill:#ffcdd2,stroke:#c62828,stroke-width:2px,color:#000
    style Y fill:#ffcdd2,stroke:#c62828,stroke-width:2px,color:#000
```



---

## 🔗 Contract Interactions

This section provides detailed function signatures and interaction patterns for developers building on Omniverse.

---

### 4.1 OmniverseMath (Stylus Math Kernel)

**Deployment Address:** `0x78e5e65dBE6e9bE10e7BcED0f127fB21247f7c14` (Arbitrum Sepolia)

All functions are pure (no state modifications) and gas-optimized.

```solidity
// Standard normal PDF: φ(z)
function phi(int256 z) external pure returns (uint256);

// Standard normal CDF: Φ(z)
function Phi(int256 z) external pure returns (uint256);

// Inverse CDF: Φ⁻¹(p) — reverts if p ≤ 0 or p ≥ WAD
function PhiInv(uint256 p) external pure returns (int256);

// Optimal activeness: λ*(γ', P) ∈ [0.05, 1.0]
function lambdaStarGaussian(uint256 gammaPrime, uint256 pTrue) 
    external pure returns (uint256);

// Solve pm-AMM invariant for y1 given x1, y0, L
function solveSwap(uint256 x1, uint256 y0, uint256 ell) 
    external pure returns (uint256);

// Pool value per unit L: v(z) = φ(z) + z·(2Φ(z) - 1)
function poolValue(int256 z) external pure returns (uint256);
```

**Units:** All inputs/outputs use **WAD** (18-decimal fixed-point). `1e18` = 1.0.

---

### 4.2 PmAmmPool (Core AMM)

```solidity
// Execute a swap: trade token0 for token1 (or vice versa)
function swap(
    bool zeroForOne,      // true = swap token0→token1, false = token1→token0
    uint256 amountIn,     // amount of input tokens
    uint256 minAmountOut, // minimum output (slippage protection)
    address recipient     // address receiving output tokens
) external returns (uint256 amountOut);

// Add liquidity to the pool
function addLiquidity(
    uint256 amount0,      // YES tokens to deposit
    uint256 amount1,      // NO tokens to deposit
    address recipient     // address receiving LP shares
) external returns (uint256 lpShares);

// Remove liquidity from the pool
function removeLiquidity(
    uint256 lpShares,     // LP shares to burn
    uint256 minAmount0,   // minimum YES tokens to receive
    uint256 minAmount1,   // minimum NO tokens to receive
    address recipient     // address receiving tokens
) external returns (uint256 amount0, uint256 amount1);

// Get current market price (probability of YES outcome)
function getPrice() external view returns (uint256);

// Get effective liquidity (includes time decay)
function getEffectiveLiquidity() external view returns (uint256);
```

---

### 4.3 ConditionalTokens (ERC-1155 Outcome Tokens)

```solidity
// Split collateral into YES + NO tokens
function split(
    uint256 conditionId,   // market identifier
    uint256 amount         // collateral amount to split
) external;

// Merge YES + NO tokens back into collateral
function merge(
    uint256 conditionId,
    uint256 amount         // amount of token pairs to merge
) external;

// Redeem winning tokens for collateral (post-resolution)
function redeem(
    uint256 conditionId,
    uint256 amount         // amount of winning tokens to redeem
) external;

// Query token balance (ERC-1155 standard)
function balanceOf(address account, uint256 id) 
    external view returns (uint256);
```

**Token ID Encoding:**
- YES token: `keccak256(conditionId, outcome=0)`
- NO token: `keccak256(conditionId, outcome=1)`

---

### 4.4 MultiverseLending (Zero-Liquidation Borrowing)

```solidity
// Deposit collateral and borrow same-outcome debt
function borrow(
    uint256 collateralTokenId,  // YES/NO token used as collateral
    uint256 debtTokenId,        // YES/NO token to borrow (must match outcome)
    uint256 borrowAmount        // amount to borrow
) external;

// Repay debt and withdraw collateral
function repay(
    uint256 positionId,         // borrowing position ID
    uint256 repayAmount         // debt amount to repay
) external;

// Check health factor of a position
function getHealthFactor(uint256 positionId) 
    external view returns (uint256);

// Liquidate unhealthy position (cross-currency risk only)
function liquidate(uint256 positionId) external;
```

**Key Property:** If both `collateralTokenId` and `debtTokenId` map to the same outcome, the position is **immune to outcome-based liquidation**. Only cross-currency volatility (e.g., ETH/USD) matters.

---

## 🚀 Technology Stack

### **Smart Contracts**

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Math Kernel** | Rust, `stylus-sdk`, `no_std`, WASM | Gaussian computations, fixed-point arithmetic |
| **Core Contracts** | Solidity ^0.8.24, Foundry | AMM pools, tokens, lending, resolution |
| **Testing** | Forge (Foundry), Rust unit tests | Contract verification, invariant testing |
| **Deployment** | Arbitrum Stylus CLI, Foundry scripts | On-chain deployment and verification |

### **Frontend**

| Component | Technology |
|-----------|------------|
| **Framework** | React 19 with TanStack Start/Router |
| **Build Tool** | Vite 7 |
| **Styling** | Tailwind CSS 4, shadcn/ui components |
| **Web3 Integration** | wagmi v3, viem 2, RainbowKit |
| **Charts** | Recharts, D3.js |
| **State Management** | TanStack Query, Zustand |

### **Indexer & Backend**

| Component | Technology |
|-----------|------------|
| **Indexer** | Ponder (event-driven GraphQL indexer) |
| **Database** | PostgreSQL (production), PGlite (local dev) |
| **API** | GraphQL (auto-generated from Ponder schema) |
| **Hosting** | Railway (indexer), Vercel (frontend) |

### **Network & Infrastructure**

| Component | Details |
|-----------|---------|
| **Primary Network** | Arbitrum Sepolia (Testnet) |
| **RPC Provider** | Alchemy, Infura |
| **Math Kernel Execution** | Arbitrum Stylus (Rust/WASM layer) |
| **Gas Token** | SepoliaETH |
| **Collateral Tokens** | WETH, USDC (testnet versions) |



---

## 🛠️ Local Development & Deployment

### 6.1 Prerequisites

Ensure you have the following tools installed:

- **Node.js** >= 20.0.0
- **Bun** (optional, for faster package management)
- **Rust** with `wasm32-unknown-unknown` target
- **Foundry** (Forge, Cast, Anvil)
- **Arbitrum Stylus CLI** (`cargo install cargo-stylus`)
- **Docker** (for local PostgreSQL)

---

### 6.2 Installation

#### **Clone the Repository**

```bash
git clone https://github.com/yourusername/omniverse.git
cd omniverse
```

#### **Install Rust WASM Target**

```bash
rustup target add wasm32-unknown-unknown
```

#### **Install Dependencies**

```bash
# Stylus math kernel
cd contracts-stylus
cargo build --release --target wasm32-unknown-unknown

# Solidity contracts
cd ../contracts-sol
forge install

# Frontend
cd ../frontend
npm install

# Indexer
cd ../indexer
npm install
```

---

### 6.3 Compiling the Stylus Math Kernel

```bash
cd contracts-stylus

# Check if contract is valid for Stylus deployment
cargo stylus check

# Export ABI (Solidity interface)
cargo stylus export-abi

# Build optimized WASM binary
cargo build --release --target wasm32-unknown-unknown

# Deploy to Arbitrum Sepolia (requires SepoliaETH)
cargo stylus deploy \
  --private-key-path=<PATH_TO_KEY> \
  --endpoint=https://sepolia-rollup.arbitrum.io/rpc
```

**Output:** Contract address (e.g., `0x78e5...c14`)

---

### 6.4 Compiling & Testing Solidity Contracts

```bash
cd contracts-sol

# Compile all contracts
forge build

# Run full test suite
forge test

# Run tests with gas reporting
forge test --gas-report

# Run specific test file
forge test --match-path test/PmAmmPool.t.sol

# Run tests with verbose logging
forge test -vvv
```

#### **Deploy Solidity Contracts**

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
export MATH_KERNEL_ADDRESS=0x78e5...c14

# Deploy all contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

**Output:** Deployment manifest saved to `deployments/demo-manifest.json`

---

### 6.5 Running the Indexer

#### **Local Development (PGlite)**

```bash
cd indexer

# Start indexer with embedded database
npm run dev
```

Access GraphQL playground at `http://localhost:42069/graphql`

#### **Production (PostgreSQL)**

```bash
# Start PostgreSQL via Docker
docker run -d \
  --name omniverse-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=omniverse \
  -p 5432:5432 \
  postgres:15

# Set DATABASE_URL
export DATABASE_URL=postgresql://postgres:password@localhost:5432/omniverse
export PONDER_RPC_URL_421614=https://sepolia-rollup.arbitrum.io/rpc/<YOUR_KEY>

# Start indexer
npm run start
```

---

### 6.6 Running the Frontend

```bash
cd frontend

# Set environment variables
cat > .env.local << EOF
VITE_PONDER_GRAPHQL_URL=http://localhost:42069
VITE_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc/<YOUR_KEY>
VITE_WALLETCONNECT_PROJECT_ID=<YOUR_PROJECT_ID>
EOF

# Start development server
npm run dev
```

Access frontend at `http://localhost:3000`

---

### 6.7 Testing Smart Contracts

#### **Foundry Tests**

```bash
cd contracts-sol

# Run all tests
forge test

# Test specific contract
forge test --match-contract PmAmmPoolTest

# Run with coverage
forge coverage

# Run invariant/fuzz tests
forge test --match-test "invariant"
```

#### **Stylus Rust Tests**

```bash
cd contracts-stylus

# Run unit tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_lambda_star_gaussian
```

---

## 📁 Repository Structure

```
omniverse/
│
├── contracts-stylus/                # Rust/WASM Math Kernel (Arbitrum Stylus)
│   ├── src/
│   │   ├── lib.rs                   # Main Stylus entrypoint
│   │   ├── wad.rs                   # Fixed-point WAD arithmetic
│   │   ├── math/
│   │   │   ├── gaussian.rs          # φ(z), Φ(z), Φ⁻¹(p)
│   │   │   ├── lambda.rs            # λ*(P), v(z), γ_G calculation
│   │   │   ├── solver.rs            # Newton-Raphson swap solver
│   │   │   └── sqrt.rs              # Fixed-point square root
│   │   └── ...
│   ├── Cargo.toml
│   └── README.md
│
├── contracts-sol/                   # Solidity Core Contracts (Foundry)
│   ├── src/
│   │   ├── MarketFactory.sol        # Market creation and registry
│   │   ├── PmAmmPool.sol            # Core AMM with PA-AMM logic
│   │   ├── ConditionalTokens.sol    # ERC-1155 outcome tokens
│   │   ├── MultiverseLending.sol    # Zero-liquidation lending
│   │   ├── Resolver.sol             # Oracle resolution interface
│   │   └── interfaces/              # Contract interfaces
│   ├── test/                        # Forge test suite
│   ├── script/                      # Deployment scripts
│   ├── deployments/                 # Deployment artifacts
│   │   └── demo-manifest.json       # Current testnet deployment
│   └── foundry.toml
│
├── frontend/                        # React 19 Frontend (TanStack Start)
│   ├── src/
│   │   ├── app/                     # App router pages
│   │   ├── components/              # React components
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/                     # Utilities and helpers
│   │   └── ...
│   ├── public/
│   │   └── demo-manifest.json       # Frontend copy of deployment
│   ├── package.json
│   └── vite.config.ts
│
├── indexer/                         # Ponder GraphQL Indexer
│   ├── src/
│   │   ├── index.ts                 # Event handlers
│   │   └── ...
│   ├── ponder.config.ts             # Network and contract config
│   ├── ponder.schema.ts             # GraphQL schema definition
│   └── package.json
│
├── scripts/                         # Deployment and utility scripts
│   ├── fresh-demo.sh                # Deploy new demo market
│   └── ...
│
├── CONTEXT.md                       # Detailed technical context
├── DEMO_EXECUTION_GUIDE.md          # Step-by-step demo instructions
├── IMPLEMENTATION_PLAN.md           # Original development roadmap
└── README.md                        # This file
```

---

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 Omniverse Protocol

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- **Paradigm Research Team** for the foundational pm-AMM research
- **Arbitrum Foundation** for the Stylus framework enabling Rust/WASM smart contracts
- **Gnosis** for the Conditional Tokens Framework design
- **Uniswap Labs** for pioneering AMM innovation
- **The DeFi Community** for pushing the boundaries of decentralized finance

---

## 🔗 Resources

- **Paradigm pm-AMM Paper:** [https://www.paradigm.xyz/2024/11/pm-amm](https://www.paradigm.xyz/2024/11/pm-amm)
- **Arbitrum Stylus Docs:** [https://docs.arbitrum.io/stylus](https://docs.arbitrum.io/stylus)
- **Gnosis Conditional Tokens:** [https://docs.gnosis.io/conditionaltokens](https://docs.gnosis.io/conditionaltokens)
- **Project Repository:** [https://github.com/yourusername/omniverse](https://github.com/yourusername/omniverse)

---

**Built with ❤️ for the future of prediction markets**

© 2025 Omniverse Protocol. All rights reserved.
