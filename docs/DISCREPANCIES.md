# OMNIVERSE — Phases 1–3 Discrepancy Audit

Read-only audit of commit `b5f5b49` (CTF custody, Solidity math fallback, pm-AMM pool).
Scope: `contracts-sol/src/PmAmmPool.sol`, `src/OmniverseMathSolidity.sol`,
`src/libraries/CtfPositionLib.sol`, `src/interfaces/*`, `test/mocks/*`, `test/*.t.sol`,
cross-checked against the Rust kernel `contracts-stylus/src/math/*.rs` and
`DEEP_DIVE_AND_REMAINING_WORK.md`.

**Test-suite caveat (read first):** all 24 tests pass, but every pool test injects
`MockOmniverseMath` (constant `Phi=0.5`, closed-form `solveSwap`) and a **hash-based**
`MockConditionalTokens`. The green suite therefore exercises *neither* real CTF id
derivation *nor* the real `OmniverseMathSolidity` through the pool. The two highest-severity
findings below are invisible to the current tests by construction.

Severity legend: **H** = breaks against the audited production artifact / fund-risk.
**M** = breaks an integration the roadmap explicitly requires (Phase 6 resolver / real CTF).
**L** = correctness/precision/design note, demo-safe.

---

## H-1 — `CtfPositionLib.collectionId` hashes; real Gnosis CTF uses alt_bn128 EC math

**File:** `contracts-sol/src/libraries/CtfPositionLib.sol:15-17`

```solidity
function collectionId(bytes32 conditionId, uint256 indexSet) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(PARENT_COLLECTION_ID, conditionId, indexSet));
}
```

The real `ConditionalTokens.getCollectionId(parent, conditionId, indexSet)` is **not a hash**:
it maps `keccak256(conditionId, indexSet)` onto the alt_bn128 (BN254) curve and performs an
elliptic-curve point addition with the parent collection point (this is exactly the crypto
ChainSecurity audited, 11 Apr 2024 — see `DEEP_DIVE_AND_REMAINING_WORK.md:198-209`). A
keccak collection id will **never** equal the on-chain value, even with `parent = bytes32(0)`.

**Blast radius.** The pool caches `yesPositionId`/`noPositionId` from this lib in its
constructor (`PmAmmPool.sol:108-109`). Against a real CTF deployment those two ids are wrong, so:
- every `safeTransferFrom(... yesPositionId/noPositionId ...)` in `addLiquidity`/`buyYes`/`buyNo`
  moves a token nobody holds → reverts on the `balanceOf < amount` check, or worse moves the
  wrong token id;
- `onERC1155Received` rejects the real YES/NO ids as `InvalidPosition` (`PmAmmPool.sol:234`),
  so legitimate `splitPosition`-then-transfer into the pool reverts.

The mock hides this because `MockConditionalTokens.getCollectionId` *also* keccak-hashes
(`test/mocks/MockConditionalTokens.sol:85-91`) and `ConditionalTokens.t.sol:25` asserts the lib
against the mock — a tautology, not a real-CTF check.

**Fix (canonical, matches roadmap `DEEP_DIVE:202-209`).** Stop hand-deriving ids. Read the four
ids from the deployed CTF once and cache them. In the pool constructor (or a factory that feeds
the pool):

```solidity
bytes32 yesColl = conditionalTokens_.getCollectionId(bytes32(0), conditionId_, 1);
bytes32 noColl  = conditionalTokens_.getCollectionId(bytes32(0), conditionId_, 2);
yesPositionId = conditionalTokens_.getPositionId(collateralToken_, yesColl);
noPositionId  = conditionalTokens_.getPositionId(collateralToken_, noColl);
```

Note this requires `IConditionalTokens.getCollectionId/getPositionId` to be callable in the
constructor — fine, but they are declared `pure` (see M-3); on the real contract `getCollectionId`
is `view`/non-pure, so the interface mutability must be relaxed or the call will not compile/ABI-match.
`CtfPositionLib`'s `positionId`/`collectionId` should be deleted or clearly marked
"DEMO-ONLY / mock-parity, NOT real CTF" to stop anyone trusting them.

**Alternative (demo-only, document loudly):** if you intentionally ship the hash-based mock CTF
for the hackathon demo, keep the lib but add a top-of-file banner stating it is parity-matched to
`MockConditionalTokens` only and will not interoperate with a real Gnosis CTF, and never point the
deployment at a real CTF.

---

## H-2 — Pool prices and pays out off *internal reserves*, not custody balance (donation / desync surface)

**Files:** `PmAmmPool.sol:258-274`, `281-301`, `199-213`, `350-356`

This is intentional and mostly safe (pricing off internal `xActive/yActive` rather than
`balanceOf` is the donation-resistant choice). Flagging it H only because of one asymmetry that
can strand the pool:

`buyYes`/`buyNo` guard the *output* against custody with
`if (conditionalTokens.balanceOf(address(this), id) < out) revert` (`:266`, `:293`), but the
reserve bookkeeping (`xActive/yActive/xPassive/yPassive`) is updated independently of custody.
If custody and reserves ever diverge — e.g. a direct ERC-1155 transfer of YES/NO into the pool
(accepted by `onERC1155Received` for the right ids, `:232-236`, with no reserve credit), or the
H-1 id mismatch — then:
- donated tokens are permanently unattributed (no `xPassive` credit) → silent LP loss / locked funds;
- `removeLiquidity` pays `((xActive+xPassive)*shares)/supply` (`:181-182`) which can exceed or
  undershoot real custody, and `_removeFromBuckets` will `revert InvalidAmount` (`:383`) when
  reserves claim more than custody holds, bricking withdrawals.

**Fix.** Either (a) reject unsolicited 1155 receipts unless they originate from a pool method
(track an `_expectingDeposit` flag set inside `addLiquidity`/`buy*` and require it in
`onERC1155Received`), or (b) add a `skim()`/`sync()` that credits surplus custody to `xPassive/yPassive`
so donations can't desync reserves from balances. At minimum, document that any path which moves
YES/NO into the pool *must* go through `addLiquidity`. The existing `testReserveBalancesStaySynced…`
only proves sync under the happy path; it does not cover donations.

---

## M-1 — `solveSwap` can silently return `0` (full output drain) instead of reverting at the boundary

**File:** `OmniverseMathSolidity.sol:62-99`

Probed: `solveSwap(x1 = type(uint128).max, y0 = 1e18, ell = 1e6)` returns **`0`** (verified by
running an ad-hoc probe; converges in the bracket and returns `y1 = 0`). For a huge `x1` and tiny
`ell` the true root is ~0, so `0` is *numerically* defensible — but the Rust reference
(`solver.rs:117`) **panics** on any non-converged / degenerate case and never silently returns a
boundary value, whereas the Solidity path treats `f≈0` at `y=0` as a clean convergence
(`:74-75`).

**Why it matters in the pool.** `buyYes` computes `yesOut = yActive - y1` (`:264`). A `y1 = 0`
return means the trade drains the *entire* active YES reserve for one swap. The invariant guard
(`_assertInvariantAndPrice`, `:350`) will likely catch a truly off-curve result, but a boundary
`y1=0` that *is* on-curve passes the guard and executes a 100%-reserve swap. The input bounds
(`_assertKernelBounds`, `MAX_KERNEL_INPUT = uint128.max`) permit `x1` this large.

**Divergence from Rust to flag for parity (Phase 8):**
- Rust rounds the converged root **UP** (`y+1` when `f>0`, else `hi` on bracket-collapse) for
  pool-favoring (`solver.rs:75-78,105`). Solidity returns `fVal>0 ? y1+1 : y1` (`:75`) — matches
  the `f>0` branch but on bracket-collapse Solidity returns the *current* `y1`, while Rust returns
  `hi`. These can differ by 1 wei and, more importantly, by rounding *direction* near the root.
  Confirm this 1-wei rounding is identical before swapping in the WASM kernel, or pool invariant
  residuals will differ between fallback and kernel.

**Fix.** Add an explicit lower-bound sanity check after the solver in the *pool* (e.g. require
`y1 > 0` for non-degenerate inputs, or cap single-swap output to a fraction of the reserve), and
align the bracket-collapse return (`return hi`-equivalent) with Rust so fallback↔kernel parity
holds to the wei.

---

## M-2 — `IConditionalTokens` is missing `reportPayouts`; mock signature ≠ real CTF (Phase 6 will break)

**Files:** `src/interfaces/IConditionalTokens.sol` (no `reportPayouts`),
`test/mocks/MockConditionalTokens.sol:80-83`

The interface has no `reportPayouts` at all. The mock declares
`reportPayouts(bytes32 conditionId, uint256 winningIndexSet)` — a **single index set**. The real
Gnosis CTF is `reportPayouts(bytes32 questionId, uint256[] payouts)` — keyed by **questionId**
(not conditionId) and taking a **payout-numerator array**, not a winning index
(`DEEP_DIVE:190`). Also note the conditionId↔questionId distinction: real `conditionId =
keccak256(oracle, questionId, outcomeSlotCount)`, but `MockConditionalTokens.payoutIndexSet` is
keyed directly by `conditionId` (`:63,82`), and `redeemPositions` reads `payoutIndexSet[conditionId]`.

**Blast radius.** The Phase 6 `Resolver` (`DEEP_DIVE:308-309`) is specified to call
`ctf.reportPayouts(questionId, payouts)`. Wired against this interface/mock it will (a) not find
the method on the interface, and (b) when pointed at a real CTF, pass the wrong arg shape and the
wrong key → resolution silently no-ops or reverts, and `redeemPositions` finds no payout.

**Fix.** Before Phase 6: add the real signature to the interface
`function reportPayouts(bytes32 questionId, uint256[] calldata payouts) external;`, make the mock
match it (store the payout vector, derive winner from it, key by the questionId used in
`prepareCondition`), and have `redeemPositions` compute payout from numerators rather than a single
winning index. Freeze the questionId↔conditionId derivation now so Resolver and pool agree.

---

## M-3 — Interface mutability (`pure`) blocks the canonical id-read fix and may break ABI match

**File:** `src/interfaces/IConditionalTokens.sol:30-35`

```solidity
function getCollectionId(...) external pure returns (bytes32);
function getPositionId(...) external pure returns (uint256);
```

On the real `ConditionalTokens`, `getCollectionId` is **not pure** (it does EC math but is a
plain `view`/`public` function, and across CTF versions the mutability of these getters varies).
Declaring them `pure` (a) lets the constructor read them, but (b) if the on-chain function is
`view`, a `pure` external call still works at runtime yet mismatches the verified ABI and trips
strict tooling. More importantly, this `pure` declaration is what made the keccak hand-derivation
in H-1 *seem* legitimate.

**Fix.** Relax to `view` to match the real contract, and adopt the H-1 read-at-setup pattern.

---

## L-1 — Rebalance is once-per-block; intra-block trades price off stale `ellActive`/`lambda`

**File:** `PmAmmPool.sol:314-342` (`_rebalance` early-returns when `block.number <= nLast`),
constructor sets `nLast = block.number` (`:117`).

Consequences (all by-design but worth stating): (a) **no rebalance can occur in the deploy block**;
(b) every trade within a single block after the first uses the `ellActive`/`lambdaWad` frozen at the
block's first rebalance, while `currentLiquidity()`/`gap()` report *live* time-decayed `ell`
(`:206,212`) — so on-chain price (`currentPrice`, uses `ellActive`) and `gap` momentarily disagree
within a block. This is acceptable for a once-per-block AMM but should be documented; integrators
reading `currentPrice` vs `getReserves().lT_` will see a small inconsistency. No fix required;
note for the front-end/keeper.

---

## L-2 — `gap()` uses `T-1` clamp and mixes `ellActive` (active) with `ellTotal` (full) — verify sign convention

**File:** `PmAmmPool.sol:209-214`

```solidity
uint256 ellTotal = _floorEll(_liquidityAt(block.timestamp >= T ? T - 1 : block.timestamp));
return _zFromReserves(xActive, yActive, ellActive) - _zFromReserves(xTotal, yTotal, ellTotal);
```

The active term uses block-stale `ellActive`; the total term uses freshly-decayed `ellTotal`. This
is intentional (gap = active-curve z minus full-pool z), but because the two z's use different `ell`
the "gap" conflates a liquidity-decay component with the active/passive split. If the event schema
consumer interprets `gapWad` as purely the activeness imbalance, the decay mixing will bias it.
Confirm the Stylus event-schema definition of `gap` matches this exact formula (the event is
`emit`ed with `gapWad` in `OmniverseTrade`, `:277,304`). No code bug; schema-parity check.

---

## L-3 — `_liquidityAt` sqrt scaling and `_floorEll` interaction; precision note

**File:** `PmAmmPool.sol:344-348`, `402-404`

`_liquidityAt = L0 * sqrt(fractionWad) / WAD_SQRT` with `fractionWad = (T-t)*WAD/duration` and
`WAD_SQRT = 1e9`. `_sqrt(fractionWad)` of a WAD-scaled value returns a `1e9`-scaled root, so
`L0 * root / 1e9` recovers L0-scaled decay — correct. Edge: when `fractionWad < 1e18` (always, for
t>start) the integer `_sqrt` floors, and after `_floorEll` clamps to `MIN_ELL=1e6`, the last
~hour before expiry pins `ell` to `1e6`. `testLiquidityDecaysWithTime` confirms the t→T endpoint.
Just confirm the Rust `wad_sqrt` (`sqrt.rs`) uses the identical `*WAD then isqrt` convention so
decayed-`ell` matches between fallback and kernel (it appears to: `_wadSqrt(x) = _sqrt(x*WAD)` here
vs `wad_sqrt` there). Parity check, not a bug.

---

## L-4 — `PhiInv` algorithm differs from Rust (bisection vs Acklam+Halley) but converges; `phi`/`Phi` parity is good

**Files:** `OmniverseMathSolidity.sol:46-60` vs `gaussian.rs:180-294`

Solidity `PhiInv` is a 96-iteration **bisection** on `[-8,8]` WAD; the Rust kernel uses **Acklam's
rational approximation + one Halley step**. They are different algorithms but both target Φ⁻¹.
Measured outputs match the reference grid closely:
- `lambdaStarGaussian(2e18, 0.5e18) = 0.42705…` (ref 0.427 ✓)
- `(2e18, 0.2e18) = 0.47867…` (ref 0.479 ✓)
- `(2e18, 0.001e18) = 0.13417…` (ref 0.134 ✓)
- `Phi(1e18) = 0.84134…`, `Phi(-1e18) = 0.15866…` (✓), `PhiInv(0.975) = 1.95996…` (✓)

So **no correctness defect** in the central region. Two parity caveats for Phase 8:
(1) bisection gives ~2^-96 absolute precision but the *rounding pattern* (always converges to the
midpoint of the final bracket, `:59`) differs from Halley's; `lambdaStarGaussian` results can
differ by a few wei between fallback and kernel. The current tests assert with very loose
tolerances (`6e16`, `8e16` — `OmniverseMathSolidity.t.sol:37-38`), so they will NOT catch a parity
drift; tighten these once the real kernel grid is available.
(2) `Phi`'s Horner poly (`:35-42`) can make `cdfPositive = WAD - phi*poly/WAD` for inputs where the
A&S approximation slightly overshoots near `z≈0`; here it stays in range, but the Rust version
*explicitly clamps* `approx` to `[0, WAD]` (`gaussian.rs:158-163`) while Solidity does not clamp
the intermediate. For `z` very close to 0 with adversarial inputs this is worth a clamp for exact
parity. Low risk given the `[-8,8]` early-outs.

---

## L-5 — `lambdaStarGaussian` overflow headroom OK, but `_wadSqrt(x*WAD)` is the latent ceiling

**File:** `OmniverseMathSolidity.sol:122,162-164`

`disc = _wadSqrt(WAD + 2*gammaG)` → `_sqrt((WAD+2*gammaG) * WAD)`. With `gammaPrime ≤ 1e24`
(`:109`) and the `v(z)*phi(z)` denominator floored at `PHI_MIN`-derived values, probed
`(1e24, 0.5e18)` and `(1e24, 2e14)` both return `LAMBDA_MIN` cleanly — no revert. The latent
ceiling is `(WAD+2*gammaG)*WAD`: if `gammaG` ever reached ~`1e59` this multiply overflows uint256.
Current clamps keep `gammaG` well below that, so **no live bug**, but the bound is implicit. Add an
explicit `require` or saturate `gammaG` to document the safe envelope (Rust bounds `gamma_prime`
the same way at `lambda.rs:63-64`, so this is parity-consistent).

---

## Summary table

| ID  | Sev | File:line | One-line |
|-----|-----|-----------|----------|
| H-1 | H | `CtfPositionLib.sol:15` | keccak collectionId ≠ real CTF alt_bn128 EC math → all pool transfers revert vs real CTF; read ids from contract at setup |
| H-2 | H | `PmAmmPool.sol:266,181` | reserves vs custody can desync (donations / H-1) → locked funds / bricked withdraw; gate 1155 receipts or add skim |
| M-1 | M | `OmniverseMathSolidity.sol:74` | `solveSwap` can silently return 0 (full drain) where Rust panics; align rounding/bracket return for parity |
| M-2 | M | `IConditionalTokens.sol` / mock:80 | no `reportPayouts`; mock sig (index) ≠ real (`questionId,uint256[]`) → Phase 6 resolver breaks |
| M-3 | M | `IConditionalTokens.sol:30` | getters declared `pure`; real CTF not pure → blocks id-read fix / ABI mismatch |
| L-1 | L | `PmAmmPool.sol:316` | once-per-block rebalance: intra-block trades use stale ell/lambda; no deploy-block rebalance |
| L-2 | L | `PmAmmPool.sol:212` | `gap()` mixes active-stale ell with total-fresh ell; confirm vs Stylus event schema |
| L-3 | L | `PmAmmPool.sol:347` | decay sqrt scaling correct; confirm `wad_sqrt` convention parity |
| L-4 | L | `OmniverseMathSolidity.sol:46` | PhiInv bisection vs Rust Acklam+Halley: converges, but loose test tolerances hide wei-level parity drift |
| L-5 | L | `OmniverseMathSolidity.sol:122` | lambdaStar overflow headroom OK but implicit; saturate gammaG |

**Out-of-scope note (not Phase 1–3):** while probing I observed `src/MultiverseLending.sol`
(lending-dev, in progress) currently fails to compile (`approve`/`IERC20Approve` undeclared,
`MultiverseLending.sol:93`). Flagging so the lead knows the tree is temporarily red; not part of
this audit.

---
---

# Phase 4/5 review — MarketFactory & MultiverseLending

Adversarial read-only review of `src/MarketFactory.sol` + `test/MarketFactory.t.sol`
(factory-dev) and `src/MultiverseLending.sol` + `test/MultiverseLending.t.sol` +
`src/interfaces/IPriceOracle.sol` (lending-dev). Full suite is 45/45 green; all 21 new tests
pass. Findings below were each reproduced with ad-hoc probes (deleted after).

**Verdict: NOT ship-ready. One HIGH (funds permanently locked after `settle`) is a
correctness/fund-safety blocker. Trap claims #1, #3, #4 and HF-cancellation hold; trap #2's
*test* is weak but the underlying code property is sound.**

## P45-H1 — After `settle()`, all collateral and reserve are permanently locked (no claim phase)

**File:** `MultiverseLending.sol:141-150` (`withdraw`), `155-170` (`settle`); no post-settle claim fn.

`settle()` redeems both legs' positions into the contract's **raw** WETH/USDC balance and burns
the ERC-1155 positions. But `withdraw()` (the only collateral exit) transfers `yesWethId` — a
position that no longer exists after settle — so it **reverts**. There is no function anywhere to
distribute the redeemed raw WETH/USDC back to depositors or the reserve seeder.

Reproduced: deposit 2 WETH, borrow 1000, YES resolves, `settle()` →
- `withdraw(2e18)` **reverts** (collateral gone to raw WETH);
- 2.0 WETH and 9000 USDC sit **locked** in the contract with no exit;
- `collateralOf[borrower]` still reads 2e18 and `debtOf` still 1000e18 (stale book).

So the protocol is solvent on paper but **everyone's funds are stuck after resolution** — this
defeats the entire "settled at resolution, made whole" thesis. The lending tests assert only the
*contract's* post-settle balances (`testYesResolutionLenderMadeWhole:158-162`,
`testNoResolutionNetPnlZero`), never that the seeder or a depositor can actually withdraw value —
so they pass while the money is trapped.

**Fix.** Add a post-settle claim phase: after `settled == true`, replace the position-transfer
exits with raw-token payouts computed from the final book. Concretely — snapshot the winning
outcome, then let each depositor claim `collateralOf[user]` worth of redeemed WETH and let the
seeder/lenders claim `reserveYesUsdc` (+ repaid) worth of redeemed USDC, debiting the maps as
they claim. Minimal version: a `claimCollateral()` and `claimReserve()` gated on `settled` that
pay out raw ERC-20 and zero the corresponding map entry.

## P45-H2 — Book is mutable after `settle()`; `borrow`/`repay`/`withdraw`/`deposit` not gated on `settled`

**File:** `MultiverseLending.sol:109-150` (none check `settled`).

Only `settle()` checks `settled`. Reproduced: after `settle()`, `repay(1000e18)` **succeeds** —
it pulls `yesUsdcId` from the caller (now post-resolution, possibly worthless or already redeemed)
and bumps `reserveYesUsdc`, mutating an already-finalised book. `deposit`/`borrow` similarly
remain callable (borrow now reverts only because the reserve position was redeemed away, i.e. by
accident, not by design). This compounds P45-H1: post-settle state can drift arbitrarily.

**Fix.** Add a `notSettled` modifier (mirror of the `settled` check) to
`seedReserve`/`deposit`/`borrow`/`repay`/`withdraw`. Pairs naturally with the P45-H1 claim phase
(those *should* be the only callable fns once settled).

## P45-M1 — `abs(g)` reverts on `g == type(int256).min`, bricking `healthFactor` (defensive only)

**File:** `MultiverseLending.sol:186` — `uint256 absG = g < 0 ? uint256(-g) : uint256(g);`

`-g` is checked arithmetic; at `int256.min` it overflows and **reverts** (reproduced). Since
`healthFactor` is on the hot path of `borrow`/`withdraw`, a `gap()` of `int256.min` would brick
those. **Not reachable today**: `gap()` returns a difference of z-values bounded by reserves ≤
`uint128.max` and `ell ≥ 1e6`, so |g| ≲ 3.4e50 ≪ |int256.min| ≈ 5.7e76. Flagging L/defensive: use
an unchecked/`unsigned_abs`-style abs so a future change to pool bounds can't introduce a HF DoS.

**Fix.** `uint256 absG = g < 0 ? uint256(type(int256).max) - uint256(g) + 1 ... ` — or simpler,
`uint256 absG; unchecked { absG = uint256(g < 0 ? -g : g); }` with the int256.min case clamped to
`G_CAP` (it saturates LTV to the floor anyway).

## P45-M2 — Factory hand-derives `conditionId` instead of calling `ctf.getConditionId`

**File:** `MarketFactory.sol:52-53`

```solidity
conditionalTokens.prepareCondition(resolver, questionId, OUTCOME_SLOTS);
bytes32 conditionId = keccak256(abi.encodePacked(resolver, questionId, OUTCOME_SLOTS));
```

Unlike `getCollectionId` (the EC landmine in H-1), the real CTF `conditionId` **is** a keccak:
`keccak256(oracle, questionId, outcomeSlotCount)`. So this is *probably* correct against a real
CTF — but `OUTCOME_SLOTS` is an `internal constant uint256` and `abi.encodePacked(uint256)` pads
to 32 bytes; the real CTF computes the same hash, so it matches **iff** the real getter encodes
`outcomeSlotCount` as a full `uint256` (it does). The risk is silent: any divergence in arg type
or a CTF version that changes the derivation breaks every market's positionIds with no error.
Lending and pool both rely on this exact conditionId.

**Fix.** Call `conditionId = conditionalTokens.getConditionId(resolver, questionId, OUTCOME_SLOTS)`
(add it to `IConditionalTokens`) rather than re-deriving. Single source of truth; future-proof.

## P45-M3 — Inherits H-1: every positionId here is keccak-derived, wrong vs real Gnosis CTF

**Files:** `MarketFactory.sol` (pools derive ids via `CtfPositionLib` in `PmAmmPool` ctor),
`MultiverseLending.sol:88-90` (`yesWethId`/`yesUsdcId`/`noUsdcId` via `CtfPositionLib`).

Both new contracts derive position ids through `CtfPositionLib`, which carries **H-1**: the
collectionId is keccak'd, not alt_bn128 EC. So against a real CTF, lending's `deposit`/`borrow`/
`seedReserve`/`settle` and the factory's pools all reference non-existent ids and revert. The
green tests only prove self-consistency against the hash-based `MockConditionalTokens`. See **H-1**
for the fix (read the four ids from the deployed CTF at setup); it must be applied before either
Phase 4 or Phase 5 touches a real CTF.

## P45-L1 — Trap #2 test proves a weak property (CTF "not approved", not a lending invariant)

**File:** `test/MultiverseLending.t.sol:123-136` (`testCrossLegBorrowIsStructurallyImpossible`).

The test asserts that an *external* `ctf.safeTransferFrom(lending, borrower, noUsdcId, …)` reverts
with `"ERC1155: not approved"`. That is a property of the **CTF mock's** approval check, not of
`MultiverseLending`. It does **not** exercise any lending code path. The real structural guarantee
— that `borrow` only ever transfers `yesUsdcId` — lives at `MultiverseLending.sol:127` and is
genuinely sound (the id is hardcoded, no caller-supplied token), but the test never asserts that
directly. `testOnlyBorrowableIdIsYesUsdc:112-121` is the test that actually proves the claim
(borrower receives only `yesUsdcId`); trap #2's named test is close to vacuous.

**Fix.** Keep `testOnlyBorrowableIdIsYesUsdc` as the trap-#2 proof. Strengthen the "impossible"
test to assert there is no code path taking an outcome/leg selector (e.g. fuzz that `borrow`'s
emitted/received id is always `yesUsdcId` regardless of inputs), and drop the misleading
"not approved" assertion or relabel it as a CTF-mock sanity check.

## P45-L2 — `healthFactor` rounding: floor-division order is safe but worth stating

**File:** `MultiverseLending.sol:181` — `(collateralOf[user] * pEth / WAD) * ltv / debt`

P(YES) cancellation is **exact and real**: the formula simply never reads pYes (collateral
`C·pYes·pEth` and debt `D·pYes` algebraically cancel pYes, leaving `C·pEth·LTV/D`), so a pYes
swing cannot move HF — confirmed (`testHealthFactorInvariantToPriceOfYesSwing` passes because the
term is absent, not because two terms happen to cancel numerically). Rounding: two floor-divisions
(`/WAD` then `/debt`) each round **down**, so HF is computed conservatively (never over-states
health) — the safe direction for a lender. No fix; documenting that the order-of-ops is
lender-favourable by luck, and a future refactor must preserve "divide last / round down".

## P45-L3 — `seedReserve` trap #1 holds, but relies on H-1-style hashing for the no-raw-USDC claim

**File:** `MultiverseLending.sol:99-107`, test `:89-97`.

Trap #1 is correctly implemented: `seedReserve` pulls raw USDC then immediately
`splitPosition`s it, so the contract holds `yesUsdcId`+`noUsdcId` and **zero raw USDC**
(`testReserveSeededAsYesUsdcNotRawUsdc` confirms `usdc.balanceOf(lending)==0`). The NO-USDC leg is
retained to keep the opposite universe solvent (`testNoUniverseHasNoShortfallOnNoResolution`).
This is sound. Caveat: it depends on `splitPosition` minting ids that match the cached
`yesUsdcId/noUsdcId` — true under the mock, but breaks under real CTF via H-1/P45-M3.

## Phase 4/5 summary table

| ID | Sev | File:line | One-line |
|----|-----|-----------|----------|
| P45-H1 | H | `MultiverseLending.sol:141,155` | post-`settle` collateral+reserve permanently locked; no claim/distribution fn → "made whole" is unreachable |
| P45-H2 | H | `MultiverseLending.sol:109-150` | book mutable after settle (`repay` etc. not gated on `settled`) → finalised state drifts |
| P45-M1 | M/L | `MultiverseLending.sol:186` | `abs(int256.min)` reverts → HF DoS; not reachable today, fix abs defensively |
| P45-M2 | M | `MarketFactory.sol:53` | hand-derives conditionId; use `ctf.getConditionId` for a single source of truth |
| P45-M3 | M | `MultiverseLending.sol:88` / factory pools | inherits H-1 keccak positionIds → reverts vs real Gnosis CTF |
| P45-L1 | L | `MultiverseLending.t.sol:123` | trap-#2 test asserts CTF "not approved", not a lending invariant (near-vacuous) |
| P45-L2 | L | `MultiverseLending.sol:181` | pYes cancellation exact; floor-div order lender-favourable — preserve on refactor |
| P45-L3 | L | `MultiverseLending.sol:99` | trap-#1 no-raw-USDC sound, but depends on H-1 hashing under real CTF |

**Must-fix before ship:** P45-H1 and P45-H2 (funds locked / book mutable post-settle). Then apply
H-1/P45-M3 before any real-CTF deployment. P45-M1/M2 and the trap-#2 test strengthening (P45-L1)
are pre-mainnet hygiene.

---

# Phase 4/5 — FINAL pass (post-rework, suite 49/49)

Re-review of the reworked `MultiverseLending.sol` (`settle` / `claimBorrower` / `claimLender` /
`_ltvMax`), the `IConditionalTokens` payout-vector additions, and `MockConditionalTokens`. All
prior findings re-checked; each reproduced behaviour below was probed with throwaway tests.

### Prior-finding status

| ID | Status | Evidence |
|----|--------|----------|
| H-1 / P45-M3 | **RESOLVED** | Pool (`PmAmmPool.sol:110-114`) and lending (`MultiverseLending.sol:112-114`) now derive all positionIds via `ctf.getCollectionId`/`getPositionId` — correct against the real Gnosis artifact, no longer hand-keccak'd. |
| P45-H1 (locked funds) | **RESOLVED (with new caveat P45-H4)** | `settle` now snapshots outcome+price and freezes the book; `claimBorrower`/`claimLender` distribute raw WETH/USDC. NO branch drains to dust. YES branch has a residual rounding bug — see **P45-H4**. |
| P45-H2 (mutable post-settle) | **RESOLVED** | `notSettled` on all 6 live mutators, `onlySettled` on both claims; verified `testLiveMutatorsRevertAfterSettle` / `testClaimsRevertBeforeSettle` and by probe. |
| P45-M1 (`abs(int256.min)`) | **RESOLVED** | `_ltvMax:271` special-cases `type(int256).min`; no longer reverts. |
| P45-M2 (factory conditionId) | **OPEN** | `MarketFactory.sol:53` still hand-derives `keccak256(resolver,questionId,2)`. Correct vs real CTF (conditionId *is* a keccak) but should call `ctf.getConditionId`. Unchanged; low urgency. |
| P45-L1 (trap-#2 test) | **RESOLVED** | Rewritten to `testNoBorrowPathForOtherLegOrCondition` / `testBorrowOnlyMovesYesUsdc…` — now asserts the lending invariant (only `yesUsdcId` moves, NO-USDC untouched), not a CTF mock string. |
| P45-L2 / L3 | **Unchanged (informational).** | pYes cancellation still exact; trap-#1 no-raw-USDC still sound. |

### P45-H4 — YES-branch WETH conservation breaks by rounding; last lender claim **reverts** (funds stranded)

**File:** `MultiverseLending.sol:206-207, 227-228, 245`

The borrower's debt-cover is floored **per borrower**
(`cover_i = debt_i * WAD / settlePEth`, `:227`), but the lender pool's WETH is floored on the
**aggregate** (`lenderCoverWeth = settledTotalDebt * WAD / settlePEth`, `:206`). Because
`floor(Σ debt_i · W / p) ≥ Σ floor(debt_i · W / p)`, the WETH promised to lenders
(`lenderCoverWeth`) can exceed the WETH borrowers actually left behind. The surplus is
distributed pro-rata, so the **final lender's `claimLender` reverts on the ERC-20 transfer** —
their funds are permanently stranded.

Reproduced (probe): seed 6 000 + 3 000, borrows 777e18 / 333e18 / 111e18, `pEth = 3333e18`,
YES wins:
- WETH pot = 3.0; Σ borrower claims = 2.633663366336633665, leaving **0.366336633663366335**;
- `lenderCoverWeth = 0.366336633663366336` (1 wei MORE than what remains);
- lender 1 claims pro-rata; **lender 2's `claimLender()` REVERTS** (insolvency by rounding).

The existing `testMultipleBorrowersAndLendersSettleSolvent` (`:211`) uses debts divisible by
`pEth` (2000/1000 @ 2000), so `floor(Σ)=Σfloor` and the bug never triggers — the test passes
vacuously w.r.t. this rounding path. (USDC side is safe: `settledReserveUsdc * share / seedTotal`
floors *down*, so it strands dust rather than over-promising.)

**Fix (minimal).** Make the lender WETH pool exactly what borrowers leave behind, not an
independent floor of the aggregate. Either:
- compute `lenderCoverWeth = wethRedeemed - Σ(borrowerEquity)` — but that needs borrower equity
  summed; simpler:
- have the **last claimant sweep the remainder**: cap each lender WETH/USDC transfer at the live
  `balanceOf(this)` (`wethOut = min(wethOut, weth.balanceOf(address(this)))`), so the unavoidable
  ≤N-wei rounding dust is absorbed by whoever claims last instead of bricking them. This is the
  standard pro-rata-dust pattern and removes the revert without changing economics.

Severity **H** because it's a liveness/fund-safety break (a real user cannot withdraw), even
though the magnitude is ≤ N wei of WETH.

### P45-M4 — `settlePEth` snapshot ≠ borrow-time price: lenders bear ETH downside (zero-liquidation by design, but undocumented)

**File:** `MultiverseLending.sol:188, 206-207, 227`

HF is checked at **borrow time** against the *live* oracle, but cover is computed at the
**settlement** snapshot `settlePEth`. If ETH falls between borrow and settle, `cover = debt/pEth`
exceeds the borrower's collateral; the code correctly **caps** `lenderCoverWeth` to the pot
(`:207`) and zeroes the borrower (`:228`), so there is **no insolvency/underflow** — but lenders
recover less than seed value (the "made whole" claim only holds if ETH does not fall). Probed:
borrow 1600 @ \$2000 (HF=1), ETH→\$1000, YES wins → borrower gets 0, lender gets the full 1 WETH +
3400 USDC = value below the 5 000 seed. This is the inherent risk of a zero-liquidation design and
is handled safely; flagging **M** only because the contract NatSpec advertises "lender recovers the
full seed value" (`:235-238`) which is false under adverse ETH moves. Document the price-risk, or
add a haircut buffer in `_ltvMax` sized to expected ETH vol.

### Conservation summary (answer to Q1)

- **NO branch: exact.** Each lender gets `usdcOut = share`; Σ share = `seedTotal` = NO-USDC pot
  redeemed 1:1. Borrowers get 0. Contract drains to **0** (verified `testNoResolution…`,
  `usdc.balanceOf(lending)==0`). No stranding, no over-pay. ✅
- **YES branch USDC: safe** (floors down → dust stranded, never over-claimed). ✅
- **YES branch WETH: BROKEN** by the floor asymmetry above (**P45-H4**) — over-promises ≤N wei,
  last claimant reverts. ❌

### Other answers
- **Q2 (outcome read):** `payoutNumerators(conditionId, 0) > 0 == YES` is **correct**. Mock sets
  slot 0 = index set 1 = YES (`MockConditionalTokens.sol:91`), matching the binary partition
  `[1,2]`. `payoutDenominator==0` ⇒ `Unresolved` revert guards premature settle (verified). A
  split/invalid real-CTF resolution (both numerators > 0) would classify as YES here since it only
  tests slot 0 > 0 — acceptable for binary MVP but note it for the Phase 6 resolver (a 50/50 report
  would be read as a YES win). **L.**
- **Q3 (claim griefing/reentrancy):** claims are `nonReentrant`, zero state **before** transfer
  (`:223-224, 242`), so no reentrancy and **no double-claim** (verified). `claimLender` with
  `share==0` reverts; pro-rata can't be drained beyond `seedTotal`. The only residual is the P45-H4
  rounding revert. ✅ (aside from P45-H4)
- **Q4 (gate coverage):** **complete** — all 6 live mutators `notSettled`, both claims
  `onlySettled`, all `nonReentrant`. ✅
- **Q5 (unchecked ERC-20 returns):** `seedReserve` `transferFrom` (`:128`) and the three claim
  `transfer`s (`:229,247,252`) ignore the bool return. For real WETH (reverts on fail) and USDC
  (returns true) this is **benign — Low**. Risk: a token that returns `false` without reverting
  would credit `seedOf` in `seedReserve` without pulling funds; for the in-scope tokens this can't
  happen. Recommend `SafeERC20` before adding any non-standard collateral. **L.**

### FINAL VERDICT: **NO-SHIP — one must-fix (P45-H4).**

The rework cleanly resolves P45-H1/H2, H-1/M3, M1, and the trap-#2 test. The lending design is
otherwise sound: gating complete, CEI/reentrancy clean, NO-branch conservation exact, outcome read
correct, no double-claim. **Blocker:** P45-H4 — YES-branch WETH rounding strands the last lender
(claim reverts). One-line fix (cap each claim transfer at live `balanceOf`, dust-to-last-claimant).
Recommend M4 doc fix and M2 (`getConditionId`) as fast-follows; they don't block the demo.
After P45-H4 is patched with a non-divisible-debt + multi-lender regression test, this is SHIP.

### LEAD SIGN-OFF (post-fix): **SHIP.**

P45-H4 patched (`_capWeth`/`_capUsdc` cap every outbound transfer at live balance; dust falls on the
last claimant). Regression `testProRataDustDoesNotBrickLastClaimer` was written first, confirmed to
revert against the un-capped code, and passes after the cap. P45-M4 (NatSpec) and P45-M2
(`getConditionId`) also done. Full suite **50/50** green. All H/M findings RESOLVED; only the Low
items remain as documented fast-follows (SafeERC20 for non-standard collateral; deploy the real CTF
artifact for Phase 1/8; reportPayouts shape for the Phase 6 resolver).
