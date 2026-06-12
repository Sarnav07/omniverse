# Demo Execution Guide — "Attack the Pool"

## Understanding the Demo Endpoint

**URL**: `http://localhost:8080/markets/{conditionId}`

The `/markets/demo` route **doesn't exist** as a hardcoded path. Instead, the demo activates when you navigate to `/markets/{conditionId}` where `conditionId` dynamically matches the value in your freshly generated `demo-manifest.json`.

### How Demo Mode Detection Works

```typescript
// From markets.$id.tsx
const isDemoMarket =
  !!manifest &&
  (id.toLowerCase() === manifest.conditionId.toLowerCase() ||
   poolWeth.toLowerCase() === manifest.poolWeth.toLowerCase() ||
   poolUsdc.toLowerCase() === manifest.poolUsdc.toLowerCase());
```

**Demo Market Example** (Values change every time you run `fresh-demo.sh`):
- Condition ID: *(See `demo-manifest.json`)*
- Question: "Will AI surpass human intelligence by 2030? (Dynamic Lambda Live Demo) #..."
- Symbol: `AI2030-DYN`
- Pool (WETH): *(See `poolWeth` in `demo-manifest.json`)*

When `isDemoMarket = true`, the app shows:
- **AttackModeStrip** — Live metrics ticker at top
- **AttackPresets** — One-click trade buttons (Probe/Whale/Kill Shot)
- **PreDemoReadinessPanel** — Pre-flight checklist
- **BorrowDemoTab** — Pre-filled lending demo

---

## Prerequisites

### 1. Initialize Fresh Demo Environment
Before running the presentation, always spin up a pristine market to ensure the dynamic lambda curve and liquidity stats are reset to their baseline.
```bash
# From the root directory, run the initialization script
./fresh-demo.sh

# This script will:
# 1. Deploy new contracts with fresh parameters
# 2. Mint 10,000,000 Mock WETH to the Deployer
# 3. Synchronize the demo-manifest.json
# 4. Wipe and restart the Ponder indexer cache
```

### 2. Wallet Setup
- **Network**: Arbitrum Sepolia (Chain ID: 421614)
- **Required Balance**: ≥12,000 Mock WETH (to cover all 3 demo trades)
- **Get Testnet WETH**: 
  - The `fresh-demo.sh` script automatically mints **10,000,000 Mock WETH** to the `DEPLOYER_PRIVATE_KEY` specified in your `contracts-sol/.env`.
  - To access these funds, simply **import the DEPLOYER_PRIVATE_KEY into MetaMask**. You do not need to bridge or wrap any real Sepolia ETH (other than a tiny amount for gas).

### 3. Deployment Check
```bash
# Verify demo manifest is accessible
curl http://localhost:8080/demo-manifest.json

# Should return JSON with conditionId, poolWeth, etc.
```

### 3. Ponder Indexer Running
```bash
# Check indexer status
curl http://localhost:42069/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ markets(limit: 1) { items { symbol } } }"}'

# Should return market data
```

---

## Demo Execution — 6 Acts

### **Act 1: Navigate to Demo Market** (30 seconds)

**ACTION**:
1. Open browser to `http://localhost:8080/markets`
2. Find the newly created market with symbol `AI2030-DYN`
3. Click the market card

**EXPECTED**:
- URL becomes `/markets/{your_dynamic_condition_id}`
- **AttackModeStrip** appears at top showing:
  - Live P(YES), λ*, active%, passive%, ell, L_t
  - Math kernel badge: "Stylus kernel" (green if matches manifest)
  - Pool address link to Arbiscan
- **PreDemoReadinessPanel** shows 8 checks

**VERIFY**:
```
✓ Demo manifest — AI2030-DYN
✓ Network — Arbitrum Sepolia
✓ Wallet — 0x...
✓ WETH balance — 12,000+ Mock WETH
⚠ WETH allowance — Approve Router for max [APPROVE MAX button]
✓ Pool state — P=0.50
✓ Ponder indexer — Market indexed
✓ Ponder START_BLOCK — Pass
```

**ACTION IF ALLOWANCE WARNING**:
- Click "APPROVE MAX" button
- MetaMask opens → Confirm approval
- Wait for confirmation
- Check refreshes to ✓ WETH allowance

---

### **Act 2: Execute Probe Trade** (1 minute)

**ACTION**:
1. Scroll to Execution Terminal
2. Ensure **Swap** tab is active
3. Click **"PROBE · 2k"** preset button

**EXPECTED**:
- Amount field auto-fills: `2000` WETH
- Receive estimate shows: ~4000 YES shares (depends on current price)
- Button shows: "Buy YES"

**ACTION**:
4. Click **"BUY YES"**
5. MetaMask opens → Review transaction → Confirm
6. Wait for "Confirmed ✓" message

**VERIFY**:
- Toast notification: "Transaction confirmed"
- Arbiscan link appears below button
- **AttackModeStrip updates**:
  - P(YES) increases (e.g., 0.50 → 0.55)
  - λ* decreases slightly
  - Active% may change
- Latest tx hash appears in strip (clickable Arbiscan link)

**WHAT'S HAPPENING ON-CHAIN**:
```
Router.buyYes(pool, conditionId, 2000e18, minOut)
  → Pool.buyYes(noIn=2000e18, minOut)
  → OmniverseMath.solveSwap() [Stylus WASM]
  → emit OmniverseTrade(marketId, trader, side=0, size, priceWad, lambdaWad, ...)
```

---

### **Act 3: Execute Whale Trade** (1 minute)

**ACTION**:
1. Click **"WHALE · 4k"** preset button
2. Amount auto-fills: `4000` WETH
3. Click **"BUY YES"**
4. Confirm in MetaMask
5. Wait for confirmation

**EXPECTED**:
- P(YES) jumps further (e.g., 0.55 → 0.75)
- λ* drops more significantly
- Passive% increases (LPs shield more reserves)
- **2nd tx hash appears in AttackModeStrip**

**TIMING**: Each trade takes ~10-15 seconds (Arbitrum Sepolia block time)

---

### **Act 4: Execute Kill Shot Trade** (1 minute)

**ACTION**:
1. Click **"KILL SHOT · 6k"** preset button
2. Amount auto-fills: `6000` WETH
3. Click **"BUY YES"**
4. Confirm in MetaMask
5. Wait for confirmation

**EXPECTED**:
- P(YES) reaches ~0.90-0.95
- Passive% > 80% (most liquidity now shielded)
- Active reserves (ell) significantly reduced
- **3rd tx hash in AttackModeStrip**

**TOTAL COST**: 12,000 WETH spent

---

### **Act 5: Proof Dashboard** (2 minutes)

**ACTION**:
1. Navigate to `/demo` route
2. Observe the proof panel

**EXPECTED**:
- **Attack Transcript** shows 3 rows:
  ```
  Block: 275880XXX | Tx: 0xabc...def | 2,000 WETH | P(YES): 0.55 | λ*: 0.XXX
  Block: 275880XXX | Tx: 0x123...456 | 4,000 WETH | P(YES): 0.75 | λ*: 0.XXX
  Block: 275880XXX | Tx: 0x789...012 | 6,000 WETH | P(YES): 0.93 | λ*: 0.XXX
  ```
  Each tx hash is clickable → opens Arbiscan
  
- **W-Curve Live**:
  - SVG curve shows λ*(p) function
  - Animated dot at current P(YES) position (~0.93)
  - Current λ* value in corner

- **LP Shield Panel**:
  - Stacked bar: Active (white, bright) | Passive (white, dim)
  - Label: "82% shielded" (or whatever passive% is)

- **Macro Dashboard**:
  - Live lambda: matches contract read
  - Shielded %: from reserves
  - Price: live from contract

**VERIFY DATA SOURCES**:
- All trade tx hashes: `DataSourceBadge source="indexed"` (from Ponder)
- Current price: `DataSourceBadge source="live"` (from wagmi)
- Lambda: `DataSourceBadge source="live"`

**ACTION**:
3. Click any tx hash in transcript
4. Arbiscan opens showing the real transaction

---

### **Act 6: Borrow Flow** (2 minutes)

**ACTION**:
1. Navigate back to `/markets/{conditionId}`
2. Click **"Borrow"** tab in Execution Terminal

**EXPECTED**:
- Collateral input pre-filled: `100` WETH (from manifest `lendingCollateral`)
- Borrow input pre-filled: `1000` USDC (from manifest `lendingDebt`)
- LTV bar shows: 1000/100 = 10% (conservative)
- Health factor formula explanation

**ACTION**:
3. Click **"Approve WETH"** (if needed)
4. MetaMask opens → Confirm approval
5. Click **"Execute Borrow"**
6. MetaMask opens → Confirm borrow transaction
7. Wait for confirmation

**VERIFY**:
8. Click **"Manage"** tab
9. Observe live reads:
   - Collateral: 100.00 WETH (green, from `collateralOf()`)
   - Debt: 1000 USDC (white, from `debtOf()`)
   - Health: ∞ or very high (green, from `healthFactor()`)

**WHAT'S HAPPENING**:
```
Router.executeBorrow(lending, conditionId, 100e18, 1000e18)
  → MultiverseLending.deposit(100e18 WETH)
  → Lending splits WETH into YES/NO shares via CTF
  → Lending.borrow(1000e18 USDC)
  → User receives 1000 USDC, position tracked on-chain
```

---

### **Act 7 (Optional): Resolution Simulation** (1 minute)

**ACTION**:
1. Navigate to `/simulate`

**EXPECTED**:
- **SimulationBanner** at top:
  ```
  🟠 SIMULATION · Client-side only · No on-chain transactions
  ```
  "Resolving the market live would destroy the demo pool. This shows the mathematical outcome."

- Two side-by-side panels:
  - **Traditional Lending** (TradFi-style):
    - Starts: 5000 collateral, 4000 debt, 1.25 health
    - After "crash": Health drops, liquidation triggers, position zeroed
  
  - **Omniverse (Multiverse Lending)**:
    - Starts: 5000 collateral, 5000 debt (0% LTV thanks to conditional splits)
    - After "crash": Market resolves, position settles to zero automatically, no liquidation

**NOTE**: This is **pure client-side** — no on-chain transactions occur. It's an educational visualization.

---

## Presentation Mode

To hide debug panels for screen sharing:

**URL**: Add `?present=true` to any route
- Example: `http://localhost:8080/markets/{conditionId}?present=true`

**HIDES**:
- PreDemoReadinessPanel
- DataSourceBadge debug labels (except critical ones)

**KEEPS**:
- AttackModeStrip
- Execution Terminal
- SimulationBanner (always visible)

---

## Troubleshooting

### ❌ "Pool is frozen"
**Cause**: Too close to expiry (within `FREEZE_WINDOW` = 30 minutes)  
**Fix**: Deploy new pool with later expiry via `run-demo-sepolia.sh`

### ❌ "Price moved before your trade landed"
**Cause**: Someone else traded between your tx submission and confirmation  
**Fix**: Reduce trade size or increase slippage tolerance (currently 5%)

### ❌ AttackModeStrip not showing
**Cause**: `isDemoMarket = false` — conditionId doesn't match manifest  
**Fix**: Check `/demo-manifest.json` and navigate to correct conditionId

### ❌ Attack Transcript empty
**Cause**: Ponder indexer lagging or no trades yet  
**Fix**: Wait 5-10 seconds, Ponder polls every block. Check indexer logs.

### ❌ MetaMask shows "Unable to estimate gas"
**Cause**: Transaction will revert (frozen pool, insufficient allowance)  
**Fix**: Check readiness panel, approve WETH, verify pool not frozen

### ❌ All metrics show "⋯" (skeleton)
**Cause**: RPC slow or rate limited  
**Fix**: Wait for `refetchInterval: 2000` retry, check RPC endpoint

---

## Technical Flow Summary

```
┌─────────────────────────────────────────────────────────┐
│  USER ACTION                                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (React + wagmi)                               │
│  • AttackPresets.execute(preset)                        │
│  • useAttackPresets() computes minOut                   │
│  • TxState: idle → wallet → pending → confirmed        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  METAMASK (User confirms)                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  ARBITRUM SEPOLIA CONTRACTS                             │
│  1. Router.buyYes(pool, conditionId, amount, minOut)    │
│  2. Pool.buyYes(noIn, minOut)                           │
│  3. OmniverseMath.solveSwap() [Stylus WASM]            │
│  4. emit OmniverseTrade(...)                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  PONDER INDEXER                                         │
│  • Listens for OmniverseTrade event                     │
│  • Indexes: txHash, block, side, size, priceAfter      │
│  • Exposes via GraphQL                                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Update)                                      │
│  • useDemoTrades() refetches via urql                   │
│  • usePoolPrice() polls contract (2s interval)          │
│  • UI updates: AttackModeStrip, AttackTranscript, etc. │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start Checklist

```
[ ] Initialize: Ran `./fresh-demo.sh` to generate pristine market
[ ] Network: Arbitrum Sepolia (421614)
[ ] Wallet: Connected with Deployer key (≥12,000 Mock WETH)
[ ] Manifest: http://localhost:8080/demo-manifest.json loads
[ ] Indexer: Ponder running on :42069
[ ] Navigate to: `/markets/{conditionId}` (Get this from the manifest or click the market in the UI)
[ ] Verify: AttackModeStrip visible at top
[ ] Readiness: All 8 checks pass (approve WETH if needed)
[ ] Execute: Probe → Whale → Kill Shot
[ ] Verify: /demo shows 3 real tx hashes
[ ] Bonus: Execute borrow, check Manage tab
```

---

## Files Involved

**Frontend**:
- `frontend/src/routes/markets.$id.tsx` — Main demo terminal
- `frontend/src/routes/demo.tsx` — Proof dashboard
- `frontend/src/components/execution-terminal.tsx` — Swap/Borrow/Manage tabs
- `frontend/src/components/attack-presets.tsx` — Preset buttons
- `frontend/src/components/attack-transcript.tsx` — Trade list
- `frontend/src/components/pre-demo-readiness-panel.tsx` — Checklist
- `frontend/src/hooks/useDemoManifest.ts` — Loads manifest
- `frontend/src/hooks/useDemoTrades.ts` — Queries Ponder
- `frontend/public/demo-manifest.json` — Configuration

**Contracts** (Arbitrum Sepolia):
- `OmniverseRouter` @ `0xF0AF8C84655a3E25Cf26Cb88E70E765C157515B2`
- `PmAmmPool (WETH)` @ `0x0B722fcd25d0908E33ca2452654698976e7a85eD`
- `MultiverseLending` @ `0x63878d16bAe4DBb7712Af8387FaC206Aa7C3145E`
- `OmniverseMath (Stylus)` @ `0x3F280606ceA810947e43e5DDB7FD2b5A18301dBa`

**Indexer**:
- Ponder: `http://localhost:42069/graphql`
- Schema: Markets, Trades, PoolState

---

## Success Criteria

**Demo is successful if**:
✓ All 3 trades execute and confirm on-chain  
✓ AttackModeStrip shows live updates within 2 seconds  
✓ Attack Transcript displays 3 real tx hashes  
✓ Each tx hash opens correct Arbiscan transaction  
✓ W-curve dot animates to ~P(YES)=0.93  
✓ LP Shield shows >80% passive  
✓ Borrow executes and Manage tab shows live health factor  
✓ Zero client-side mocked data (all from contracts/indexer)
