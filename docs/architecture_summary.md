# Omniverse Architecture & Implementation Summary

## 1. Introduction & Executive Overview

Omniverse is a highly advanced, institutional-grade execution terminal for prediction markets. Built on top of Arbitrum Sepolia, it leverages the bleeding edge of Web3 technologies: Arbitrum Stylus for ultra-efficient Rust-based mathematical kernels, Ponder for blazing-fast indexing and GraphQL querying, and a heavily optimized React+Vite frontend powered by Wagmi, RainbowKit, and URQL.

The core mission of Omniverse is to provide a "zero-liquidation" lending market coupled with a probability-invariant automated market maker (pmAMM). By utilizing the Gnosis Conditional Tokens Framework (CTF), the protocol splits liquidity into YES and NO branches (often referred to as universes). This allows users to borrow against their positions without ever facing forced exits or margin calls, as the debt and collateral resolve together natively on-chain.

This document serves as an exhaustive, line-by-line summary of the entire stack, detailing every contract, indexer, and frontend component, alongside the rationale for every technical decision made during the build process.

---

## 2. Core Mathematical Foundation (OmniverseMath)

Prediction markets require complex mathematics to determine prices, slippage, and liquidity depth. Standard AMMs like Uniswap x*y=k are insufficient because prediction market tokens are bounded between 0 and 1 (or 0% and 100% probability). Omniverse uses a Gaussian Cumulative Distribution Function (CDF) approach for its invariant.

### 2.1 The Gaussian CDF (Phi)
The core invariant of the pmAMM is based on the Gaussian CDF, $\Phi(z)$. The contract needs to compute this function efficiently on-chain. Because the Ethereum Virtual Machine (EVM) is notoriously slow and expensive for floating-point math, Omniverse implements this in two ways:
1. A fallback Solidity implementation (`OmniverseMathSolidity.sol`).
2. An ultra-fast Arbitrum Stylus Rust implementation.

### 2.2 The Invariant Equation
The invariant $f(x,y,L)$ for the pool is defined such that the pool always maintains enough liquidity to pay out the winning side. The reserves $x$ (NO) and $y$ (YES) are balanced against a dynamic liquidity parameter $L$, which decays over time as the event approaches its expiry $T$.

The gap $g$ is defined as the difference between the active reserves and the passive reserves. As traders push the price around, the pool dynamically rebalances its active liquidity.

### 2.3 Solved Swaps
When a trader calls `buyYes` or `buyNo`, the math kernel calculates the exact amount of shares they receive by solving the invariant equation for the new reserve amounts. This requires Newton-Raphson approximation under the hood because the Gaussian CDF cannot be inverted algebraically.

---

## 3. Arbitrum Stylus Integration (Rust WASM)

Arbitrum Stylus is a paradigm shift in smart contract development, allowing developers to write contracts in Rust, compile them to WebAssembly (WASM), and deploy them alongside standard Solidity contracts.

### 3.1 The Rust Kernel
The `contracts-stylus/` directory contains the Rust source code for the math kernel.
- **Dependencies:** Uses `alloy-primitives` for Ethereum-compatible types (e.g., U256) and `stylus-sdk` to interact with the Arbitrum host environment.
- **Functions:** Implements `phi` (PDF), `Phi` (CDF), `solve_swap`, and `lambda_star_gaussian`.
- **Performance:** Because these mathematical approximations require loops (Taylor series expansions for the error function), running them in Solidity costs massive amounts of gas. Rust WASM executes at near-native speeds, cutting gas costs by over 10x.

### 3.2 The Solidity Wrapper
To make the Rust kernel easily consumable by the rest of the protocol, there is an `OmniverseTrade.sol` wrapper. The protocol uses a `fallback` pattern or standard interfaces to delegate calls to the WASM precompile. If the Stylus contract is unavailable or on a chain without Stylus, the system falls back to `OmniverseMathSolidity.sol`.

---

## 4. Solidity Smart Contracts

The smart contract architecture is designed around modularity, security, and capital efficiency. The contracts are written in Solidity 0.8.24 and rely heavily on the Gnosis CTF.

### 4.1 The Gnosis Conditional Tokens Framework (CTF)
At the base of the protocol is `IConditionalTokens.sol`.
- **Conditions:** An event is registered as a "Condition" using a `questionId` and an `oracle` (resolver).
- **Splitting:** Users deposit collateral (like WETH or USDC) and call `splitPosition` to mint YES and NO tokens (ERC-1155).
- **Merging:** Users can burn YES and NO tokens to retrieve their underlying collateral.
- **Redemption:** Once the oracle resolves the event, the winning tokens can be redeemed 1:1 for the collateral, while the losing tokens become worthless.

### 4.2 MarketFactory.sol
The `MarketFactory` is the entry point for creating new prediction markets.
- **Event Creation:** Anyone can call `createEvent` with a `question`, `symbol`, `category`, and `expiry`.
- **Pool Instantiation:** For every event, the factory deploys **two** `PmAmmPool` instances: one for WETH collateral and one for USDC collateral.
- **Metadata Emission:** As recently patched, the `createEvent` function natively emits the human-readable strings (`question`, `symbol`, `category`) directly in the `EventCreated` log. This completely couples the on-chain data to the indexer, removing the need for off-chain API synchronization.

### 4.3 PmAmmPool.sol
The `PmAmmPool` is the lifeblood of trading.
- **Reserves:** Tracks `xActive`, `yActive`, `xPassive`, and `yPassive`. Active liquidity is used for quoting prices, while passive liquidity is held in reserve to guarantee solvency.
- **Liquidity Provision:** Users call `addLiquidity(yesAmount, noAmount, minShares)`. 
  - *Security Patch:* The first 1,000 shares are permanently burned to prevent inflation attacks (similar to Uniswap V2).
- **Trading:** Users call `buyYes` or `buyNo`. The contract routes the input to the math kernel, updates reserves, and checks the invariant before transferring the CTF ERC-1155 tokens.
- **Dynamic Fees/Lambda:** The pool uses a dynamic $\lambda$ value that adjusts based on market volatility and time to expiry, preventing toxic flow from draining LPs.

### 4.4 MultiverseLending.sol
This is the zero-liquidation lending protocol.
- **Architecture:** It creates isolated debt markets for specific CTF conditions. Lenders deposit USDC into the "reserve". Borrowers deposit YES-WETH collateral to borrow YES-USDC.
- **Zero Liquidation:** Because a borrower uses YES-WETH to borrow YES-USDC, the outcome of the event affects both sides equally. If YES wins, the WETH is valuable and the debt must be repaid. If NO wins, both the collateral and the debt go to zero simultaneously. The borrower is never forcefully liquidated during the life of the loan.
- **Settlement:** Once the event resolves, `settle()` is called. The contract redeems its holdings with the CTF. Borrowers call `claimBorrower()` to retrieve any equity, and lenders call `claimLender()` to retrieve their principal + yield.

### 4.5 SeedMarket.s.sol and Deploy.s.sol
Foundry scripts automate the entire deployment process.
- **Deploy.s.sol:** Deploys the Math Kernel, Mocks (CTF, WETH, USDC, Oracle), Resolver, and MarketFactory. It writes the addresses to `deployments/arb-sepolia.json`.
- **SeedMarket.s.sol:** 
  1. Creates the "Will ETH reach 10k in 2026?" event.
  2. Mints mock WETH/USDC to the deployer.
  3. Splits the collateral into YES/NO tokens.
  4. Adds liquidity to the PmAmmPools (accounting for the 1000 share burn).
  5. Deploys a `MultiverseLending` pool specific to the event.
  6. Opens a demo loan.
  7. Writes the seeded addresses to `seed-manifest.json`.

---

## 5. Ponder Indexer

Because prediction markets generate complex state changes and require heavy aggregation (e.g., historical prices, TVL, 24h volume), querying the RPC directly from the frontend is impossible. Ponder is used to index the blockchain into a local database and expose it via GraphQL.

### 5.1 Ponder Config (ponder.config.ts)
The config wires up the deployed contract addresses and ABIs.
- It dynamically discovers the `PmAmmPool` addresses using Ponder's `factory` pattern. By listening to the `MarketFactory`'s `EventCreated` log, Ponder automatically spins up new indexers for the `poolWeth` and `poolUsdc` addresses generated in the event.
- It points to the Arbitrum Sepolia RPC and sets a strict `startBlock` to prevent scanning the entire chain history from genesis, saving hours of sync time.

### 5.2 Ponder Schema (ponder.schema.ts)
The schema defines the PostgreSQL tables (or SQLite in dev):
- `market`: Stores `conditionId`, `question`, `symbol`, `category`, pool addresses, `lastPrice`, and `totalVolume`.
- `trade`: Logs every `OmniverseTrade` event, calculating the price impact, lambda, and slippage.
- `price_snapshot`: Takes a snapshot of the price at every trade to power the frontend's probability charts.
- `rebalance`: Logs the internal math rebalances of the pmAMM.
- `liquidity_event`: Tracks LP deposits and withdrawals.
- `lending_action`: Tracks deposits, borrows, repays, and claims on the MultiverseLending contract.

### 5.3 Event Handlers (src/*.ts)
The TypeScript handlers listen to the raw EVM logs and upsert data into the schema.
- **MarketFactory.ts:** Creates the initial `market` entity.
- **PmAmmPool.ts:** Updates the `market.lastPriceWeth`, increments `tradeCount`, and inserts a `price_snapshot` every time an `OmniverseTrade` fires.
- **MultiverseLending.ts:** Tracks debt and collateral balances.

---

## 6. Frontend Architecture (React + Vite)

The frontend is a dark-themed, highly stylized execution terminal. It uses React, Vite, and TailwindCSS for the build system and styling.

### 6.1 Routing & Tanstack Router
Instead of standard React Router, Omniverse uses `@tanstack/react-router` for fully type-safe, file-based routing.
- `__root.tsx`: The root layout wrapping the entire app.
- `index.tsx`: The landing page.
- `markets.tsx`: The market explorer table.
- `markets.$id.tsx`: The dynamic Execution Terminal for a specific market.

### 6.2 RainbowKit & Wagmi Setup
Wallet connection is handled by `viem`, `wagmi`, and `@rainbow-me/rainbowkit`.
- In `__root.tsx`, the `WagmiProvider` is configured with `arbitrumSepolia`.
- `WalletButton.tsx` implements a custom RainbowKit button to seamlessly blend into the terminal's minimalist aesthetic, replacing the standard blue button with an institutional "connected" state showing the user's ENS or shortened address.

### 6.3 URQL & GraphQL Data Fetching
Instead of Apollo, `urql` is used for lightweight, fast GraphQL queries.
- `urqlClient` is instantiated in `src/lib/urql.ts` pointing to the Ponder endpoint (e.g., `http://localhost:42069`).
- `markets.tsx` queries the top 50 markets ordered by creation date, calculating TVL and volumes on the fly.
- `markets.$id.tsx` queries the specific market by ID to populate the header strip.

### 6.4 UI Components

#### 6.4.1 TerminalPage (markets.$id.tsx)
The terminal is split into a dual-pane layout. The left pane is visual and analytical; the right pane is the execution engine.

#### 6.4.2 SwapTab & IntentEngine
These components have been meticulously wired to the smart contracts:
- **SwapTab:** Calls `buyYes` or `buyNo` on the `market.poolUsdc` address. It calculates the requested shares and passes the correct `[amountIn, minOut]` arguments to Wagmi's `useWriteContract`.
- **IntentEngine (Provide):** Allows users to LP into the pmAMM. It calls `addLiquidity` with exactly three arguments, preventing reverts.
- **IntentEngine (Execute):** Allows users to borrow YES-USDC against YES-WETH collateral via `MultiverseLending`.
- **ManageTab:** Allows users to manage their debt positions (repay/withdraw).

#### 6.4.3 ProbabilityCanvas
A custom SVG component that visualizes the Gaussian probability distribution of the market.
- It dynamically draws a bell curve using SVG paths (`d="M ... Q ..."`).
- It calculates the $x$ position based on the market's $\mu$ (current probability).
- A hover interaction tracks the user's mouse, mapping the X-coordinate to a probability and displaying a frosted glass tooltip with live liquidity depth estimations.

#### 6.4.4 StripStat & BigInput
- `StripStat`: A minimalist data display component for the header strip, rendering glowing text using Tailwind's `text-shadow` utilities for accents.
- `BigInput`: A dynamic font-scaling input field for trade sizes. As the user types larger numbers, the font size smoothly decreases to fit the container.

---

## 7. State Management & Animations

- **Framer Motion:** Used heavily for micro-interactions. The tab switching in the IntentEngine utilizes `layoutId` to smoothly animate the "pill" background sliding from one tab to the next.
- **Sonner:** A toast notification library. During a transaction, `useWaitForTransactionReceipt` triggers Sonner to display "Waiting for wallet...", updates to "Transaction submitted...", and finally resolves to "Transaction confirmed".

---

## 8. Development & Deployment Pipeline

1. **Foundry Scripts:** All Solidity logic is tested and deployed via `forge`.
2. **Ponder Dev Server:** `bun run dev` inside the `indexer` folder hot-reloads the schema and replays historical blocks in milliseconds.
3. **Vite Hot Module Replacement:** The React app updates instantly upon file saves.
4. **Environment Variables:** `.env` files are strictly managed to keep Private Keys out of version control while safely injecting public RPCs and GraphQL endpoints into the Vite build step.

---

## 9. Found Discrepancies & Resolutions (Task Log)

During the final integration phase, several critical discrepancies were identified and resolved:
1. **PmAmmPool Slippage:** The security patch to burn 1,000 shares in `PmAmmPool.sol` caused the `SeedMarket.s.sol` script to fail with a `Slippage()` revert. The script was updated to subtract 1,000 from `minShares`.
2. **Missing Frontend Addresses:** The frontend was statically referencing `CONTRACT_ADDRESSES.PmAmmPool`, which didn't exist. The GraphQL query in `markets.$id.tsx` was updated to fetch `poolWeth` and `poolUsdc` dynamically from Ponder.
3. **Missing Lending Config:** `MultiverseLending` was added to `frontend/src/config/contracts.ts` so the Manage and Borrow tabs had a valid target.
4. **Invalid Contract Arguments:** The `useWriteContract` hooks in the frontend were passing incorrect argument counts (e.g., passing 1 argument to a function requiring 2). All instances were audited and aligned with the actual Solidity ABIs.
5. **Mock Removals:** All fake timeout toasts and `simulateTransaction` calls were purged from the codebase, replacing them with live `viem` transaction hooks.

---

## 10. Conclusion

Omniverse stands as a complete, end-to-end decentralized application. From the low-level WASM optimizations in Arbitrum Stylus to the seamless React animations in the execution terminal, every layer has been architected to provide an uncompromising user experience and robust financial security. The integration of Gnosis CTF with zero-liquidation lending mechanisms paves the way for a new generation of capital-efficient prediction markets.
