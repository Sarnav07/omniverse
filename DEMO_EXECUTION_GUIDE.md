# Demo Execution Guide — "Attack the Pool"

A complete, self-serve runbook for the OMNIVERSE live demo on Arbitrum Sepolia.
Follow it top to bottom. The **Troubleshooting** section at the end covers the common
issues — read it if anything looks wrong.

> All paths below are **relative to the repo root**. `cd` into the project first.

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

## 1. One-time setup

### 1a. Prerequisites
- **Node 20+**, **Bun**, and **Foundry** (`forge`, `cast`) installed.
- A funded **Arbitrum Sepolia** account: a private key with a little **native ETH** for
  gas. Get testnet ETH from a faucet (e.g. the Alchemy / QuickNode Arbitrum Sepolia faucet).
  *(Mock WETH for trading is minted automatically — see step 2.)*
- An **archive RPC** endpoint for Arbitrum Sepolia. The public
  `https://sepolia-rollup.arbitrum.io/rpc` is **non-archive** and breaks `forge` deploys —
  use a free **Alchemy / Infura / QuickNode** key.

### 1b. Configure environment
Copy the example env files and fill them in:
```bash
cp .env.example .env                       # (if not already present)
cp contracts-sol/.env.example contracts-sol/.env
cp indexer/.env.example indexer/.env
cp frontend/.env.example frontend/.env
```
Set these values:

| File | Key | Value |
|------|-----|-------|
| `contracts-sol/.env` | `DEPLOYER_PRIVATE_KEY` | your funded Arbitrum Sepolia private key |
| `contracts-sol/.env` | `ARB_SEPOLIA_RPC` | your **archive** RPC URL |
| `.env` | `PONDER_RPC_URL` | same archive RPC URL |
| `indexer/.env` | `PONDER_RPC_URL_421614` | same archive RPC URL |
| `frontend/.env` | `VITE_PONDER_GRAPHQL_URL` | `http://localhost:42069` (no `/graphql` suffix) |
| `frontend/.env` | `VITE_RPC_URL` | the archive RPC URL (browser-side reads) |

> Use the **same archive RPC** in all three backend files. Never commit real keys —
> the `.env` files are gitignored.

### 1c. Install dependencies
```bash
cd indexer  && bun install && cd ..
cd frontend && bun install && cd ..
```

### 1d. MetaMask
The demo trades from your **deployer account** (the `DEPLOYER_PRIVATE_KEY` above). After
you run step 2, find its address from the manifest (`demoAccount` in
`frontend/public/demo-manifest.json`) or with:
```bash
cast wallet address --private-key <your_deployer_key>
```
Then in MetaMask:
1. **Add the network** (if missing): Chain ID `421614`, symbol `ETH`,
   RPC `https://sepolia-rollup.arbitrum.io/rpc`, explorer `https://sepolia.arbiscan.io`.
2. **Import the deployer account:** account menu → *Add account or hardware wallet* →
   *Import account* → paste your `DEPLOYER_PRIVATE_KEY`. Confirm the address matches
   `demoAccount` in the manifest.
3. **Turn off the security scanner** to avoid false-positive "blocked" alerts on the local
   testnet contracts: Settings → *Security & privacy* → toggle **Security alerts / Blockaid
   OFF**. (Re-enable afterward if you like.)

> ⚠️ The minted **mock WETH** is an ERC-20 used for trading — *not* gas. Gas is paid from
> your account's **native ETH**. If MetaMask says "insufficient funds," you're on the wrong
> account or it's out of native ETH.

---

## 2. Spin up a fresh market

Deploys a pristine market that starts at exactly **P = 0.50** and resets the indexer:
```bash
DEMO_OVERWRITE=1 ./fresh-demo.sh
```
It: redeploys contracts (~1 min, small gas), **mints 10M mock WETH to the deployer**, seeds
liquidity **on the pm-AMM invariant** (so 0.50 is real, no first-trade snap), rewrites
`frontend/public/demo-manifest.json`, and clears the Ponder cache.

Wait for `ONCHAIN EXECUTION COMPLETE & SUCCESSFUL` and `DEMO SETUP COMPLETE`.

---

## 3. Start the two services

Open **two terminals** (from the repo root):
```bash
# Terminal 1 — indexer (GraphQL on :42069)
cd indexer && bun run dev
# wait for the progress bar to reach 100% and "Server live at http://localhost:42069"

# Terminal 2 — frontend
cd frontend && bunx vite dev --port 5174 --host
# the terminal prints  ➜  Local:  http://localhost:5174/
```

> **Port note:** plain `bun run dev` in `frontend/` may serve on **:8080** (a sandbox config
> can force it). We pass an explicit `--port 5174` because a *fresh* port guarantees the
> browser can't serve stale cached code. Either is fine — use the URL the terminal prints.

---

## 4. Forward the ports (remote dev only)

If your browser runs on a different machine than the code (e.g. remote VS Code / SSH), both
the frontend port **and** the indexer port must be forwarded to your local machine:

1. VS Code → **PORTS** tab (bottom panel, next to TERMINAL).
2. Ensure **5174** (or 8080) **and `42069`** are both listed. If not: *Forward a Port* →
   type the number → Enter.
3. **Both are required:** the frontend port serves the UI; `42069` serves the trade history.
   If `42069` isn't forwarded, the page loads but the "Recent Activity" panel stays empty.

Quick check (in the browser): `http://localhost:42069/graphql` should show Ponder's GraphQL
playground. If it can't connect, `42069` isn't forwarded.

---

## 5. Run the demo

1. **Open** the frontend URL (e.g. `http://localhost:5174/markets`).
2. **Pick the right market card.** The indexer lists *every* market the factory has made, so
   you may see duplicates. Use the **`AI2030-DYN`** card showing **YES 0.50 / Volume $0.00**
   (the pristine one from step 2). Ignore older cards with non-zero volume.
3. **Connect** MetaMask. Confirm it's on **Arbitrum Sepolia** and the **deployer** account.
4. In the **Swap** box of the Execution Terminal:
   - Click the **"No"** toggle (top of the box). *(Buy **NO** raises the displayed market
     probability — that's the "attack drives it up the curve" story. Buy **YES** lowers it.)*
   - Enter **`2000`** → click **Buy NO** → confirm in MetaMask (fee ≈ a fraction of a cent).
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
- **Borrow:** market page → Borrow tab (pre-filled collateral / debt).
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

## 7. Troubleshooting

**MetaMask "Insufficient funds."** You're on the wrong account, or it's out of native ETH.
Switch to the imported deployer account; top up its native ETH from a faucet. The mock WETH
balance is *not* gas.

**Confirm button is greyed out / "Review alert" won't click.** MetaMask's Blockaid scanner
false-flagged the unknown testnet contract. Settings → *Security & privacy* → turn
**Security alerts OFF**, reopen the popup, confirm.

**Absurd gas fee (e.g. thousands of ETH).** MetaMask thinks the tx will revert and shows a
garbage fallback. Usual cause: **stale cached JS**. Hard-reload (**`Cmd+Shift+R`** on macOS,
**`Ctrl+Shift+R`** on Windows/Linux); if that fails, quit the browser and reopen, or use a
fresh port (`--port 5174`). The code already uses `minOut=0` for these intentional
market-moving trades and pins `maxFeePerGas` to `0.2 gwei`.

**Connect button does nothing.** Open the page in a **real browser with the MetaMask
extension** (not an embedded preview). `window.ethereum` must exist on the page.

**Probability goes the wrong way.** **Buy NO** raises the displayed probability; **Buy YES**
lowers it (it's how this pool's reserves map to price). Use Buy NO for the upward climb.

**"Recent Activity / Live Flow" stays empty on `/demo`.** The indexer port `42069` isn't
reachable from the browser — forward it (step 4). Verify with `http://localhost:42069/graphql`.

**Two/many market cards.** The indexer lists all factory markets. Use the pristine
`AI2030-DYN` card (YES 0.50 / Volume $0.00) from your latest `fresh-demo.sh`.

**`forge`/deploy fails with "call to non-contract address" or "missing trie node".** The
RPC is non-archive or a lagged node. `run-demo-sepolia.sh` already pins
`--fork-block-number`; make sure all three env files point at an **archive** RPC.

**Indexer scanning from genesis (very slow).** `START_BLOCK` wasn't set. `fresh-demo.sh`
writes `indexer/.env.local` with `START_BLOCK = createdBlock − 10`; re-run it.

---

## 8. Contract reference

Addresses change on every `fresh-demo.sh` run — the **source of truth** is always
`frontend/public/demo-manifest.json` (`poolWeth`, `router`, `conditionId`, `demoAccount`,
etc.). The on-chain math kernels (Rust/Stylus + Solidity mirror) are audited in
`docs/MATH_AUDIT.md`.
