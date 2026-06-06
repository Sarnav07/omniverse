//! OmniverseMath — Stateless Gaussian math kernel for the pm-AMM.
//!
//! Deployed as a Stylus (Rust→WASM) contract on Arbitrum.
//! All functions are pure: no storage, no side effects.
//! All arithmetic is fixed-point WAD (1e18) using I256/U256.
//! Zero floating-point operations (would brick on-chain activation).

#![cfg_attr(not(any(feature = "export-abi", test)), no_main)]
#![cfg_attr(not(any(feature = "export-abi", test)), no_std)]
#[macro_use]
extern crate alloc;

pub mod wad;
pub mod math;

use alloc::vec::Vec;
use stylus_sdk::alloy_primitives::{I256, U256};
use stylus_sdk::prelude::*;

sol_storage! {
    #[entrypoint]
    pub struct OmniverseMath {
        // Stateless contract — no storage fields.
    }
}

#[public]
impl OmniverseMath {
    /// Standard normal PDF: φ(z) = exp(-z²/2) / √(2π)
    /// Clamped to 0 for |z| > 8. Rounds down.
    pub fn phi(&self, z: I256) -> Result<U256, Vec<u8>> {
        Ok(math::gaussian::phi(z))
    }

    /// Standard normal CDF: Φ(z)
    /// A&S 26.2.17 approximation. Returns value in [0, WAD].
    #[selector(name = "Phi")]
    pub fn big_phi(&self, z: I256) -> Result<U256, Vec<u8>> {
        Ok(math::gaussian::big_phi(z))
    }

    /// Inverse standard normal CDF: Φ⁻¹(p)
    /// Acklam + Halley refinement. Reverts on p ≤ 0 or p ≥ 1.
    #[selector(name = "PhiInv")]
    pub fn phi_inv(&self, p: U256) -> Result<I256, Vec<u8>> {
        Ok(math::gaussian::phi_inv(p))
    }

    /// Solve the pm-AMM invariant for y1 given new x1.
    /// f(y) = (y-x1)·Φ((y-x1)/ℓ) + ℓ·φ((y-x1)/ℓ) - y = 0
    /// Returns y1 rounded UP (pool-favoring). Reverts on non-convergence.
    #[selector(name = "solveSwap")]
    pub fn solve_swap(&self, x1: U256, y0: U256, ell: U256) -> Result<U256, Vec<u8>> {
        Ok(math::solver::solve_swap(x1, y0, ell))
    }

    /// Pool value per unit L: v(z) = φ(z) + z·(2Φ(z) − 1)
    #[selector(name = "poolValue")]
    pub fn pool_value(&self, z: I256) -> Result<U256, Vec<u8>> {
        Ok(math::lambda::pool_value(z))
    }

    /// Optimal activeness: λ*(γ', P_true)
    /// Returns λ* in WAD, clamped to [0.05, 1.0].
    #[selector(name = "lambdaStarGaussian")]
    pub fn lambda_star_gaussian(&self, gamma_prime: U256, p_true: U256) -> Result<U256, Vec<u8>> {
        Ok(math::lambda::lambda_star_gaussian(gamma_prime, p_true))
    }
}
