# Demo Execution Guide — "Attack the Pool"

A complete, self-serve runbook for the OMNIVERSE live demo on Arbitrum Sepolia.
Follow it top to bottom. The **Troubleshooting** section at the end covers every
issue we actually hit — read it if anything looks wrong.

---

## 0. What the demo shows

A pm-AMM (Gaussian-invariant) prediction market. You play an **attacker** who pushes
the market probability toward an extreme. As the price climbs, the on-chain math
recomputes **λ\*** (optimal activeness) and shifts reserves from *active* to *passive*
to shield LPs. Everything is real:
- Trades execute on **Arbitrum Sepolia** (chainId `421614`).
- A **Ponder indexer** picks up each trade and serves it over GraphQL.
- The **frontend** reads price/λ\* live from the chain and the trade history from the indexer.

**Headline moment:** the market probability climbs `0.50 → ~0.63 → ~0.76 → ~0.91`
across three trades, while λ\* and the LP-shield update live.

---

## 1. One-time setup (do this once)

### 1a. Environment / RPC
The deploy and indexer need an **archive** RPC (the public Arbitrum Sepolia RPC is
non-archive and breaks `forge` deploys). An Alchemy key is already wired into:
- `contracts-sol/.env` → `ARB_SEPOLIA_RPC`
- `.env` → `PONDER_RPC_URL`
- `indexer/.env` → `PONDER_RPC_URL_421614`

If you ever swap RPCs, update **all three** to the same archive URL.

### 1b. Dependencies (only if not already installed)
```bash
cd /home/pratham/Sarnav/omniverse/indexer  && bun install
cd /home/pratham/Sarnav/omniverse/frontend && bun install
```

### 1c. MetaMask — the demo wallet
The funded demo account is the deployer:
- **Address:** `0x3a57622F51356fB925081A6D048BAA3eC35D9bAe` (ends in `…9bAe`)
- Holds **100M+ mock WETH** (for trading) and **~0.2 native ETH** (for gas).

In MetaMask:
1. **Add the network** (if missing): Networks → Add network →
   - Name: `Arbitrum Sepolia` · Chain ID: `421614` · Symbol: `ETH`
   - RPC: `https://sepolia-rollup.arbitrum.io/rpc` · Explorer: `https://sepolia.arbiscan.io`
2. **Import the deployer account:** account menu → *Add account or hardware wallet* →
   *Import account* → paste the key in `contracts-sol/.env` (`DEPLOYER_PRIVATE_KEY`).
   Confirm the imported address ends in **`…9bAe`**.
3. **Turn off the security scanner** (avoids false-positive "blocked" alerts on the
   local testnet contracts): Settings → *Security & privacy* → toggle **Security alerts /
   Blockaid OFF**. (Re-enable after the demo if you like.)

> ⚠️ The 100M is **mock WETH** (an ERC-20), *not* native gas ETH. Gas is paid from the
> ~0.2 native ETH. If you see "insufficient funds," you're on the **wrong MetaMask account**
> — switch to `…9bAe`.

---

## 2. Spin up a fresh market

This deploys a pristine market that starts at exactly **P = 0.50** and resets the indexer.

```bash
cd /home/pratham/Sarnav/omniverse
DEMO_OVERWRITE=1 ./fresh-demo.sh
```
It: redeploys contracts (~1 min, small gas), mints mock WETH, seeds liquidity **on the
pm-AMM invariant** (so 0.50 is real, no first-trade snap), rewrites
`frontend/public/demo-manifest.json`, and clears the Ponder cache.

Wait for `ONCHAIN EXECUTION COMPLETE & SUCCESSFUL` and `DEMO SETUP COMPLETE`.

---

## 3. Start the two services

Open **two terminals**:

```bash
# Terminal 1 — indexer (GraphQL on :42069)
cd /home/pratham/Sarnav/omniverse/indexer && bun run dev
# wait for the progress bar to reach 100% and "Server live at http://localhost:42069"

# Terminal 2 — frontend
cd /home/pratham/Sarnav/omniverse/frontend && bunx vite dev --port 5174 --host
# look at the terminal: it prints  ➜  Local:  http://localhost:5174/
```

> **Port note:** plain `bun run dev` serves on **:8080** in this environment (a sandbox
> config forces it). We use an explicit `--port 5174` because a *fresh* port guarantees the
> browser can't serve stale cached code. Either works — just use the URL the terminal prints.

---

## 4. Forward the ports (remote VS Code only)

If you're on a **remote** VS Code session (browser on your laptop, code on a VM), both
the frontend port **and** the indexer port must be forwarded:

1. VS Code → **PORTS** tab (bottom panel, next to TERMINAL).
2. Make sure **5174** (or 8080) **and `42069`** are both listed. If not: *Forward a Port* →
   type the number → Enter.
3. **Both are required:** the frontend port serves the UI; `42069` serves the trade history.
   If `42069` isn't forwarded, the page loads but the "Recent Activity" panel stays empty.

Quick check (open in the browser): `http://localhost:42069/graphql` should show Ponder's
GraphQL playground. If it can't connect, `42069` isn't forwarded.

---

## 5. Run the demo

1. **Open** the frontend URL (e.g. `http://localhost:5174/markets`).
2. **Pick the right market card.** The indexer lists *every* market the factory ever made,
   so you may see duplicates. Use the **`AI2030-DYN`** card showing **YES 0.50 / Volume $0.00**
   (the pristine one from step 2). Ignore older cards with non-zero volume.
3. **Connect** MetaMask. Confirm it's on **Arbitrum Sepolia** and the **`…9bAe`** account.
4. In the **Swap** box of the Execution Terminal:
   - Click the **"No"** toggle (top of the box). *(Buy **NO** raises the displayed market
     probability — that's the "attack drives it up the curve" story. Buy **YES** lowers it.)*
   - Enter **`2000`** → click **Buy NO** → confirm in MetaMask (fee ≈ **$0.02**).
   - First trade on a new market: MetaMask may first ask for a **one-time WETH approval** to
     the router — confirm it, then click **Buy NO** again to trade.
   - Repeat with **`4000`**, then **`6000`**.

   | Trade | Market probability |
   |-------|--------------------|
   | start | 0.50 |
   | Buy NO 2000 | ~0.63 |
   | Buy NO 4000 | ~0.76 |
   | Buy NO 6000 | ~0.91 |

   After each trade the top strip updates: probability climbs, λ\* moves, passive %
   (LP shield) rises.
5. **Proof dashboard:** open `/demo`. The **Recent Activity (Indexed)** panel lists your
   trades (each row → Arbiscan), the W-curve dot sits at the current probability, and the
   LP-shield bar shows the shielded %.
6. **Presentation mode:** append **`?present=true`** to any URL to hide debug panels.

### Optional
- **Borrow:** market page → Borrow tab (pre-filled 100 WETH / 1000 USDC).
- **Resolution sim:** `/simulate` (client-side only, no transactions).

---

## 6. Quick sanity checks (from a terminal)

```bash
# indexer answering, market indexed?
curl -s localhost:42069/graphql -X POST -H 'content-type: application/json' \
  -d '{"query":"{ markets(limit:1){ items{ symbol } } }"}'

# trades grow as you trade (side 2 = Buy NO)?
curl -s localhost:42069/graphql -X POST -H 'content-type: application/json' \
  -d '{"query":"{ trades(limit:5){ items{ side priceAfter } } }"}'

# frontend serving the current manifest?
curl -s localhost:5174/demo-manifest.json | head
```

To stop the services: `pkill -f "ponder"` and `pkill -f "vite"`.

---

## 7. Troubleshooting (every issue we actually hit)

**MetaMask "Insufficient funds."** You're on the wrong account. Switch to **`…9bAe`**
(the imported deployer). The 100M is mock WETH, not gas — gas comes from native ETH.

**Confirm button is greyed out / "Review alert" won't click.** MetaMask's Blockaid
scanner false-flagged the unknown testnet contract. Settings → *Security & privacy* →
turn **Security alerts OFF**, reopen the popup, confirm.

**Absurd gas fee (e.g. thousands of ETH).** Means MetaMask thinks the tx will revert and
shows a garbage fallback. Causes & fixes:
- You're running **stale cached JS** (old code with tight slippage). Hard-reload:
  **`Cmd+Shift+R`** on Mac (not `Ctrl`). If that fails, **quit the browser** (`Cmd+Q`) and
  reopen, or use a fresh port (`--port 5174`).
- The code is already fixed: preset/swap trades use `minOut=0` (these are intentional
  market-moving trades) and pin `maxFeePerGas` to `0.2 gwei`.

**Connect button does nothing.** Open the page in a **real browser with the MetaMask
extension** (not VS Code's Simple Browser). `window.ethereum` must exist on the page.

**Probability goes the wrong way.** **Buy NO** raises the displayed probability; **Buy YES**
lowers it (it's how this pool's reserves map to price). Use Buy NO for the upward climb.

**"Recent Activity / Live Flow" stays empty on `/demo`.** The indexer port `42069`
isn't reachable from the browser — forward it in VS Code (step 4). Verify with
`http://localhost:42069/graphql`.

**Two/many market cards.** The indexer lists all factory markets. Use the pristine
`AI2030-DYN` card (YES 0.50 / Volume $0.00) from your latest `fresh-demo.sh`.

**`forge`/deploy fails with "call to non-contract address" or "missing trie node".** The
RPC is non-archive or a lagged node. `run-demo-sepolia.sh` already pins
`--fork-block-number`; make sure all three env files point at the **Alchemy archive** URL.

**Indexer scanning from genesis (~100h).** `START_BLOCK` wasn't set. `fresh-demo.sh`
writes `indexer/.env.local` with `START_BLOCK = createdBlock − 10`; re-run it.

---

## 8. Live contract reference

Addresses change on every `fresh-demo.sh` run — the **source of truth** is always
`frontend/public/demo-manifest.json` (`poolWeth`, `router`, `conditionId`, etc.).
The on-chain math kernels (Rust/Stylus + Solidity mirror) are audited in
`docs/MATH_AUDIT.md`.
