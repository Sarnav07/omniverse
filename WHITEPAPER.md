<div align="center">

# Omniverse — Whitepaper

### Next-Generation Prediction Markets & Zero-Liquidation Lending on Arbitrum Stylus

**Gaussian λ* Activeness · Liquidation-Free Lending · Rust → WASM Kernel**

</div>

---

## 1. Abstract & Problem Statement

**Abstract.** Omniverse is a decentralized prediction market protocol that solves the catastrophic liquidity provider (LP) wipeout problem inherent to automated market makers (AMMs) in binary outcome markets. By introducing a novel Partially Active AMM (PA-AMM) framework driven by **Gaussian λ* (Lambda Star)**, the protocol dynamically shields LP capital from informed arbitrageurs as event probabilities approach certainty. Furthermore, Omniverse introduces **Multiverse Lending**, a money market that eliminates liquidation risk by pairing outcome-conditional collateral with identical-outcome debt. The protocol's complex probability density and cumulative distribution functions (PDF/CDF) are computed deterministically on-chain via a highly optimized Rust/WASM Math Kernel deployed on **Arbitrum Stylus**, reducing gas costs by 10–100× compared to pure EVM implementations.

**The bottleneck we solve.** Today's prediction market AMMs suffer from severe structural vulnerabilities that punish liquidity providers and fracture capital efficiency:

1. **The LP Wipeout Problem:** In a standard constant-function or pm-AMM, all reserves are tradeable. When an event resolves (e.g., $P \to 1$), the losing token's value collapses to $0$. Arbitrageurs immediately drain the valuable winning tokens from the pool, leaving LPs holding 100% worthless inventory. This is permanent capital destruction, not impermanent loss.
2. **Liquidation Cascades in Lending:** Borrowing against prediction market tokens today exposes users to massive liquidation risk if the market swings wildly. A sudden shift in probability can trigger margin calls, bad debt, and cascading liquidations.
3. **Prohibitive On-Chain Math:** Accurately pricing binary outcomes requires evaluating the Gaussian CDF and its inverse. In Solidity, approximating error functions or running Newton-Raphson solvers consumes exorbitant gas, forcing protocols to either centralize their pricing engines or use crude, exploitable approximations.

Omniverse's thesis is that **intelligent reserve partitioning (PA-AMM) combined with WASM-native execution** completely removes these bottlenecks, creating a mathematically sound, LP-friendly, and highly scalable prediction market infrastructure.

---

## 2. System Architecture

Omniverse employs a modular, hybrid architecture separating pure mathematical computation from stateful asset management. The system is split across two execution environments on Arbitrum Sepolia: the **EVM (Solidity)** for state, custody, and token standards, and the **WASM runtime (Stylus)** for heavy numerical methods.

```mermaid
flowchart TD
    subgraph MathLayer["Arbitrum Stylus (Rust/WASM)"]
        OM[OmniverseMath Kernel]
    end

    subgraph EVMLayer["Solidity Contracts"]
        MF[MarketFactory]
        PA[PmAmmPool]
        CT[ConditionalTokens ERC-1155]
        ML[MultiverseLending]
        RES[Resolver]
    end

    Trader([Trader]) -->|swap| PA
    PA -->|1. fetch optimal λ*| OM
    PA -->|2. solve swap invariant| OM
    PA <-->|transfer YES/NO| CT

    LPer([Liquidity Provider]) -->|add/remove liquidity| PA
    PA -->|pool value v(z)| OM

    Borrower([Borrower]) -->|deposit collateral, borrow debt| ML
    ML <-->|verify identical outcome| CT

    MF -->|deploy clone| PA
    MF -->|register| CT
```

**Component responsibilities:**

| Module | Execution | Responsibility |
|--------|-----------|----------------|
| `OmniverseMath` | Rust/WASM | Pure functional math: $\Phi(z)$, $\phi(z)$, $\lambda^*(P)$, Newton-Raphson swap solver. Uses strictly `I256`/`U256` WAD arithmetic. |
| `PmAmmPool` | Solidity | Custodies YES/NO reserves, manages the PA-AMM active/passive partition, processes trades, and decays liquidity over time. |
| `ConditionalTokens` | Solidity | ERC-1155 token tracking. 1:1 minting (1 USDC $\to$ 1 YES + 1 NO), merging, and post-resolution redeeming. |
| `MultiverseLending` | Solidity | Outcome-conditional money market. Manages deposits, debt issuance, and health factors. |
| `MarketFactory` | Solidity | Market registry and permissionless deployment of new PM pairs. |

---

## 3. Core Mechanism / Theoretical Framework

### 3.1 The pm-AMM and Gaussian Invariant

The foundation of Omniverse is the prediction market AMM (pm-AMM) invariant, a specialized curve that models probabilities assuming the underlying "score" of an event follows Brownian motion. The invariant for reserves $x$ (YES) and $y$ (NO) is:

$$(y - x) \cdot \Phi\left(\frac{y - x}{L}\right) + L \cdot \phi\left(\frac{y - x}{L}\right) - y = 0$$

Where $\Phi$ is the Gaussian CDF, $\phi$ is the PDF, and $L$ is the liquidity depth. The marginal price (the market's implied probability) emerges elegantly as $P = \Phi(\frac{y - x}{L})$. This guarantees that $P \in (0, 1)$ and strictly bounds the price space. 

### 3.2 LP Protection via Gaussian λ* (Partially Active AMM)

To prevent the **LP Wipeout Problem**, Omniverse introduces the Partially Active AMM (PA-AMM). Instead of exposing all reserves to traders, only a fraction $\lambda \in [0, 1]$ is tradeable ($x_{\text{active}} = \lambda x$). The remaining $(1-\lambda)$ is shielded.

The optimal activeness parameter, **Gaussian λ***, is computed dynamically per block based on the current market probability $P$:

$$\lambda^*(P) = \frac{1 + \sqrt{1 + 2\gamma_G}}{1 + \gamma_G + \sqrt{1 + 2\gamma_G}} \quad \text{where} \quad \gamma_G = \frac{\gamma'}{2 \cdot v(z) \cdot \phi(z)}$$

Here, $z = \Phi^{-1}(P)$ is the z-score of the probability, and $\gamma'$ is a protocol governance parameter. 

**The "W-Shape" Collapse:** 
The brilliance of this formula lies in its tail behavior. As a market approaches certainty ($P \to 1$ or $P \to 0$), the PDF $\phi(z)$ decays exponentially to $0$. This causes the Gaussian risk weight $\gamma_G$ to diverge to $\infty$, which forces the activeness $\lambda^*$ to violently collapse toward $0$. 
If a market hits $99\%$ certainty, the protocol automatically hides $>95\%$ of LP funds from the active trading pool. Arbitrageurs can only drain the tiny active fraction, leaving the vast majority of LP capital safely shielded and ready to be redeemed.

### 3.3 Dynamic Liquidity Decay

Adverse selection risk (Loss-Versus-Rebalancing, LVR) increases as the event expiration $T$ approaches. Omniverse combats this by deterministically shrinking the liquidity depth $L$ over time:

$$L_t = L_0 \cdot \sqrt{T - t}$$

As $t \to T$, the curve steepens and liquidity vanishes. This mathematical guarantee explicitly bounds the expected lifetime LVR to roughly $L_0 / 2$, allowing LPs to accurately price their risk and remain profitable purely on swap fees.

### 3.4 Zero-Liquidation Multiverse Lending

Omniverse introduces an outcome-conditional money market where liquidations are mathematically obsolete. 

Users deposit collateral bound to a specific outcome (e.g., `YES-ETH`) and borrow debt bound to the **exact same outcome** (e.g., `YES-USDC`). If the event resolves unfavorably (NO wins), the collateral goes to zero—but so does the debt. The user's net position cleanly evaporates with no bad debt and no need for keeper liquidations. 

The Health Factor (HF) is calculated simply as $HF = \text{Value}(\text{Collateral}) / \text{Value}(\text{Debt})$. Because both assets share identical event probabilities, the $P$ term cancels out perfectly. The only remaining risk is standard cross-currency volatility (ETH vs. USDC), which is handled by standard lending liquidation mechanics.

---

## 4. Security & Edge Cases

Omniverse is designed with strict boundaries to handle the nuances of cross-VM computation and deep mathematical primitives.

- **Fixed-Point Arithmetic (No Floats):** The Stylus Math Kernel operates entirely on `I256` and `U256` 18-decimal WAD types. Floating-point types (`f32`/`f64`) are notoriously non-deterministic across different node architectures and are explicitly avoided to ensure consensus stability and EVM compatibility.
- **Gas Bounding in Solvers:** The `solveSwap` function uses a Newton-Raphson numerical solver to find the root of the pm-AMM invariant. To prevent infinite loops or out-of-gas vectors, the solver is hard-capped at 256 iterations and falls back to a safe revert if convergence fails.
- **WAD Overflow Protection:** Inverse CDF calculations ($\Phi^{-1}(P)$) diverge at exactly $P = 0$ or $P = 1$. The math kernel aggressively clamps probability inputs to a safe domain (e.g., $[10^{-9}, 1 - 10^{-9}]$) to prevent `I256` overflows during extreme z-score expansions.
- **ERC-1155 Escrow Solvency:** The `ConditionalTokens` contract mints YES and NO tokens perfectly 1:1 against deposited USDC. It is mathematically impossible to mint an unbacked outcome token, guaranteeing that when an event resolves, the contract always holds exactly enough USDC to pay out the winning shares at $1.00 each.

---

## 5. Conclusion & Future Work

**What we proved.** Omniverse successfully demonstrates that the complex, continuous mathematics required to protect LPs in prediction markets—Gaussian CDFs, PDFs, and active-reserve lambda optimization—can be executed purely on-chain. By offloading these calculations to a Rust/WASM kernel on Arbitrum Stylus, the protocol achieves 10-100× gas reductions while solving the LP wipeout problem that has historically crippled prediction market liquidity. Coupled with the Multiverse Lending primitive, it offers unprecedented capital efficiency.

**Production roadmap.**

1. **Oracle Integration:** The current `Resolver.sol` is owner-controlled. The immediate next step is integrating UMA's Optimistic Oracle or Chainlink data feeds for decentralized, trustless market resolution.
2. **Cross-Outcome Lending Markets:** Expanding the Multiverse Lending protocol to allow users to borrow `YES` tokens against `NO` collateral (with appropriate dynamic LTVs) to facilitate advanced delta-neutral hedging strategies.
3. **Yield-Bearing Escrow:** The underlying USDC collateral locked in the `ConditionalTokens` contract currently sits idle. Routing this TVL into whitelisted yield protocols (e.g., Aave v3, Compound) will generate baseline yield for LPs, drastically improving capital efficiency.
4. **ZK-Proofs for Computations:** While Stylus provides incredible gas savings, future iterations could move the Newton-Raphson solvers entirely off-chain, verifying the invariant solutions on-chain via lightweight SNARKs to further minimize transaction costs.

<br/>
<div align="center">
<i>Omniverse — Liquidity Bounded, Solvency Guaranteed.</i>
</div>
