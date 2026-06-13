# Math Implementation Audit — `gaussian_lambda_star.pdf` vs. code

**Date:** 2026-06-13
**Spec:** *Gaussian λ\*: Optimal Activeness for Prediction Market AMMs* (`gaussian_lambda_star.pdf`, 19 pp.)
**Question audited:** does the codebase implement the paper's math correctly, or does it hallucinate?

## Verdict

The **on-chain math (what actually runs in every trade/rebalance) is faithful to the paper.**
The **frontend's λ\*/"W-curve" visualizations are placeholders that contradict the paper's
headline result** (they draw a dome / S-curve instead of the W-shape). The numeric λ value the
UI displays is read from the chain and is correct; only the *curves drawn around it* are fake.

---

## ✅ Correct — matches the paper exactly

| Spec formula | Implementation | Status |
|---|---|---|
| φ(z)=e^(−z²/2)/√(2π) | `contracts-stylus/src/math/gaussian.rs::phi`, `OmniverseMathSolidity.phi` | ✅ |
| Φ(z) (Abramowitz & Stegun 26.2.17) | `gaussian.rs::big_phi`, `OmniverseMathSolidity.Phi` | ✅ |
| Φ⁻¹(p) | Rust: Acklam + Halley (`gaussian.rs::phi_inv`) · Solidity: 96-iter bisection on [−8,8] (`PhiInv`) | ✅ (see note 2) |
| v(z)=φ(z)+z(2Φ(z)−1) | `lambda.rs::pool_value`, `OmniverseMathSolidity.poolValue` | ✅ |
| γ_G=γ'/(2·v(z)·φ(z)) | both kernels, with v·φ clamp away from 0 | ✅ |
| **λ\*=(1+√(1+2γ_G))/(1+γ_G+√(1+2γ_G))** | `lambda.rs::lambda_star_gaussian`, `OmniverseMathSolidity.lambdaStarGaussian` | ✅ exact |
| invariant (y−x)Φ(z)+L·φ(z)−y=0 | `PmAmmPool._invariantResidual` / `_invariantAt` / `solveSwap` | ✅ |
| z=(y−x)/L, P=Φ(z) | `PmAmmPool._zFromReserves`, `currentPrice` | ✅ |
| L_t=L₀·√(T−t) (time-decay liquidity) | `PmAmmPool._liquidityAt` | ✅ |
| R_active=λ·R_total split | `PmAmmPool._rebalance` (xActive=xTotal·λ/WAD …) | ✅ |
| near-resolution λ→0 floor | `P_BOUNDARY` / `LAMBDA_MIN` guards in both kernels | ✅ |

The real λ\* applied on every rebalance is therefore the correct W-shaped curve.

---

## ❌ Frontend curves are decorative and contradict the paper

The paper's central claim (§6–7) is that λ\*(P) is **W-shaped**: symmetric, local maxima at
P≈0.16 and P≈0.84, a local **minimum at P=0.5**, collapsing to ~0 at P→0/1. §7 explicitly calls
the dome shape "a common misconception." The frontend draws the misconception:

| Location | Code | Problem |
|---|---|---|
| `frontend/src/routes/explorer.tsx:32` `lambdaStar()` | `0.5 + 0.5·tanh(γ·(P−0.5))` − bump | Monotonic **S-curve**, asymmetric (~0 at P→0 but ~1 at P→1). `/explorer` is pitched as "the live λ\*(P) math surface." |
| `frontend/src/components/w-curve-live.tsx:73` | `y = (4·p·(1−p))^exponent` | **Dome** peaking at P=0.5 — exactly where the paper says λ\* is at its *minimum*. Component named `WCurve`. |
| `frontend/src/routes/markets.$id.tsx:469` | `lambda = 0.42 + 0.36·gaussian_bump` | Hardcoded magic-number curve, not the real formula. |

These are SVGs computed in JS, disconnected from the kernel. No φ/Φ/Φ⁻¹/γ_G/v(z) exists in the
frontend. Provenance: introduced with the redesigned frontend (commits `ea4edec`, `55ec670`),
not the math kernel.

**Fix (recommended):** port the real λ\*(P) to TS, or sweep `lambdaStarGaussian` from the
contract over P∈(0,1), and feed that to `w-curve-live.tsx` / `explorer.tsx` so they render the
genuine W-shape that the contracts actually compute.

---

## ❓ One on-chain item worth a sanity check (not clearly a bug)

Initial seeding (`PmAmmPool` constructor / `addLiquidity`) asserts only `z∈[−8,8]`
(`_assertKernelBounds`) — it **never asserts the invariant residual** at seed time (the residual
is only enforced after `solveSwap` on a trade). The paper's per-unit-L reserves are
x̄(0)=ȳ(0)=φ(0)≈0.399, so an on-curve P=0.5 seed with L=5000 wants x=y≈1995, but the seed script
uses x=y=5000 — ~2.5× off the invariant surface. P=0.5 still reports correctly (by symmetry) and
the first `solveSwap` snaps to the curve, so the demo works, but the first trade's fill is
technically distorted. Decide whether that's acceptable for the demo.

---

## 🧹 Two over-flags dismissed (not bugs)

1. **"Marginal price φ_x/φ_y is missing."** Not a bug — for this invariant the marginal price
   *is* Φ(z), which `currentPrice` returns.
2. **"Φ⁻¹ should be 50-iter bisection per Table 4."** The kernels use Acklam+Halley (Rust) and
   96-iter bisection (Solidity) — equal-or-better accuracy. Table 4's "50-iter bisection" was one
   suggested implementation, not a requirement.
