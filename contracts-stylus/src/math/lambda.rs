//! Dynamic optimal activeness parameter λ* for the Gaussian pm-AMM.
//!
//! λ*(P) = (1 + √(1 + 2γ_G)) / (1 + γ_G + √(1 + 2γ_G))
//! where γ_G = γ' / (2 · v(z) · φ(z))
//! and v(z) = φ(z) + z · (2Φ(z) − 1)  [pool value per unit L]

use stylus_sdk::alloy_primitives::{I256, U256};
use crate::wad::*;
use crate::math::gaussian::{phi, big_phi, phi_inv};
use crate::math::sqrt::wad_sqrt;

/// Minimum φ(z) to prevent division by zero in γ_G.
/// 1e-9 in WAD = 1e9
const PHI_MIN: U256 = U256::from_limbs([1_000_000_000u64, 0, 0, 0]);

/// Minimum λ* clamp: 0.05 in WAD
const LAMBDA_MIN: U256 = U256::from_limbs([50_000_000_000_000_000u64, 0, 0, 0]);

/// Boundary for "near resolution" — if p < P_BOUNDARY or p > 1-P_BOUNDARY,
/// we return LAMBDA_MIN directly to avoid numerical issues.
/// 1e-4 in WAD = 1e14
const P_BOUNDARY: U256 = U256::from_limbs([100_000_000_000_000u64, 0, 0, 0]);

/// Pool value per unit L: v(z) = φ(z) + z · (2Φ(z) − 1).
/// v(z) is symmetric: v(-z) = v(z). Always positive.
/// Input z is signed WAD. Output is unsigned WAD.
pub fn pool_value(z: I256) -> U256 {
    let phi_z = phi(z);     // unsigned WAD
    let big_phi_z = big_phi(z); // unsigned WAD

    // 2Φ(z) - 1 (signed, in [-1, 1])
    let two_phi_minus_one = u256_to_i256(big_phi_z) * I256::try_from(2i64).unwrap() - WAD_I;

    // z * (2Φ(z) - 1) — signed
    let z_term = wad_mul(z, two_phi_minus_one);

    // v(z) = φ(z) + z*(2Φ(z)-1) — should be positive
    let result = u256_to_i256(phi_z) + z_term;

    if result.is_negative() {
        // Shouldn't happen for valid z, but clamp for safety
        U256::ZERO
    } else {
        result.try_into().unwrap()
    }
}

/// Compute λ*(P_true) given γ' (governance parameter) and p_true (probability).
///
/// Returns λ* in unsigned WAD, clamped to [LAMBDA_MIN, WAD].
/// If p_true is near 0 or 1, returns LAMBDA_MIN.
///
/// Arguments:
/// - gamma_prime: γ' in unsigned WAD (e.g., 2e18 for γ'=2)
/// - p_true: current probability in unsigned WAD, in (0, WAD)
pub fn lambda_star_gaussian(gamma_prime: U256, p_true: U256) -> U256 {
    // Near-resolution guard
    if p_true <= P_BOUNDARY || p_true >= WAD - P_BOUNDARY {
        return LAMBDA_MIN;
    }

    // z = Φ⁻¹(p_true)
    let z = phi_inv(p_true);

    // φ(z)
    let phi_z = phi(z);

    // Clamp φ(z) to prevent division by zero
    let phi_z = if phi_z < PHI_MIN { PHI_MIN } else { phi_z };

    // v(z) = pool_value(z)
    let v_z = pool_value(z);

    // Clamp v(z) similarly
    let v_z = if v_z < PHI_MIN { PHI_MIN } else { v_z };

    // γ_G = γ' / (2 · v(z) · φ(z))
    let two_v_phi = U256::from(2u8) * wad_mul_u(v_z, phi_z);
    if two_v_phi.is_zero() {
        return LAMBDA_MIN;
    }
    let gamma_g = wad_div_u(gamma_prime, two_v_phi);

    // disc = √(1 + 2·γ_G) in WAD
    let one_plus_2gamma = WAD + U256::from(2u8) * gamma_g;
    let disc = wad_sqrt(one_plus_2gamma);

    // λ* = (1 + disc) / (1 + γ_G + disc)
    let numerator = WAD + disc;
    let denominator = WAD + gamma_g + disc;

    if denominator.is_zero() {
        return LAMBDA_MIN;
    }

    let lambda = wad_div_u(numerator, denominator);

    // Clamp to [LAMBDA_MIN, WAD]
    if lambda < LAMBDA_MIN {
        LAMBDA_MIN
    } else if lambda > WAD {
        WAD
    } else {
        lambda
    }
}
