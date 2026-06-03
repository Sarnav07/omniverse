//! Exponential and logarithm functions in WAD fixed-point.
//! Port of PRBMath SD59x18: exp, exp2, log2, ln.
//!
//! Algorithm: exp(x) = 2^(x * log2(e)), where exp2 uses
//! precomputed magic constants for each bit of the fractional part.

use stylus_sdk::alloy_primitives::{I256, U256};
use crate::wad::{WAD, WAD_I, WAD_SQUARED};
use crate::math::sqrt::msb;

// ── Constants ────────────────────────────────────────────────────────────────

/// log2(e) in WAD = 1.4426950408889634... * 1e18
const LOG2_E: I256 = I256::from_raw(U256::from_limbs([1_442_695_040_888_963_407u64, 0, 0, 0]));


/// Half unit = 5e17
const HALF_UNIT: i128 = 500_000_000_000_000_000;

/// Below this, exp2 returns 0 (about -59.79 in WAD).
const EXP2_MIN_THRESHOLD: i128 = -59_794_705_707_972_522_261;

/// Below this, exp returns 0 (about -41.45 in WAD).
const EXP_MIN_THRESHOLD: i128 = -41_446_531_673_892_822_322;

/// Maximum input for exp (about 133.08 in WAD). 133084258667509499441 > u64::MAX, use two limbs.
/// 133084258667509499441 = 7 * 2^64 + 133084258667509499441 - 7*18446744073709551616
/// = 7 * 2^64 + 3957150595342653329
const EXP_MAX_INPUT_U: U256 = U256::from_limbs([3_957_150_595_342_653_329u64, 7u64, 0, 0]);

/// Maximum input for exp2 (192e18).
const EXP2_MAX_INPUT: i128 = 192_000_000_000_000_000_000;

// ── exp2 (unsigned, 192.64-bit input → WAD output) ──────────────────────────

/// Compute 2^x where x is in 192.64-bit unsigned fixed-point.
/// Returns result in WAD (60.18 decimal fixed-point).
/// Direct port of PRBMath Common.exp2.
fn exp2_192x64(x: U256) -> U256 {
    // Start from 0.5 in 192.64-bit format = 2^191.
    // U256 limbs are little-endian: limb[0]=bits 0-63, limb[2]=bits 128-191.
    // Bit 191 is the MSB of limb[2].
    let mut r = U256::from_limbs([0u64, 0u64, 0x8000000000000000u64, 0u64]);

    // Fractional bit checks — each bit multiplies by sqrt(2^(2^-i)).
    // Group 1: bits 63-56
    if !(x & U256::from(0xFF00000000000000u64)).is_zero() {
        if !(x & U256::from(0x8000000000000000u64)).is_zero() {
            r = (r * U256::from(0x16A09E667F3BCC909u128)) >> 64;
        }
        if !(x & U256::from(0x4000000000000000u64)).is_zero() {
            r = (r * U256::from(0x1306FE0A31B7152DFu128)) >> 64;
        }
        if !(x & U256::from(0x2000000000000000u64)).is_zero() {
            r = (r * U256::from(0x1172B83C7D517ADCEu128)) >> 64;
        }
        if !(x & U256::from(0x1000000000000000u64)).is_zero() {
            r = (r * U256::from(0x10B5586CF9890F62Au128)) >> 64;
        }
        if !(x & U256::from(0x800000000000000u64)).is_zero() {
            r = (r * U256::from(0x1059B0D31585743AEu128)) >> 64;
        }
        if !(x & U256::from(0x400000000000000u64)).is_zero() {
            r = (r * U256::from(0x102C9A3E778060EE7u128)) >> 64;
        }
        if !(x & U256::from(0x200000000000000u64)).is_zero() {
            r = (r * U256::from(0x10163DA9FB33356D8u128)) >> 64;
        }
        if !(x & U256::from(0x100000000000000u64)).is_zero() {
            r = (r * U256::from(0x100B1AFA5ABCBED61u128)) >> 64;
        }
    }

    // Group 2: bits 55-48
    if !(x & U256::from(0xFF000000000000u64)).is_zero() {
        if !(x & U256::from(0x80000000000000u64)).is_zero() {
            r = (r * U256::from(0x10058C86DA1C09EA2u128)) >> 64;
        }
        if !(x & U256::from(0x40000000000000u64)).is_zero() {
            r = (r * U256::from(0x1002C605E2E8CEC50u128)) >> 64;
        }
        if !(x & U256::from(0x20000000000000u64)).is_zero() {
            r = (r * U256::from(0x100162F3904051FA1u128)) >> 64;
        }
        if !(x & U256::from(0x10000000000000u64)).is_zero() {
            r = (r * U256::from(0x1000B175EFFDC76BAu128)) >> 64;
        }
        if !(x & U256::from(0x8000000000000u64)).is_zero() {
            r = (r * U256::from(0x100058BA01FB9F96Du128)) >> 64;
        }
        if !(x & U256::from(0x4000000000000u64)).is_zero() {
            r = (r * U256::from(0x10002C5CC37DA9492u128)) >> 64;
        }
        if !(x & U256::from(0x2000000000000u64)).is_zero() {
            r = (r * U256::from(0x1000162E525EE0547u128)) >> 64;
        }
        if !(x & U256::from(0x1000000000000u64)).is_zero() {
            r = (r * U256::from(0x10000B17255775C04u128)) >> 64;
        }
    }

    // Group 3: bits 47-40
    if !(x & U256::from(0xFF0000000000u64)).is_zero() {
        if !(x & U256::from(0x800000000000u64)).is_zero() {
            r = (r * U256::from(0x1000058B91B5BC9AEu128)) >> 64;
        }
        if !(x & U256::from(0x400000000000u64)).is_zero() {
            r = (r * U256::from(0x100002C5C89D5EC6Du128)) >> 64;
        }
        if !(x & U256::from(0x200000000000u64)).is_zero() {
            r = (r * U256::from(0x10000162E43F4F831u128)) >> 64;
        }
        if !(x & U256::from(0x100000000000u64)).is_zero() {
            r = (r * U256::from(0x100000B1721BCFC9Au128)) >> 64;
        }
        if !(x & U256::from(0x80000000000u64)).is_zero() {
            r = (r * U256::from(0x10000058B90CF1E6Eu128)) >> 64;
        }
        if !(x & U256::from(0x40000000000u64)).is_zero() {
            r = (r * U256::from(0x1000002C5C863B73Fu128)) >> 64;
        }
        if !(x & U256::from(0x20000000000u64)).is_zero() {
            r = (r * U256::from(0x100000162E430E5A2u128)) >> 64;
        }
        if !(x & U256::from(0x10000000000u64)).is_zero() {
            r = (r * U256::from(0x1000000B172183551u128)) >> 64;
        }
    }

    // Group 4: bits 39-32
    if !(x & U256::from(0xFF00000000u64)).is_zero() {
        if !(x & U256::from(0x8000000000u64)).is_zero() {
            r = (r * U256::from(0x100000058B90C0B49u128)) >> 64;
        }
        if !(x & U256::from(0x4000000000u64)).is_zero() {
            r = (r * U256::from(0x10000002C5C8601CCu128)) >> 64;
        }
        if !(x & U256::from(0x2000000000u64)).is_zero() {
            r = (r * U256::from(0x1000000162E42FFF0u128)) >> 64;
        }
        if !(x & U256::from(0x1000000000u64)).is_zero() {
            r = (r * U256::from(0x10000000B17217FBBu128)) >> 64;
        }
        if !(x & U256::from(0x800000000u64)).is_zero() {
            r = (r * U256::from(0x1000000058B90BFCEu128)) >> 64;
        }
        if !(x & U256::from(0x400000000u64)).is_zero() {
            r = (r * U256::from(0x100000002C5C85FE3u128)) >> 64;
        }
        if !(x & U256::from(0x200000000u64)).is_zero() {
            r = (r * U256::from(0x10000000162E42FF1u128)) >> 64;
        }
        if !(x & U256::from(0x100000000u64)).is_zero() {
            r = (r * U256::from(0x100000000B17217F8u128)) >> 64;
        }
    }

    // Group 5: bits 31-24
    if !(x & U256::from(0xFF000000u64)).is_zero() {
        if !(x & U256::from(0x80000000u64)).is_zero() {
            r = (r * U256::from(0x10000000058B90BFCu128)) >> 64;
        }
        if !(x & U256::from(0x40000000u64)).is_zero() {
            r = (r * U256::from(0x1000000002C5C85FEu128)) >> 64;
        }
        if !(x & U256::from(0x20000000u64)).is_zero() {
            r = (r * U256::from(0x100000000162E42FFu128)) >> 64;
        }
        if !(x & U256::from(0x10000000u64)).is_zero() {
            r = (r * U256::from(0x1000000000B17217Fu128)) >> 64;
        }
        if !(x & U256::from(0x8000000u64)).is_zero() {
            r = (r * U256::from(0x100000000058B90C0u128)) >> 64;
        }
        if !(x & U256::from(0x4000000u64)).is_zero() {
            r = (r * U256::from(0x10000000002C5C860u128)) >> 64;
        }
        if !(x & U256::from(0x2000000u64)).is_zero() {
            r = (r * U256::from(0x1000000000162E430u128)) >> 64;
        }
        if !(x & U256::from(0x1000000u64)).is_zero() {
            r = (r * U256::from(0x10000000000B17218u128)) >> 64;
        }
    }

    // Group 6: bits 23-16
    if !(x & U256::from(0xFF0000u64)).is_zero() {
        if !(x & U256::from(0x800000u64)).is_zero() {
            r = (r * U256::from(0x1000000000058B90Cu128)) >> 64;
        }
        if !(x & U256::from(0x400000u64)).is_zero() {
            r = (r * U256::from(0x100000000002C5C86u128)) >> 64;
        }
        if !(x & U256::from(0x200000u64)).is_zero() {
            r = (r * U256::from(0x10000000000162E43u128)) >> 64;
        }
        if !(x & U256::from(0x100000u64)).is_zero() {
            r = (r * U256::from(0x100000000000B1721u128)) >> 64;
        }
        if !(x & U256::from(0x80000u64)).is_zero() {
            r = (r * U256::from(0x10000000000058B91u128)) >> 64;
        }
        if !(x & U256::from(0x40000u64)).is_zero() {
            r = (r * U256::from(0x1000000000002C5C8u128)) >> 64;
        }
        if !(x & U256::from(0x20000u64)).is_zero() {
            r = (r * U256::from(0x100000000000162E4u128)) >> 64;
        }
        if !(x & U256::from(0x10000u64)).is_zero() {
            r = (r * U256::from(0x1000000000000B172u128)) >> 64;
        }
    }

    // Group 7: bits 15-8
    if !(x & U256::from(0xFF00u64)).is_zero() {
        if !(x & U256::from(0x8000u64)).is_zero() {
            r = (r * U256::from(0x100000000000058B9u128)) >> 64;
        }
        if !(x & U256::from(0x4000u64)).is_zero() {
            r = (r * U256::from(0x10000000000002C5Du128)) >> 64;
        }
        if !(x & U256::from(0x2000u64)).is_zero() {
            r = (r * U256::from(0x1000000000000162Eu128)) >> 64;
        }
        if !(x & U256::from(0x1000u64)).is_zero() {
            r = (r * U256::from(0x10000000000000B17u128)) >> 64;
        }
        if !(x & U256::from(0x800u64)).is_zero() {
            r = (r * U256::from(0x1000000000000058Cu128)) >> 64;
        }
        if !(x & U256::from(0x400u64)).is_zero() {
            r = (r * U256::from(0x100000000000002C6u128)) >> 64;
        }
        if !(x & U256::from(0x200u64)).is_zero() {
            r = (r * U256::from(0x10000000000000163u128)) >> 64;
        }
        if !(x & U256::from(0x100u64)).is_zero() {
            r = (r * U256::from(0x100000000000000B1u128)) >> 64;
        }
    }

    // Group 8: bits 7-0
    if !(x & U256::from(0xFFu64)).is_zero() {
        if !(x & U256::from(0x80u64)).is_zero() {
            r = (r * U256::from(0x10000000000000059u128)) >> 64;
        }
        if !(x & U256::from(0x40u64)).is_zero() {
            r = (r * U256::from(0x1000000000000002Cu128)) >> 64;
        }
        if !(x & U256::from(0x20u64)).is_zero() {
            r = (r * U256::from(0x10000000000000016u128)) >> 64;
        }
        if !(x & U256::from(0x10u64)).is_zero() {
            r = (r * U256::from(0x1000000000000000Bu128)) >> 64;
        }
        if !(x & U256::from(0x8u64)).is_zero() {
            r = (r * U256::from(0x10000000000000006u128)) >> 64;
        }
        if !(x & U256::from(0x4u64)).is_zero() {
            r = (r * U256::from(0x10000000000000003u128)) >> 64;
        }
        if !(x & U256::from(0x2u64)).is_zero() {
            r = (r * U256::from(0x10000000000000001u128)) >> 64;
        }
        if !(x & U256::from(0x1u64)).is_zero() {
            r = (r * U256::from(0x10000000000000001u128)) >> 64;
        }
    }

    // Convert from 192.64 to 60.18 WAD format.
    // Multiply by UNIT, then shift right by (191 - integer_part).
    r *= WAD;
    let int_part = x >> 64;
    r >>= U256::from(191u32) - int_part;

    r
}

// ── exp2 (signed, WAD input → WAD output) ────────────────────────────────────

/// Compute 2^x where x is a signed WAD value. Returns WAD result.
/// For x < EXP2_MIN_THRESHOLD (~-59.79), returns 0.
pub fn exp2(x: I256) -> I256 {
    if x.is_negative() {
        if x < I256::try_from(EXP2_MIN_THRESHOLD).unwrap() {
            return I256::ZERO;
        }
        // exp2(-|x|) = WAD^2 / exp2(|x|)
        let pos = exp2(-x);
        let wad_sq = I256::from_raw(WAD_SQUARED);
        return wad_sq / pos;
    }

    assert!(
        x <= I256::try_from(EXP2_MAX_INPUT).unwrap(),
        "exp2 overflow"
    );

    // Convert from WAD to 192.64-bit fixed-point.
    let x_u: U256 = x.try_into().unwrap();
    let x_192x64 = (x_u << 64) / WAD;

    let result = exp2_192x64(x_192x64);
    I256::try_from(result).unwrap()
}

// ── exp (natural, WAD → WAD) ─────────────────────────────────────────────────

/// Compute e^x where x is a signed WAD value. Returns signed WAD result.
/// For x < EXP_MIN_THRESHOLD (~-41.45), returns 0.
pub fn exp(x: I256) -> I256 {
    if x < I256::try_from(EXP_MIN_THRESHOLD).unwrap() {
        return I256::ZERO;
    }
    if !x.is_negative() {
        let x_u: U256 = x.try_into().unwrap();
        if x_u > EXP_MAX_INPUT_U {
            panic!("exp overflow");
        }
    }

    // exp(x) = exp2(x * log2(e) / WAD)
    let product = x * LOG2_E;
    exp2(product / WAD_I)
}

// ── log2 (WAD → WAD) ────────────────────────────────────────────────────────

/// Binary logarithm of x (WAD input, WAD output). x must be > 0.
/// Port of PRBMath SD59x18.log2.
pub fn log2(x: I256) -> I256 {
    assert!(x.is_positive(), "log2 of non-positive");

    let mut x_int: I256 = x;
    let unit = WAD_I;
    let unit_u = WAD;

    let sign: I256;
    if x_int >= unit {
        sign = I256::try_from(1i64).unwrap();
    } else {
        sign = I256::try_from(-1i64).unwrap();
        // Invert: x = WAD^2 / x
        x_int = I256::from_raw(WAD_SQUARED) / x_int;
    }

    // Integer part: n = msb(x / WAD)
    let x_u: U256 = x_int.try_into().unwrap();
    let n = msb(x_u / unit_u);
    let mut result_int = I256::try_from(n as i64).unwrap() * unit;

    // y = x >> n, so y ∈ [WAD, 2*WAD)
    let mut y = x_int >> n;

    if y == unit {
        return result_int * sign;
    }

    // Iterative approximation of fractional part.
    let double_unit = I256::try_from(2_000_000_000_000_000_000i128).unwrap();
    let mut delta = I256::try_from(HALF_UNIT).unwrap();

    while delta > I256::ZERO {
        y = (y * y) / unit;
        if y >= double_unit {
            result_int += delta;
            y >>= 1u32;
        }
        delta >>= 1u32;
    }

    result_int * sign
}

/// Natural logarithm: ln(x) = log2(x) * WAD / LOG2_E.
/// x must be positive WAD value.
pub fn ln(x: I256) -> I256 {
    (log2(x) * WAD_I) / LOG2_E
}
