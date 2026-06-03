//! Gaussian distribution functions in WAD fixed-point.
//!
//! - phi(z):    Standard normal PDF φ(z) = exp(-z²/2) / √(2π)
//! - big_phi(z): Standard normal CDF Φ(z) via Abramowitz & Stegun 26.2.17
//! - phi_inv(p): Inverse CDF Φ⁻¹(p) via Acklam + Halley refinement

use stylus_sdk::alloy_primitives::{I256, U256};
use crate::wad::*;
use crate::math::exp::{exp, ln};
use crate::math::sqrt::wad_sqrt;

// ── Constants ────────────────────────────────────────────────────────────────

/// 8 * WAD — clamp boundary for z.
const EIGHT_WAD: U256 = U256::from_limbs([8_000_000_000_000_000_000u64, 0, 0, 0]);
const EIGHT_WAD_I: I256 = I256::from_raw(EIGHT_WAD);

/// 1/√(2π) in WAD = 0.3989422804014326... * 1e18
const INV_SQRT_2PI: U256 = U256::from_limbs([398_942_280_401_432_677u64, 0, 0, 0]);

/// A&S 26.2.17 constants (WAD-scaled)
const P_CONST: U256 = U256::from_limbs([231_641_900_000_000_000u64, 0, 0, 0]); // 0.2316419

// Polynomial coefficients — use functions to handle signed values safely.
fn b1() -> I256 { I256::try_from(319_381_530_000_000_000i128).unwrap() }   //  0.319381530
fn b2() -> I256 { I256::try_from(-356_563_782_000_000_000i128).unwrap() }  // -0.356563782
fn b3() -> I256 { I256::try_from(1_781_477_937_000_000_000i128).unwrap() } //  1.781477937
fn b4() -> I256 { I256::try_from(-1_821_255_978_000_000_000i128).unwrap() }// -1.821255978
fn b5() -> I256 { I256::try_from(1_330_274_429_000_000_000i128).unwrap() } //  1.330274429

// ── Acklam inverse CDF constants ─────────────────────────────────────────────

/// p_low = 0.02425 in WAD
const P_LOW: U256 = U256::from_limbs([24_250_000_000_000_000u64, 0, 0, 0]);
/// p_high = 0.97575 in WAD
const P_HIGH: U256 = U256::from_limbs([975_750_000_000_000_000u64, 0, 0, 0]);

// Central region numerator coefficients (a1..a6) — signed WAD
// a1 = -39.69683028665376
// a2 =  220.9460984245205
// a3 = -275.9285104469687
// a4 =  138.3577518672690
// a5 = -30.66479806614716
// a6 =  2.506628277459239

fn a1() -> I256 { I256::try_from(-39_696_830_286_653_760_000i128).unwrap() }
fn a2() -> I256 { I256::try_from(220_946_098_424_520_500_000i128).unwrap() }
fn a3() -> I256 { I256::try_from(-275_928_510_446_968_700_000i128).unwrap() }
fn a4() -> I256 { I256::try_from(138_357_751_867_269_000_000i128).unwrap() }
fn a5() -> I256 { I256::try_from(-30_664_798_066_147_160_000i128).unwrap() }
fn a6() -> I256 { I256::try_from(2_506_628_277_459_239_000i128).unwrap() }

// Central region denominator coefficients (b1..b5) — signed WAD
// b_inv1 = -54.47609879822406
// b_inv2 =  161.5858368580409
// b_inv3 = -155.6989798598866
// b_inv4 =  66.80131188771972
// b_inv5 = -13.28068155288572
// (b6 = 1, implicit)

fn bi1() -> I256 { I256::try_from(-54_476_098_798_224_060_000i128).unwrap() }
fn bi2() -> I256 { I256::try_from(161_585_836_858_040_900_000i128).unwrap() }
fn bi3() -> I256 { I256::try_from(-155_698_979_859_886_600_000i128).unwrap() }
fn bi4() -> I256 { I256::try_from(66_801_311_887_719_720_000i128).unwrap() }
fn bi5() -> I256 { I256::try_from(-13_280_681_552_885_720_000i128).unwrap() }

// Tail region coefficients (c1..c6, d1..d4) — signed WAD
// c1 = -0.007784894002430293
// c2 = -0.3223964580411365
// c3 = -2.400758277161838
// c4 = -2.549732539343734
// c5 =  4.374664141464968
// c6 =  2.938163982698783

fn c1() -> I256 { I256::try_from(-7_784_894_002_430_293i128).unwrap() }
fn c2() -> I256 { I256::try_from(-322_396_458_041_136_500i128).unwrap() }
fn c3() -> I256 { I256::try_from(-2_400_758_277_161_838_000i128).unwrap() }
fn c4() -> I256 { I256::try_from(-2_549_732_539_343_734_000i128).unwrap() }
fn c5() -> I256 { I256::try_from(4_374_664_141_464_968_000i128).unwrap() }
fn c6() -> I256 { I256::try_from(2_938_163_982_698_783_000i128).unwrap() }

// d1 = 0.007784695709041462
// d2 = 0.3224671290700398
// d3 = 2.445134137142996
// d4 = 3.754408661907416

fn d1() -> I256 { I256::try_from(7_784_695_709_041_462i128).unwrap() }
fn d2() -> I256 { I256::try_from(322_467_129_070_039_800i128).unwrap() }
fn d3() -> I256 { I256::try_from(2_445_134_137_142_996_000i128).unwrap() }
fn d4() -> I256 { I256::try_from(3_754_408_661_907_416_000i128).unwrap() }

// ── phi: Standard normal PDF ─────────────────────────────────────────────────

/// φ(z) = exp(-z²/2) / √(2π)
/// Input z is signed WAD. Output is unsigned WAD, rounded down.
/// Returns 0 for |z| > 8.
pub fn phi(z: I256) -> U256 {
    let abs_z = i256_abs(z);
    if abs_z > EIGHT_WAD {
        return U256::ZERO;
    }

    // z² = (z * z) / WAD
    let z_sq = wad_mul(z, z);

    // -z²/2
    let neg_half_z_sq = -z_sq / I256::try_from(2i64).unwrap();

    // exp(-z²/2) — result is positive, in WAD
    let e_val = exp(neg_half_z_sq);

    // Multiply by 1/√(2π) — both values are positive
    let e_u: U256 = e_val.try_into().unwrap();
    wad_mul_u(e_u, INV_SQRT_2PI)
}

// ── big_phi: Standard normal CDF ─────────────────────────────────────────────

/// Φ(z) = CDF of standard normal distribution.
/// Uses Abramowitz & Stegun 26.2.17 approximation.
/// Input z is signed WAD. Output is unsigned WAD in [0, WAD].
pub fn big_phi(z: I256) -> U256 {
    // Clamp extremes
    if z <= -EIGHT_WAD_I {
        return U256::ZERO;
    }
    if z >= EIGHT_WAD_I {
        return WAD;
    }

    let abs_z = i256_abs(z);
    let abs_z_i = u256_to_i256(abs_z);

    // t = WAD / (WAD + p * |z|)
    let p_times_z = wad_mul_u(P_CONST, abs_z);
    let denom = WAD + p_times_z;
    let t = wad_div_u(WAD, denom);
    let t_i = u256_to_i256(t);

    // Horner evaluation: poly = t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))))
    let mut poly = b5();
    poly = wad_mul(t_i, poly) + b4();
    poly = wad_mul(t_i, poly) + b3();
    poly = wad_mul(t_i, poly) + b2();
    poly = wad_mul(t_i, poly) + b1();
    poly = wad_mul(t_i, poly);

    // phi_val = phi(|z|)
    let phi_val = phi(abs_z_i);
    let phi_val_i = u256_to_i256(phi_val);

    // approx = WAD - phi(|z|) * poly
    let phi_times_poly = wad_mul(phi_val_i, poly);

    let approx_i = WAD_I - phi_times_poly;

    // Clamp to [0, WAD]
    let approx = if approx_i.is_negative() {
        U256::ZERO
    } else {
        let v: U256 = approx_i.try_into().unwrap();
        if v > WAD { WAD } else { v }
    };

    // Symmetry: Φ(-z) = 1 - Φ(|z|)
    if z.is_negative() {
        WAD - approx
    } else {
        approx
    }
}

// ── phi_inv: Inverse CDF ─────────────────────────────────────────────────────

/// Φ⁻¹(p): Inverse of the standard normal CDF.
/// Uses Acklam's rational approximation for the central region,
/// Acklam's tail approximation for the tails, plus one Halley refinement step.
/// Input p is unsigned WAD in (0, WAD). Reverts on p=0 or p>=WAD.
/// Output is signed WAD, clamped to [-8 WAD, 8 WAD].
pub fn phi_inv(p: U256) -> I256 {
    assert!(!p.is_zero(), "phiInv: p must be > 0");
    assert!(p < WAD, "phiInv: p must be < 1");

    let z_approx: I256;

    if p < P_LOW {
        // Lower tail
        z_approx = acklam_tail(p, false);
    } else if p > P_HIGH {
        // Upper tail: use symmetry
        z_approx = acklam_tail(WAD - p, true);
    } else {
        // Central region
        z_approx = acklam_central(p);
    }

    // Halley refinement: one step
    let z_refined = halley_step(z_approx, p);

    // Clamp to [-8, 8] WAD
    clamp_z(z_refined)
}

/// Acklam central region: p ∈ [P_LOW, P_HIGH]
fn acklam_central(p: U256) -> I256 {
    let p_i = u256_to_i256(p);
    let half = u256_to_i256(HALF_WAD);

    // q = p - 0.5
    let q = p_i - half;

    // r = q²
    let r = wad_mul(q, q);

    // Numerator: ((((a1*r + a2)*r + a3)*r + a4)*r + a5)*r + a6
    let mut num = a1();
    num = wad_mul(num, r) + a2();
    num = wad_mul(num, r) + a3();
    num = wad_mul(num, r) + a4();
    num = wad_mul(num, r) + a5();
    num = wad_mul(num, r) + a6();

    // Denominator: (((((b1*r + b2)*r + b3)*r + b4)*r + b5)*r + 1
    let mut den = bi1();
    den = wad_mul(den, r) + bi2();
    den = wad_mul(den, r) + bi3();
    den = wad_mul(den, r) + bi4();
    den = wad_mul(den, r) + bi5();
    den = wad_mul(den, r) + WAD_I;

    // z = q * num / den
    wad_mul(q, wad_div(num, den))
}

/// Acklam tail region. If `negate` is true, returns positive z (upper tail).
fn acklam_tail(p_tail: U256, negate: bool) -> I256 {
    // q = sqrt(-2 * ln(p_tail))
    let p_i = u256_to_i256(p_tail);
    let ln_p = ln(p_i);  // ln_p < 0 since p < 1
    let neg_2_ln_p = -I256::try_from(2i64).unwrap() * ln_p; // positive
    let q_u = wad_sqrt(neg_2_ln_p.try_into().unwrap());
    let q = u256_to_i256(q_u);

    // Numerator: (((((c1*q + c2)*q + c3)*q + c4)*q + c5)*q + c6
    let mut num = c1();
    num = wad_mul(num, q) + c2();
    num = wad_mul(num, q) + c3();
    num = wad_mul(num, q) + c4();
    num = wad_mul(num, q) + c5();
    num = wad_mul(num, q) + c6();

    // Denominator: ((((d1*q + d2)*q + d3)*q + d4)*q + 1
    let mut den = d1();
    den = wad_mul(den, q) + d2();
    den = wad_mul(den, q) + d3();
    den = wad_mul(den, q) + d4();
    den = wad_mul(den, q) + WAD_I;

    let z = wad_div(num, den);

    if negate { -z } else { z }
}

/// One step of Halley's method to refine z_approx.
/// z_new = z - (Φ(z) - p) * φ(z) / (φ(z)² + z * (Φ(z) - p) / 2)
fn halley_step(z: I256, p: U256) -> I256 {
    let phi_z = phi(z);
    let big_phi_z = big_phi(z);

    // error = Φ(z) - p (signed)
    let error = u256_to_i256(big_phi_z) - u256_to_i256(p);

    // If error is negligible, skip refinement
    let error_abs = i256_abs(error);
    if error_abs < U256::from(1_000_000u64) {
        return z;
    }

    let phi_i = u256_to_i256(phi_z);

    // Denominator: φ² + z * error / 2
    let phi_sq = wad_mul(phi_i, phi_i);
    let half_z_error = wad_mul(z, error) / I256::try_from(2i64).unwrap();
    let denom = phi_sq + half_z_error;

    if denom.is_zero() {
        return z;
    }

    // Numerator: error * φ(z)  (but we want to subtract error/φ-like correction)
    // Halley: z_new = z - error / (φ(z) - z·error/(2·something))
    // Standard form: z_new = z - (error / φ(z)) * (1 / (1 - z·error/(2·φ(z)²)))
    // Simplified: z_new = z - error·φ(z) / denom
    // where denom = φ(z)² + z·error/2

    // Wait, the standard Halley for CDF inversion is:
    // z_new = z - (Φ(z) - p) / φ(z) * correction
    // but the form given in the spec is:
    // z_new = z - (error * φ(z)) / (φ(z)² + 0.5 * z * error)
    // Let me verify: that's error * phi / (phi^2 + 0.5*z*error)
    // = error / (phi + 0.5*z*error/phi)
    // This is Halley's method applied to the normal CDF.

    let numer = wad_mul(error, phi_i);

    z - wad_div(numer, denom)
}

/// Clamp z to [-8 WAD, 8 WAD].
fn clamp_z(z: I256) -> I256 {
    if z < -EIGHT_WAD_I {
        -EIGHT_WAD_I
    } else if z > EIGHT_WAD_I {
        EIGHT_WAD_I
    } else {
        z
    }
}
