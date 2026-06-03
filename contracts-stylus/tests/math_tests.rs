//! Comprehensive tests for OmniverseMath.
//! Values verified against Python scipy.stats.norm and Wolfram Alpha.

#[cfg(test)]
mod tests {
    use stylus_sdk::alloy_primitives::{I256, U256};
    use omniverse_math::wad::*;
    use omniverse_math::math::exp::{exp, exp2, log2, ln};
    use omniverse_math::math::sqrt::{sqrt_u, wad_sqrt, msb};
    use omniverse_math::math::gaussian::{phi, big_phi, phi_inv};
    use omniverse_math::math::solver::solve_swap;
    use omniverse_math::math::lambda::{pool_value, lambda_star_gaussian};

    fn i(v: i128) -> I256 { I256::try_from(v).unwrap() }
    fn u(v: u128) -> U256 { U256::from(v) }

    /// Check |actual - expected| <= tolerance
    fn assert_approx_u(actual: U256, expected: U256, tol: U256, msg: &str) {
        let diff = if actual > expected { actual - expected } else { expected - actual };
        assert!(diff <= tol, "{}: expected ~{}, got {}, diff {} > tol {}", msg, expected, actual, diff, tol);
    }

    fn assert_approx_i(actual: I256, expected: I256, tol: U256, msg: &str) {
        let diff = if actual > expected { actual - expected } else { expected - actual };
        let diff_u: U256 = diff.try_into().unwrap();
        assert!(diff_u <= tol, "{}: expected ~{}, got {}, diff {} > tol {}", msg, expected, actual, diff_u, tol);
    }

    // ── MSB tests ────────────────────────────────────────────────────────────

    #[test]
    fn test_msb() {
        assert_eq!(msb(U256::ZERO), 0);
        assert_eq!(msb(u(1)), 0);
        assert_eq!(msb(u(2)), 1);
        assert_eq!(msb(u(4)), 2);
        assert_eq!(msb(u(255)), 7);
        assert_eq!(msb(u(256)), 8);
        assert_eq!(msb(u(1_000_000_000_000_000_000)), 59); // ~2^59.79
    }

    // ── sqrt tests ───────────────────────────────────────────────────────────

    #[test]
    fn test_sqrt_u_basic() {
        assert_eq!(sqrt_u(U256::ZERO), U256::ZERO);
        assert_eq!(sqrt_u(u(1)), u(1));
        assert_eq!(sqrt_u(u(4)), u(2));
        assert_eq!(sqrt_u(u(9)), u(3));
        assert_eq!(sqrt_u(u(100)), u(10));
        // Non-perfect: floor
        assert_eq!(sqrt_u(u(2)), u(1));
        assert_eq!(sqrt_u(u(8)), u(2));
    }

    #[test]
    fn test_wad_sqrt() {
        // sqrt(4 WAD) = 2 WAD
        let four_wad = u(4_000_000_000_000_000_000);
        let result = wad_sqrt(four_wad);
        assert_approx_u(result, u(2_000_000_000_000_000_000), u(1), "sqrt(4)");

        // sqrt(1 WAD) = 1 WAD
        let result = wad_sqrt(WAD);
        assert_approx_u(result, WAD, u(1), "sqrt(1)");
    }

    // ── exp tests ────────────────────────────────────────────────────────────

    #[test]
    fn test_exp_zero() {
        // exp(0) = 1 WAD
        let result = exp(I256::ZERO);
        assert_approx_i(result, i(1_000_000_000_000_000_000), u(1_000), "exp(0)");
    }

    #[test]
    fn test_exp_neg_one() {
        // exp(-1) = 0.367879441171442... WAD
        let result = exp(i(-1_000_000_000_000_000_000));
        assert_approx_i(result, i(367_879_441_171_442_321), u(1_000_000_000), "exp(-1)");
    }

    #[test]
    fn test_exp_neg_half() {
        // exp(-0.5) = 0.606530659712633... WAD
        let result = exp(i(-500_000_000_000_000_000));
        assert_approx_i(result, i(606_530_659_712_633_423), u(1_000_000_000), "exp(-0.5)");
    }

    #[test]
    fn test_exp_very_negative() {
        // exp(-32) ≈ 1.266e-14 → ~12664 in WAD. Should be tiny but nonzero.
        let result = exp(i(-32_000_000_000_000_000_000));
        assert!(result > I256::ZERO, "exp(-32) should be positive");
        assert!(result < i(1_000_000), "exp(-32) should be tiny");
    }

    #[test]
    fn test_exp_below_threshold_returns_zero() {
        // exp(-42) should return 0 (below threshold)
        let result = exp(i(-42_000_000_000_000_000_000));
        assert_eq!(result, I256::ZERO, "exp(-42) should be 0");
    }

    #[test]
    fn test_exp2_basic() {
        // 2^0 = 1
        assert_approx_i(exp2(I256::ZERO), i(1_000_000_000_000_000_000), u(1000), "exp2(0)");

        // 2^1 = 2
        assert_approx_i(exp2(i(1_000_000_000_000_000_000)), i(2_000_000_000_000_000_000), u(1000), "exp2(1)");

        // 2^(-1) = 0.5
        assert_approx_i(exp2(i(-1_000_000_000_000_000_000)), i(500_000_000_000_000_000), u(1_000_000_000), "exp2(-1)");
    }

    // ── log2 / ln tests ──────────────────────────────────────────────────────

    #[test]
    fn test_log2_basic() {
        // log2(1) = 0
        assert_eq!(log2(i(1_000_000_000_000_000_000)), I256::ZERO);

        // log2(2) = 1
        assert_approx_i(log2(i(2_000_000_000_000_000_000)), i(1_000_000_000_000_000_000), u(1_000), "log2(2)");
    }

    #[test]
    fn test_ln_basic() {
        // ln(1) = 0
        assert_eq!(ln(i(1_000_000_000_000_000_000)), I256::ZERO);

        // ln(e) ≈ 1. e ≈ 2.718281828459045 WAD
        let e_wad = i(2_718_281_828_459_045_235);
        let result = ln(e_wad);
        assert_approx_i(result, i(1_000_000_000_000_000_000), u(1_000_000_000), "ln(e)");
    }

    // ── phi (PDF) tests ──────────────────────────────────────────────────────

    #[test]
    fn test_phi_zero() {
        // φ(0) = 1/√(2π) ≈ 0.398942280401432677
        let result = phi(I256::ZERO);
        assert_approx_u(result, u(398_942_280_401_432_677), u(1_000_000_000), "phi(0)");
    }

    #[test]
    fn test_phi_one() {
        // φ(1) ≈ 0.241970724519143365
        let result = phi(i(1_000_000_000_000_000_000));
        assert_approx_u(result, u(241_970_724_519_143_365), u(1_000_000_000), "phi(1)");
    }

    #[test]
    fn test_phi_symmetry() {
        // φ(-z) = φ(z) for all z
        for z_val in [0i128, 500_000_000_000_000_000, 1_000_000_000_000_000_000,
                       2_000_000_000_000_000_000, 5_000_000_000_000_000_000] {
            let pos = phi(i(z_val));
            let neg = phi(i(-z_val));
            assert_eq!(pos, neg, "phi symmetry failed for z={}", z_val);
        }
    }

    #[test]
    fn test_phi_clamp() {
        // φ(±9) = 0 (outside [-8, 8])
        assert_eq!(phi(i(9_000_000_000_000_000_000)), U256::ZERO);
        assert_eq!(phi(i(-9_000_000_000_000_000_000)), U256::ZERO);
    }

    // ── big_phi (CDF) tests ──────────────────────────────────────────────────

    #[test]
    fn test_big_phi_zero() {
        // Φ(0) = 0.5
        let result = big_phi(I256::ZERO);
        assert_approx_u(result, u(500_000_000_000_000_000), u(100_000_000_000), "Phi(0)");
    }

    #[test]
    fn test_big_phi_1_96() {
        // Φ(1.96) ≈ 0.975002104859169542
        let result = big_phi(i(1_960_000_000_000_000_000));
        assert_approx_u(result, u(975_002_104_859_169_542), u(1_000_000_000_000), "Phi(1.96)");
    }

    #[test]
    fn test_big_phi_symmetry() {
        // Φ(z) + Φ(-z) = 1 for all z
        for z_val in [0i128, 500_000_000_000_000_000, 1_000_000_000_000_000_000,
                       2_000_000_000_000_000_000, 3_000_000_000_000_000_000,
                       5_000_000_000_000_000_000, 7_900_000_000_000_000_000] {
            let pos = big_phi(i(z_val));
            let neg = big_phi(i(-z_val));
            let sum = pos + neg;
            assert_approx_u(sum, WAD, u(1_000_000_000_000), &format!("Phi(z)+Phi(-z)=1 for z={}", z_val));
        }
    }

    #[test]
    fn test_big_phi_extremes() {
        // Φ(-8) → 0, Φ(8) → WAD
        assert_eq!(big_phi(i(-8_000_000_000_000_000_000)), U256::ZERO);
        assert_eq!(big_phi(i(8_000_000_000_000_000_000)), WAD);
    }

    #[test]
    fn test_big_phi_negative() {
        // Φ(-1) ≈ 0.158655253931457
        let result = big_phi(i(-1_000_000_000_000_000_000));
        assert_approx_u(result, u(158_655_253_931_457_051), u(1_000_000_000_000), "Phi(-1)");
    }

    // ── phi_inv (Inverse CDF) tests ──────────────────────────────────────────

    #[test]
    fn test_phi_inv_half() {
        // Φ⁻¹(0.5) = 0
        let result = phi_inv(u(500_000_000_000_000_000));
        assert_approx_i(result, I256::ZERO, u(2_000_000_000), "phiInv(0.5)");
    }

    #[test]
    fn test_phi_inv_975() {
        // Φ⁻¹(0.975) ≈ 1.9599639845400...
        let result = phi_inv(u(975_000_000_000_000_000));
        assert_approx_i(result, i(1_959_963_984_540_054_235), u(10_000_000_000_000), "phiInv(0.975)");
    }

    #[test]
    fn test_phi_inv_roundtrip() {
        // Φ(Φ⁻¹(p)) ≈ p
        for p_val in [1_000_000_000_000_000u128,  // 0.001
                       10_000_000_000_000_000,     // 0.01
                       100_000_000_000_000_000,    // 0.1
                       250_000_000_000_000_000,    // 0.25
                       500_000_000_000_000_000,    // 0.5
                       750_000_000_000_000_000,    // 0.75
                       900_000_000_000_000_000,    // 0.9
                       990_000_000_000_000_000,    // 0.99
                       999_000_000_000_000_000] {  // 0.999
            let p = u(p_val);
            let z = phi_inv(p);
            let p_recovered = big_phi(z);
            assert_approx_u(p_recovered, p, u(1_000_000_000_000), &format!("roundtrip p={}", p_val));
        }
    }

    #[test]
    fn test_phi_inv_symmetry() {
        // Φ⁻¹(p) = -Φ⁻¹(1-p)
        for p_val in [100_000_000_000_000_000u128, 250_000_000_000_000_000, 400_000_000_000_000_000] {
            let z1 = phi_inv(u(p_val));
            let z2 = phi_inv(u(1_000_000_000_000_000_000 - p_val));
            let sum = z1 + z2;
            let sum_abs = i256_abs(sum);
            assert!(sum_abs < u(1_000_000_000_000), "phiInv symmetry failed for p={}", p_val);
        }
    }

    #[test]
    #[should_panic]
    fn test_phi_inv_zero_reverts() {
        phi_inv(U256::ZERO);
    }

    #[test]
    #[should_panic]
    fn test_phi_inv_one_reverts() {
        phi_inv(WAD);
    }

    // ── solve_swap tests ─────────────────────────────────────────────────────

    #[test]
    fn test_solve_swap_balanced() {
        // For z=0 (balanced), on the invariant: y = L·φ(0) ≈ 0.3989·L
        // With L = 1e18, y ≈ 398942280401432677, x = y
        let ell = u(1_000_000_000_000_000_000u128);
        let y0 = u(398_942_280_401_432_677u128);
        let x0 = y0;
        
        // User buys NO: adds 1e16 to x reserve  
        let amount_in = u(10_000_000_000_000_000u128); // 0.01 * WAD
        let x1 = x0 + amount_in;

        let y1 = solve_swap(x1, y0, ell);

        // y1 should be less than y0 (user receives YES tokens)
        assert!(y1 < y0, "y1 should decrease when x increases");
        
        // Verify invariant
        let y1_i = u256_to_i256(y1);
        let x1_i = u256_to_i256(x1);
        let ell_i = u256_to_i256(ell);
        let diff = y1_i - x1_i;
        let z = wad_div(diff, ell_i);
        let f_val = wad_mul(diff, u256_to_i256(big_phi(z)))
                  + wad_mul(ell_i, u256_to_i256(phi(z)))
                  - y1_i;
        let f_abs = i256_abs(f_val);
        assert!(f_abs < u(100_000), "invariant not satisfied: |f| = {}", f_abs);
    }

    #[test]
    fn test_solve_swap_after_buy_no() {
        // Start from balanced pool, user buys a larger amount of NO
        let ell = u(1_000_000_000_000_000_000u128);
        let y0 = u(398_942_280_401_432_677u128);
        let x0 = y0;
        
        let amount_in = u(100_000_000_000_000_000u128); // 0.1 * WAD
        let x1 = x0 + amount_in;

        let y1 = solve_swap(x1, y0, ell);
        assert!(y1 < y0, "y1 should decrease when x increases");
    }

    #[test]
    fn test_solve_swap_small_ell() {
        // Near-expiry: small liquidity but reserves proportionally smaller
        let ell = u(1_000_000_000_000_000u128); // 0.001 WAD
        // On invariant with z=0: y = ell * phi(0) ≈ 0.000399 WAD
        let y0 = u(398_942_280_401_432u128);
        let x0 = y0;
        
        let amount_in = u(1_000_000_000_000u128); // tiny trade
        let x1 = x0 + amount_in;

        let y1 = solve_swap(x1, y0, ell);
        assert!(y1 > U256::ZERO, "should produce nonzero y1");
    }

    // ── pool_value tests ─────────────────────────────────────────────────────

    #[test]
    fn test_pool_value_zero() {
        // v(0) = φ(0) + 0·(2Φ(0)-1) = φ(0) = 1/√(2π)
        let result = pool_value(I256::ZERO);
        assert_approx_u(result, u(398_942_280_401_432_677), u(1_000_000_000), "v(0)");
    }

    #[test]
    fn test_pool_value_symmetry() {
        // v(-z) = v(z)
        for z_val in [500_000_000_000_000_000i128, 1_000_000_000_000_000_000,
                       2_000_000_000_000_000_000, 3_000_000_000_000_000_000] {
            let pos = pool_value(i(z_val));
            let neg = pool_value(i(-z_val));
            assert_approx_u(pos, neg, u(1_000_000_000), &format!("v(z) symmetry at z={}", z_val));
        }
    }

    #[test]
    fn test_pool_value_positive() {
        // v(z) should always be positive for |z| < 8
        for z_val in [-3_000_000_000_000_000_000i128, -1_000_000_000_000_000_000,
                       0, 1_000_000_000_000_000_000, 3_000_000_000_000_000_000] {
            let result = pool_value(i(z_val));
            assert!(result > U256::ZERO, "v(z) must be positive for z={}", z_val);
        }
    }

    // ── lambda_star tests ────────────────────────────────────────────────────

    #[test]
    fn test_lambda_star_mid() {
        // λ*(0.5) with γ'=2 → ~0.427
        let gamma_prime = u(2_000_000_000_000_000_000); // 2.0 WAD
        let p_true = u(500_000_000_000_000_000);        // 0.5 WAD
        let result = lambda_star_gaussian(gamma_prime, p_true);
        // Expected ~427e15 (0.427 WAD)
        assert_approx_u(result, u(427_000_000_000_000_000), u(50_000_000_000_000_000), "lambda*(0.5)");
    }

    #[test]
    fn test_lambda_star_tail() {
        // λ*(0.01) with γ'=2 → ~0.295
        let gamma_prime = u(2_000_000_000_000_000_000);
        let p_true = u(10_000_000_000_000_000); // 0.01 WAD
        let result = lambda_star_gaussian(gamma_prime, p_true);
        // Expected ~295e15 (0.295 WAD)
        assert_approx_u(result, u(295_000_000_000_000_000), u(50_000_000_000_000_000), "lambda*(0.01)");
    }

    #[test]
    fn test_lambda_star_symmetry() {
        // λ*(p) = λ*(1-p)
        let gamma_prime = u(2_000_000_000_000_000_000);
        for p_val in [100_000_000_000_000_000u128, 200_000_000_000_000_000, 300_000_000_000_000_000] {
            let l1 = lambda_star_gaussian(gamma_prime, u(p_val));
            let l2 = lambda_star_gaussian(gamma_prime, u(1_000_000_000_000_000_000 - p_val));
            assert_approx_u(l1, l2, u(10_000_000_000_000_000), &format!("lambda symmetry p={}", p_val));
        }
    }

    #[test]
    fn test_lambda_star_clamp_near_zero() {
        // Very small p → λ* clamped to LAMBDA_MIN (0.05)
        let gamma_prime = u(2_000_000_000_000_000_000);
        let p_true = u(10_000_000_000_000); // 0.00001 — below P_BOUNDARY
        let result = lambda_star_gaussian(gamma_prime, p_true);
        assert_eq!(result, u(50_000_000_000_000_000), "near-zero p should return LAMBDA_MIN");
    }

    #[test]
    fn test_lambda_star_in_range() {
        // λ* should always be in [0.05, 1.0]
        let gamma_prime = u(2_000_000_000_000_000_000);
        for p_val in [1_000_000_000_000_000u128, 50_000_000_000_000_000, 200_000_000_000_000_000,
                       500_000_000_000_000_000, 800_000_000_000_000_000, 950_000_000_000_000_000,
                       999_000_000_000_000_000] {
            let result = lambda_star_gaussian(gamma_prime, u(p_val));
            assert!(result >= u(50_000_000_000_000_000), "lambda < 0.05 at p={}", p_val);
            assert!(result <= WAD, "lambda > 1.0 at p={}", p_val);
        }
    }
}
