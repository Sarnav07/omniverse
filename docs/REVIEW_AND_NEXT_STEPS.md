# OMNIVERSE — Code Review & 2-Person Next-Steps Plan

> Produced by a 3-agent review team (Stylus/Rust auditor · Solidity auditor · planning architect),
> synthesized by the lead. Covers: what we're building, what's done, **what to fix in the existing
> work**, and **how to split the remaining work across two people**.
>
> Source of truth for the product vision stays `IMPLEMENTATION_PLAN.md` + `CONTEXT.md`.
> This file is the actionable "fix-then-build" layer on top of them.

---

## 1. What we're building (one screen)

OMNIVERSE is a prediction-market DeFi protocol on **Arbitrum Stylus** with three fused ideas:

1. **pm-AMM** — prices binary YES/NO tokens as live probabilities via a Gaussian invariant
   `(y−x)·Φ((y−x)/L) + L·φ((y−x)/L) − y = 0`, so price `P = Φ((y−x)/L)` is closed-form (no oracle).
2. **PA-AMM λ\*** — each block splits reserves into active/passive; a **dynamic** optimal activeness
   `λ*(P)` (our novel derivation) auto-shrinks toward 0 near resolution to protect LPs. Combined with
   pm-AMM's `L_t = L₀·√(T−t)` decay, LP losses are bounded.
3. **Multiverse Lending** — borrow *same-outcome* debt against *same-outcome* collateral; on resolution
   both legs evaporate together → **settles, never liquidates**.

The headline tech is a **Rust→WASM (Stylus) fixed-point math kernel** computing the Gaussian functions and
the swap solver 10–100× cheaper than Solidity.

**Honesty note for the pitch (from `GAUSSIAN_LAMBDA_STAR.md`):** claim the *exact AR(1) z-dynamics* and the
*v(z)/φ(z) identities* as **proven**; frame the specific `γ_G` weighting and the λ\*(P) numbers as a **novel
construction, not a theorem**. The λ\*(P) curve is **W-shaped** (peaks at P≈0.2/0.8, dip at 0.5), not a dome.

---

## 2. Where things stand

**✅ Done (by the previous teammate)**
- `contracts-stylus/` Rust math kernel: `phi`, `Phi`, `PhiInv`, `solveSwap`, `poolValue`, `lambdaStarGaussian`.
  **37/37 host tests pass; `cargo build --release` clean; verified float-free** (zero real `f32/f64` ops).
- `contracts-sol/` Foundry project: `PmAmmPool.sol` scaffold (active/passive accounting, buyYes/buyNo,
  dynamic/static λ rebalance, uint128 input guards), `IOmniverseMath.sol` (matches Stylus selectors),
  `MockOmniverseMath`, **6/6 Foundry tests pass**.

**❌ Not started**
- Real on-chain Stylus activation (`cargo stylus check`/`deploy` — see §5, **cargo-stylus isn't installed**).
- Real token custody in the pool; conditional YES/NO tokens; `MultiverseLending`; `MarketFactory`;
  `Resolver`; Chainlink; Solidity `solstat` fallback kernel.
- Frontend (Next.js), Ponder indexer, deploy/seed/faucet/reset scripts, the 3 demos, hardening + pitch.

---

## 3. FIX FIRST — defects in the existing work

Severity legend: **🔴 Critical/High** (correctness, will break a demo) · **🟠 Medium** (robustness)
· **🟡 Low/Cleanup**. Every item has file:line and a concrete fix.

### 3.1 Stylus math kernel (Rust)

**🔴 H-1 — `solveSwap` upper bracket does not contain the root → panics on ~4% of legit large sells.**
`contracts-stylus/src/math/solver.rs:36` sets `hi = x1 + y0 + ell`. On realistic **on-curve large sells**
(x collapses toward 0, y grows), the true root `y1` can exceed `hi` by up to ~3.5×. Newton tries to climb
above `hi`, the bisection guard (`solver.rs:104`) clamps it back into `[0, hi]` where `f > 0` everywhere, so
`|f| < EPSILON` is never reached → `panic!` at `solver.rs:112`. **Measured panic rate: 4.13% (2065/50000)**
on realistic on-curve sells. (Buys are safe — the root shrinks.)
**Fix:** widen the bracket to `hi = x1 + 5*ell` (max normalized root distance `(y−x)/ell ≈ 3.57` over the
domain; 4·ell is empirically safe, 5·ell adds margin). With `x1 + 5*ell`, panic rate → 0/50000.
**Add a regression test:** an on-curve large-sell case (all current solver tests are small buys/balanced —
that gap is exactly why this shipped).

**🟠 M-1 — `MAX_ITER=40` + absolute `EPSILON=1e4` wei can spuriously panic at large reserves.**
`solver.rs:14,17`. If Newton degrades to the bisection fallback at uint128-scale reserves, 40 iterations only
shrink the bracket by `2^40 ≈ 1.1e12`; reaching `|f| < 1e4` from `hi ~ 3.4e38` needs ~115 bisection steps.
Quadratic Newton convergence usually avoids this, but combined with H-1's degenerate bracket it can bite.
**Fix:** bump `MAX_ITER` to ~80–100 (cheap — it's a view call) **and** also accept convergence when the
bracket width `|hi − lo| <= 1`.

**🟠 M-2 — `lambdaStarGaussian` can overflow-panic on unbounded `gamma_prime`.**
`contracts-stylus/src/math/lambda.rs:82` computes `wad_div_u(gamma_prime, two_v_phi)` = `gamma_prime*WAD`;
for `gamma_prime > U256::MAX/1e18 (~1.16e59)` the multiply overflows. Governance value is ~2e18 so real risk
is low, but it's a public ABI entry. **Fix:** `assert!(gamma_prime <= 1e24)` (or similar) for a clean revert.

**🟡 L-1 — Wrong comment + reachable `f_prime == 0`.** `solver.rs:85` says "if f_prime is zero (shouldn't
happen)" — but `big_phi` saturates to exactly `WAD` for `z ≥ 8` (`gaussian.rs:127-129`), so
`f_prime = Φ − WAD = 0` **is** reachable (on the same large-|z| sells as H-1). The bisection fallback handles
it, but only within a correct bracket — so it's covered by the H-1 fix. Correct the comment.

**🟡 L-2 — Opaque revert messages.** `wad.rs:69-76` `u256_to_i256`/`i256_to_u256` use bare `.unwrap()` →
"called Option::unwrap on None" on the public boundary. Inputs are uint128-bounded so unreachable in practice;
optionally replace with `assert!`+message. Low priority.

**🟡 CLEANUP-1 — Remove stream-of-consciousness comments.** `gaussian.rs:296-302` `halley_step` contains
left-in thinking ("Wait, the standard Halley…", "Let me verify…"). The math is **correct** (verified: standard
Halley for CDF inversion, threshold `error_abs < 1e6` wei = 1e-12 is fine). Just delete the rambling.

**Overflow review: clean.** With pool inputs bounded to uint128, all intermediates (`diff*Φ`, `ell*φ`,
`f_val*WAD`, `z²`, the `exp2` negative path) fit well inside I256/U256. The only unbounded input is
`gamma_prime` (M-2).

### 3.2 Solidity pool (`PmAmmPool.sol`)

**🔴 H-2 — `L_t` unit/scale bug: first rebalance silently rescales the price curve ~800×.**
`PmAmmPool.sol:152-155` `_liquidityAt` returns `L0 * _sqrt(timeRemaining)` with `timeRemaining` in **raw
seconds** (T=now+30d → 2,592,000, `_sqrt ≈ 1609`), so `ellTotal = L0*1609`. But the **constructor**
(`:72`) sets `ellActive = _floorEll(l0) = L0` with **no** sqrt. On the first new-block rebalance, `ell` jumps
by `~1609·λ` (≈800× at λ=0.5). Since `z = (y−x)·WAD/ell`, the first trade after deploy prices off a curve
~800× flatter than the constructor's. **The test suite masks it** — `testDynamicRebalanceCallsLambdaAndPartitions`
never asserts `ellActive`.
**Fix:** use the dimensionless time fraction the spec intends, `L_t = L0·√((T−t)/(T−t₀))`, so constructor and
rebalance agree (both = L0 at t₀). Store `D = T − deployTime` (immutable); compute
`_liquidityAt(ts) = L0 * sqrt(((T−ts)*WAD)/D) / 1e9` (sqrt of a WAD-scaled fraction, then ÷√WAD=1e9 back to
WAD). **Add an `ellActive` assertion to the rebalance test.**

**🟠 M-3 — No freeze window before T.** Spec wants swaps frozen in the final blocks before expiry; code only
reverts at/after T (`_rebalance :123`). As `t→T`, `L_t→0` ⇒ `z` explodes ⇒ price pins to 0/1 and tiny
imbalances swing it wildly (ell also floors at `MIN_ELL`, distorting further). **Fix:** add a `freezeWindow`
immutable; revert with a new `Frozen()` error when `block.timestamp >= T − freezeWindow` in buyYes/buyNo
(keep `currentPrice` live for redemption reads).

**🟠 M-4 — No post-swap invariant assertion.** buyYes/buyNo trust `solveSwap`'s output with only a
monotonicity check (`y1<=yActive` / `x1<=xActive`, `:84/:103`). Spec requires the invariant to be
non-decreasing (`φ(R_after) ≥ φ(R_before)` / `poolValue` non-decreasing). A buggy/malicious kernel returning
an off-curve `y1` leaks value undetected. **Fix:** snapshot `poolValue(z_before)`, recompute `z_after` from
the new reserves, `require(poolValue(z_after) >= poolValue(z_before))`. (The kernel already exposes
`poolValue()`.)

**🟠 M-5 — No slippage/`minOut` (and no deadline).** `buyYes(noIn)`/`buyNo(yesIn)` (`:76,:95`) take no
`minOut` — front-runnable/MEV-exposed once real tokens land. **Fix:** add `uint256 minOut` (+ optional
`deadline`); `if (out < minOut) revert Slippage();`.

**🟠 M-6 — Reentrancy guard + custody (deferred but flag now).** Scaffold has no real transfers (acknowledged
in the header). When ERC-20 transfers are added, put `nonReentrant` on buyYes/buyNo/rebalance and keep CEI
ordering (state is already updated before the external `Phi` call — good; transfers must come after). Not
exploitable today.

**🟡 L-3 — Two cross-contract calls per trade.** buyYes/buyNo do `solveSwap` **and** `currentPrice()` (an
extra staticcall to `Phi`) only to populate the event's `priceWad`. Consider dropping `currentPrice` from the
hot path (derive price from the reserves you already have) to save a full external call per swap.

**🟡 L-4 — Redundant double-floor.** `currentPrice` `:117` re-floors `ellActive`, which is already floored on
store (`:137/:72`). Harmless; tidy if touching the file.

**✅ Confirmed NOT bugs (don't "fix" these):**
- **buyNo symmetry** (`:102`, `solveSwap(y1, xActive, ell)`): the invariant is symmetric `f(x,y)=f(y,x)`,
  so solving the swapped pair yields the new NO reserve. Mathematically valid.
- **Rebalance conservation** (`:135-144`): `nextXActive=(xTotal*λ)/WAD` floor + `xPassive=xTotal−nextXActive`
  ⇒ `xActive+xPassive == xTotal` exactly; truncated dust lands in passive. No value created/destroyed.
- **`currentPrice` post-expiry**: it's `view`, never calls `_rebalance`, so reads/redemption work after T.

### 3.3 Documentation inconsistencies (fix before they cause integration pain)

- **`OmniverseTrade` event schema is defined three different ways.** `CONTEXT.md` has a 6-field version
  (side `0=buyYes,1=buyNo,2=sellYes,3=sellNo`); `IMPLEMENTATION_PLAN.md` has a 9-field version (side
  `0=buyYes,1=sellYes,2=buyNo,3=sellNo` — different!); the actual `PmAmmPool.sol:32` emits a **7-field** one.
  **Lock the 9-field plan version day-0** — the indexer and charts depend on it. This is a hard day-0 freeze.
- **`walkthrough.md:62-66` size claim is misleading.** It says "WASM 115KB, within 128KB limit." The binding
  Stylus gate is **24KB compressed** (`IMPLEMENTATION_PLAN.md` reports the real number: **20.5KB compressed**).
  Re-word so nobody pitches the wrong limit.

### 3.4 Priority-ordered fix checklist

```
[x] H-1  solver.rs: hi = x1 + 5*ell  + on-curve large-sell test        ← DONE (cargo test 38/38)
[x] H-2  PmAmmPool L_t: duration immutable, L_t = L0·√((T−t)/D) in WAD  ← DONE (forge test 7/7)
[x] M-1  solver.rs: MAX_ITER→100, bracket-collapse exit (|hi−lo|<=1 → return hi)   ← DONE (cargo 40/40)
[x] M-2  lambda.rs: assert gamma_prime <= 1e24                                      ← DONE
[x] M-3  PmAmmPool: FREEZE_WINDOW (1h) + Frozen() revert on buyYes/buyNo            ← DONE (forge 11/11)
[x] M-4  PmAmmPool: post-swap invariant-RESIDUAL assertion |f|<=1e9 (InvariantViolation) ← DONE*
[x] M-5  PmAmmPool: minOut + Slippage() on buyYes/buyNo                             ← DONE

  *M-4 note: implemented the invariant-RESIDUAL check, NOT the poolValue check the §3.2 text suggested —
   poolValue v(z) is U-shaped (min at z=0) so it is non-monotonic and would reject valid swaps that move
   price toward 0.5. The residual |f(x,y,ℓ)|<=ε is the sound, spec-aligned guard. Required upgrading
   MockOmniverseMath to return on-curve values (so the check is testable). `deadline` from M-5 was not
   added (out of scope for the demo); add it with real token custody. Re-validate INVARIANT_EPS=1e9
   against the real kernel once deployed — recomputation flooring may need a slightly looser tolerance.
[x] DOC  OmniverseTrade frozen to 9-field in CONTEXT.md + contract (buyNo side=2); walkthrough size claim fixed
[x] M-6  nonReentrant on buyYes/buyNo/rebalance (groundwork; not exploitable until token transfers land)
[x] L-1..L-4, CLEANUP-1  done: L-1 (solver comment) L-2 (wad.rs expect msgs) L-3 (single Phi/swap, currentPrice off hot path) L-4 (no double-floor) CLEANUP-1 (halley comments)
[~] GAP  cargo-stylus v0.10.7 installed; `cargo stylus check` → 20.7 KB, float-free PASS; ACTIVATION still pending a Nitro/Sepolia RPC (ConnectionRefused at :8547) — see §5
```

All §3 review items are now resolved (the only residual is running `cargo stylus check`'s **activation** step against a live RPC node, which needs the Nitro/Sepolia endpoint from §4.3-M0).

---

## 4. The next work — split across **two people**

### 4.1 The split & why

**Person 1 — "Chain & Core"** (owns the on-chain critical path + math integrity)
> Stylus activation, `PmAmmPool` real token custody, conditional YES/NO tokens, `MultiverseLending`,
> `MarketFactory`, `Resolver`, Chainlink, the Solidity `solstat` fallback kernel, deploy/seed/faucet/reset
> scripts, **all Foundry tests**, and keeping the math kernel honest (canonical λ\* reference numbers).

**Person 2 — "Surface & Story"** (owns everything that consumes the chain)
> Next.js app (Trade/LP/Lending panels), all **3 demos** incl. the offline TS math (`lambdaMath.ts`),
> Ponder indexer, wallet/RPC failover, hardening, and the pitch deck + backup video.

**Rationale (one line):** the pool's price/gap feed (`currentPrice()`, `gap()`, `OmniverseTrade`) is the
*single* dependency that unblocks both lending and the live UI — so put the entire **feed-producing** stack
(math → pool → lending → factory → scripts) under P1 and the entire **feed-consuming** stack (UI, indexer,
demos) under P2. Result: disjoint file trees (`contracts-stylus/ + contracts-sol/ + scripts/` vs
`web/ + indexer/`), near-zero merge conflicts, and P2 stays 100% unblocked on mocks until P1 ships addresses.
Math correctness stays with P1 because the kernel, the pool that calls it, and the lending HF that depends on
its gap are one reasoning unit — splitting them creates an interface seam mid-build.

### 4.2 Day-0 frozen interfaces (agree in the first 60–90 min; P2 mocks all of them)

1. **`IOmniverseMath`** — already exists, matches Stylus selectors (case-sensitive `Phi`/`PhiInv`). Frozen.
2. **`OmniverseTrade` event** — **resolve the conflict; pick the 9-field plan version** (§3.3). Indexer blocks on this.
3. **Pool read ABI** — `currentPrice()→uint256`, `gap()→int256`, `getReserves()→(xActive,xPassive,yActive,
   yPassive,ellActive,lambdaWad,L_t)`, `quote(side,size)→(out,priceAfter)`, `healthFactor(user,market)→uint256`.
4. **Deployment manifest** — one `deployments/arb-sepolia.json` (addresses + marketId); P1 writes, P2 reads.
   Agree the key names now.

### 4.3 Person 1 — checklist by milestone

**M0 (H0–4) — unblock the toolchain**
- [ ] Arbitrum Nitro `--dev` node (Docker) at `:8547`. **Gate: if Stylus activation is blocked by H4, commit
      to the Solidity `solstat` fallback kernel and keep moving — don't burn the hackathon on toolchain.**
- [ ] **Install `cargo-stylus`**; run `cargo stylus check` (+ `deploy`) — kernel already builds to 20.5KB WASM;
      only activation is pending. This also closes the §5 verification gap.
- [ ] Apply **H-1, H-2, M-1, M-2** fixes from §3 before anything builds on top.

**M1 (H4–12) — tokens + math fallback**
- [ ] **Custom ERC-20 YES/NO `ConditionalTokens`** (split/merge/redeem vs collateral escrow) — *not* Gnosis CTF
      (scope cut, §4.6). Conservation test: `YES.supply == NO.supply == collateral escrowed`.
- [ ] Solidity `OmniverseMathSolidity` fallback (`solstat`+PRBMath) behind `IOmniverseMath` — **license-check
      solstat's AGPL** before bundling.
- [ ] Hand P2 the **canonical λ\* table** (γ'=2: 0.5→0.427, 0.2→0.479, 0.001→0.134) for Demo-2 validation.

**M2 (H12–22) — pool custody + factory + DEPLOY (the unblock moment)**
- [ ] Real ERC-20 custody in `PmAmmPool` (transferFrom/transfer/approvals) + **M-3/M-4/M-5/M-6** fixes.
- [ ] `MarketFactory.createEvent(...)` → ONE pre-seeded market.
- [ ] **Deploy pool+factory to Arb Sepolia; write addresses+ABI to the manifest → unblocks all of P2's live
      integration.** (Sync point #1.)
- [ ] Foundry: rebalance once/block; `P=Φ(z)` matches closed form; invariant non-decreasing; no-drain under
      adversarial sequences; freeze near T; **+ the H-1 large-sell and H-2 ellActive regression tests.**

**M3 (H22–32) — lending + resolution**
- [ ] `MultiverseLending`: same-universe deposit/borrow; HF (P cancels); gap-haircut LTV.
- [ ] **Non-negotiable traps:** seed the debt reserve in the **YES-USDC conditional position** (not raw USDC);
      **enforce same-conditionId + same-leg at `borrow`** (test T6 — this check *is* the safety claim);
      both-universe settlement-solvency tests; `settle()` idempotent + permissionless.
- [ ] **Owner-resolver only** (scope cut). Chainlink ETH/USD for within-universe price; **fail-closed** on
      staleness. Provide the `settle()` path Demo 1 calls.

**M4 (H32–40) — scripts + harden**
- [ ] `Deploy.s.sol`, `SeedMarket.s.sol` (prepare condition + add liquidity + open both Demo-1 loans),
      `TriggerCrash.s.sol` (resolve + settle), `ResetDemo.s.sol`, `faucet.ts`, `tradeBot.ts` (pre-fill history).
- [ ] Pre-fund demo wallets ≥0.5 ETH 24h ahead; rehearse Reset 3×.

### 4.4 Person 2 — checklist by milestone

**M0 (H0–4) — shell on mocks**
- [ ] Next.js 15 (app-router) + wagmi v2 + viem + RainbowKit; chain `arbitrumSepolia`;
      **`fallback([http(primary), http(publicRpc)])`** transport (RPC failover is non-optional for a live demo).
- [ ] `USE_MOCK=true` mode + mocked ABIs/addresses for the §4.2 interfaces → fully unblocked.
- [ ] `lib/formatters.ts` (divide WAD by 1e18 — forgetting this shows `350000000000000000%`).

**M1 (H4–12) — Demo 2 (the guaranteed-to-work showpiece, ZERO contract deps)**
- [ ] **Demo 2 λ-Explorer first** — pure-TS `lib/lambdaMath.ts` (`phi, Phi, PhiInv, v(z), gammaG,
      lambdaStarGaussian, simulateLvr, computeFrontier`); sliders λ/γ'/P + "Informed Trader Attack"; 2 Recharts panels.
- [ ] **Validate against P1's reference table** the moment it lands: `lambdaStarGaussian(2,0.001)≈0.134`,
      `(2,0.5)≈0.427`, `(2,0.2)≈0.479`. Chart it as **W-shaped** (peaks P≈0.2/0.8), not a dome. If numbers
      mismatch, fix the TS — not the slide.
- [ ] Build Trade/LP/Lending panels + market grid/detail against mocks.

**M2 (H12–22) — indexer + go-live**
- [ ] Ponder indexer (Railway + **persistent Postgres volume** so it resumes from checkpoint, not genesis).
      One-sided volume (sum only `Trade.size`). **Blocked until the event schema is frozen (day-0) + pool
      deployed (P1 M2).**
- [ ] **Swap mocks → live manifest addresses** when P1 deploys (Sync point #1). Trade UI → real `quote`/`buyYes`;
      probability chart appends per `OmniverseTrade`; block-polling `pollingInterval:2000` (no websockets).

**M3 (H22–32) — Demo 1 + Demo 3**
- [ ] **Demo 1 Zero-Liquidation** — two synced panels, one "Trigger Crash": left = simulated Aave loan
      liquidates (HF 1.4→0.7, red "LIQUIDATED"); right = OMNIVERSE collateral+debt → 0 simultaneously, green
      "Net P&L: 0". On-chain path calls P1's `settle()`; **build the `USE_MOCK` snapshot path first** so it
      works even if lending slips (Sync point #2).
- [ ] **Demo 3 PA-AMM Visualizer** — offline, reuses `lambdaMath.ts` (split→trade→merge→repartition).
- [ ] LendingPanel HF radial gauge + persistent "No liquidation — settles at resolution" banner.

**M4 (H32–40) — harden + pitch**
- [ ] LP panel + LVR/decay charts; design at 1280×720 (projector); memoize re-renders on trade-array length.
- [ ] Vercel deploy; Ponder CORS → Vercel URL; test with primary RPC **down**; `USE_MOCK` flippable in <30s.
- [ ] README + pitch deck (use the λ\* Verdict honesty framing). **Record a 60–90s backup video.**

### 4.5 Critical path & sync points

- **Day-0 (both, first 90 min):** freeze the 4 interfaces in §4.2 — especially the `OmniverseTrade` schema and
  the manifest key names.
- **What stays unblocked:** P2 mocks the entire chain → builds 100% of the UI + Demo 2 + Demo 3 with zero
  contract dependency. Demos 2 & 3 *never* need a live contract — they're the guaranteed-working showpieces.
  P1 needs nothing from P2.
- **The only 3 real couplings:**
  1. **P1 M2 deploy → P2 go-live (~H22):** P1 writes addresses+ABI; P2 flips mocks→live. *Highest-risk
     handoff — schedule a hard 30-min integration session.*
  2. **P1 M3 lending+settle → P2 Demo-1 on-chain (~H30):** low risk because P2's mock path already works.
  3. **P1 M1 reference table → P2 Demo-2 validation (~H12):** async, low risk.
- **Resilience:** the critical path is Stylus/fallback (H4) → pool deploy (H22) → lending+settle (H30) →
  Demo-1 on-chain (H32). If it slips, **the demo still stands on Demo 2 + Demo 3 + mocked Demo 1.**

### 4.6 Scope cuts vs the 3-dev plan (2 people, ~40h)

| Cut | From → To | Why |
|---|---|---|
| **Outcome tokens** | Gnosis CTF ERC-1155 → **custom ERC-20 YES/NO** | CONTEXT §10 itself said "don't use CTF for MVP." ERC-1155 split/merge/redeem + `onERC1155Received` custody across pool *and* lending is 6–10h one person can't spare. ERC-20 keeps the same conservation invariant; lending math is identical. **Highest-ROI cut.** |
| **Resolver** | owner + mock-UMA → **owner-resolve only** | Saves ~4h. "No trusted coordinator" was only ever the AMM *price*; the resolver was always disclosed as trusted. No pitch loss. |
| **Markets** | factory UX → **single pre-seeded market** | Factory code stays (wires the condition); UI/seed targets ONE market. |
| **Lending interest** | rate curve → **zero/flat** | Already the MVP assumption; the innovation is liquidation-free settlement. |
| **λ\* mode** | keep dynamic **behind the flag**, constant-0.5 fallback armed | Don't cut the hero feature, but never let the live demo depend on the unproven λ\* step. |
| **Distribution markets** | **drop** | Already H40+ stretch; out of scope for 2 people. |

**Highest-ROI demo:** **Demo 2 (λ-Explorer)** — offline, guaranteed, showcases the genuine novelty; build first.
**Demo 1** is the most visceral (build the mock path to de-risk). **Demo 3** is cheap (reuses Demo-2 math).
If time runs out, priority: **keep 2 → 1(mock) → 3.**

---

## 5. Open gaps the review could not close

- **`cargo stylus check` was not run** — `cargo-stylus` is not installed and no `wasm32` artifact was built, so
  the **<24KB-compressed size gate** and the **on-chain float/activation gate** are unverified. The host build
  is float-free by source inspection, but Stylus's own check is the only authoritative gate. **P1 must install
  `cargo-stylus` and run it before deploy** (it's in P1's M0).
- **No integration test against the real kernel.** `MockOmniverseMath.solveSwap` returns `y0−1` unconditionally,
  so no Foundry test exercises the real invariant, the `L_t` curve, or fixes H-1/H-2/M-4. Add one once the pool
  has real custody (P1 M2).

---

*Reviewed and planned by a 3-agent team; fixes are file:line-specific and were each verified against the code
(not the comments). Apply §3.4 in order, freeze §4.2 day-0, then build §4.3/§4.4 in parallel.*
