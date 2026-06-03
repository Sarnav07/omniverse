# OmniverseMath — Implementation Walkthrough

## What was built

A production-grade, stateless Rust/Stylus WASM contract implementing the Gaussian pm-AMM math kernel for the OMNIVERSE prediction market protocol.

## Architecture

```
contracts-stylus/
├── Cargo.toml          # opt-level=z, lto, panic=abort, strip
├── src/
│   ├── lib.rs          # Entrypoint, 6 ABI functions via #[public]
│   ├── wad.rs          # WAD (1e18) fixed-point arithmetic
│   └── math/
│       ├── mod.rs      # Module re-exports
│       ├── sqrt.rs     # MSB + Babylonian sqrt (7 Newton iterations)
│       ├── exp.rs      # exp2 (64 magic constants), exp, log2, ln
│       ├── gaussian.rs # φ(z), Φ(z), Φ⁻¹(p)
│       ├── solver.rs   # Newton-Raphson invariant solver
│       └── lambda.rs   # v(z), λ*(γ', p)
└── tests/
    └── math_tests.rs   # 37 comprehensive tests
```

## ABI (Frozen Interface)

| Solidity Selector | Rust Method | Signature |
|---|---|---|
| `phi(int256)` | `phi` | `z → φ(z)` |
| `Phi(int256)` | `big_phi` | `z → Φ(z)` |
| `PhiInv(uint256)` | `phi_inv` | `p → Φ⁻¹(p)` |
| `solveSwap(uint256,uint256,uint256)` | `solve_swap` | `(x1, y0, ℓ) → y1` |
| `poolValue(int256)` | `pool_value` | `z → v(z)` |
| `lambdaStarGaussian(uint256,uint256)` | `lambda_star_gaussian` | `(γ', p) → λ*` |

## Key Bugs Found & Fixed

1. **`exp2_192x64` initial value** — Bit 191 was placed in U256 limb[1] instead of limb[2]. Since U256 limbs are little-endian, `2^191` lives in the third limb. This caused `exp(0) = 0` instead of `1e18`, cascading failures through all Gaussian functions.

2. **`WAD_SQUARED` constant** — Second limb was `54210108624275` but should be `54210108624275221` (missing 3 digits). Caused `exp2(-x)` to return values ~1000x too small.

3. **Solver bracket direction** — Since `f'(y) = Φ(z) - 1 < 0` (monotonically decreasing), `f(y) > 0` means the root is to the right → `lo = y`. The original code had this inverted, causing Newton steps to be rejected by the bisection guard.

4. **`alloy_primitives` version mismatch** — Our explicit `v0.8` dep conflicted with stylus-sdk's internal `v1.6.0`. Fixed by removing the direct dependency and using re-exports from `stylus_sdk::alloy_primitives`.

5. **Selector collision** — `phi` and `Phi` both lowercased to the same ABI selector. Fixed with `#[selector(name = "Phi")]`.

## Test Results

```
test result: ok. 37 passed; 0 failed; 0 ignored
```

Tests cover:
- **Primitives**: MSB, sqrt, exp, exp2, log2, ln at known values
- **Gaussian**: PDF symmetry, CDF symmetry (Φ(z)+Φ(-z)=1), CDF known values, inverse CDF round-trip
- **Solver**: Balanced swap, buy-NO, small liquidity, invariant verification
- **Lambda**: Mid-range, tail, symmetry, range clamping

## Build Artifacts

- **WASM size**: 115KB (uncompressed), well within 128KB Stylus limit
- **Zero floats**: All arithmetic uses U256/I256 integer operations
- **Profile**: `opt-level=z`, LTO, `panic=abort`, strip — minimal binary
