//! Newton-Raphson solver for the pm-AMM Gaussian invariant.
//!
//! Invariant: f(y) = (y - x) · Φ((y - x)/ℓ) + ℓ · φ((y - x)/ℓ) - y = 0
//! Derivative: f'(y) = Φ((y - x)/ℓ) - 1, always in (-1, 0) → unique root.

use stylus_sdk::alloy_primitives::U256;
use crate::wad::*;
use crate::math::gaussian::{phi, big_phi};

/// Minimum liquidity to prevent division-by-zero.
const L_MIN: U256 = U256::from_limbs([1_000_000u64, 0, 0, 0]); // 1e6 wei

/// Convergence tolerance: |f(y)| must be below this.
const EPSILON: U256 = U256::from_limbs([10_000u64, 0, 0, 0]); // 1e4 wei

/// Maximum Newton iterations before reverting.
const MAX_ITER: u32 = 40;

/// Solve for y1 given x1 and ell, such that the pm-AMM invariant holds:
///   f(y) = (y - x1) · Φ((y - x1)/ℓ) + ℓ · φ((y - x1)/ℓ) - y = 0
///
/// Arguments:
/// - x1: new x-reserve after trade (unsigned WAD)
/// - y0: current y-reserve before trade (unsigned WAD, used as initial guess)
/// - ell: effective liquidity parameter (unsigned WAD, floored to L_MIN)
///
/// Returns y1 (unsigned WAD), rounded UP (pool-favoring).
/// Reverts if the solver does not converge within MAX_ITER iterations.
pub fn solve_swap(x1: U256, y0: U256, ell: U256) -> U256 {
    // Floor liquidity
    let ell = if ell < L_MIN { L_MIN } else { ell };

    // Bracket: y must be in [0, x1 + y0 + ell] approximately.
    // Use generous bounds.
    let mut lo = U256::ZERO;
    let mut hi = x1 + y0 + ell;

    // Initial guess: current y-reserve
    let mut y = y0;

    // Ensure y is within bracket
    if y < lo {
        y = lo;
    }
    if y > hi {
        y = hi;
    }
    if y.is_zero() {
        // Avoid starting at exactly 0; use midpoint
        y = (lo + hi) / U256::from(2u8);
    }

    let x1_i = u256_to_i256(x1);
    let ell_i = u256_to_i256(ell);

    for _ in 0..MAX_ITER {
        let y_i = u256_to_i256(y);

        // z = (y - x1) / ell (signed WAD)
        let diff = y_i - x1_i;
        let z = wad_div(diff, ell_i);

        // Φ(z) and φ(z)
        let phi_z = phi(z);             // unsigned WAD
        let big_phi_z = big_phi(z);     // unsigned WAD

        // f(y) = (y - x1) * Φ(z) + ell * φ(z) - y  (all in WAD, signed)
        let term1 = wad_mul(diff, u256_to_i256(big_phi_z));
        let term2 = wad_mul(ell_i, u256_to_i256(phi_z));
        let f_val = term1 + term2 - y_i;

        // Check convergence
        let f_abs = i256_abs(f_val);
        if f_abs < EPSILON {
            // Converged. Round y UP for pool-favoring.
            if f_val.is_positive() {
                return y + U256::from(1u8);
            }
            return y;
        }

        // f'(y) = Φ(z) - 1 (always in (-WAD, 0) as WAD-scaled)
        let f_prime = u256_to_i256(big_phi_z) - WAD_I;

        // Guard: if f_prime is zero (shouldn't happen since Φ(z) < 1 for finite z)
        if f_prime.is_zero() {
            // Fall back to bisection
            // f decreasing: f>0 → lo=y, f<0 → hi=y
            if f_val.is_positive() { lo = y; } else { hi = y; }
            y = (lo + hi) / U256::from(2u8);
            continue;
        }

        // Newton step: delta = f(y) / f'(y)
        // f_val has units of tokens (same as y). f_prime is dimensionless (WAD-scaled).
        // So delta = f_val * WAD / f_prime to cancel the WAD scaling in f_prime.
        let delta = wad_div(f_val, f_prime);
        let y_next_i = y_i - delta;

        // Update bracket based on sign of f (f is monotonically decreasing)
        if f_val.is_positive() { lo = y; } else { hi = y; }

        // Bisection guard: if Newton sends y out of bounds, bisect instead.
        if y_next_i.is_negative() || y_next_i > u256_to_i256(hi) || y_next_i < u256_to_i256(lo) {
            y = (lo + hi) / U256::from(2u8);
        } else {
            y = y_next_i.try_into().unwrap();
        }
    }

    // Non-convergence: REVERT. Never silently return a bad value.
    panic!("solveSwap: did not converge within MAX_ITER");
}
