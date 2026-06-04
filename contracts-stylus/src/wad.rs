//! Fixed-point WAD (1e18) arithmetic for I256 and U256.
//!
//! All values in this crate are scaled by WAD = 10^18.
//! These helpers perform multiplication and division with correct scaling.

use stylus_sdk::alloy_primitives::{I256, U256};

/// 1e18 — the universal scaling factor.
pub const WAD: U256 = U256::from_limbs([1_000_000_000_000_000_000u64, 0, 0, 0]);

/// WAD as I256.
pub const WAD_I: I256 = I256::from_raw(WAD);

/// 0.5e18
pub const HALF_WAD: U256 = U256::from_limbs([500_000_000_000_000_000u64, 0, 0, 0]);

/// 2e18
pub const TWO_WAD: U256 = U256::from_limbs([2_000_000_000_000_000_000u64, 0, 0, 0]);

/// WAD^2 = 1e36
pub const WAD_SQUARED: U256 = U256::from_limbs([12919594847110692864u64, 54210108624275221u64, 0, 0]);

/// Signed WAD mul: (a * b) / WAD. Rounds toward zero.
#[inline]
pub fn wad_mul(a: I256, b: I256) -> I256 {
    (a * b) / WAD_I
}

/// Signed WAD div: (a * WAD) / b. Rounds toward zero.
#[inline]
pub fn wad_div(a: I256, b: I256) -> I256 {
    (a * WAD_I) / b
}

/// Unsigned WAD mul: (a * b) / WAD. Rounds toward zero (floor).
#[inline]
pub fn wad_mul_u(a: U256, b: U256) -> U256 {
    (a * b) / WAD
}

/// Unsigned WAD div: (a * WAD) / b. Rounds toward zero (floor).
#[inline]
pub fn wad_div_u(a: U256, b: U256) -> U256 {
    (a * WAD) / b
}

/// Unsigned WAD mul rounding up: ceil((a * b) / WAD).
#[inline]
pub fn wad_mul_up_u(a: U256, b: U256) -> U256 {
    let product = a * b;
    (product + WAD - U256::from(1)) / WAD
}

/// Unsigned WAD div rounding up: ceil((a * WAD) / b).
#[inline]
pub fn wad_div_up_u(a: U256, b: U256) -> U256 {
    let product = a * WAD;
    (product + b - U256::from(1)) / b
}

/// Absolute value of I256, returned as U256.
#[inline]
pub fn i256_abs(x: I256) -> U256 {
    x.unsigned_abs()
}

/// Convert U256 to I256 (panics if > I256::MAX).
#[inline]
pub fn u256_to_i256(x: U256) -> I256 {
    I256::try_from(x).expect("u256_to_i256: value exceeds I256::MAX")
}

/// Convert I256 to U256 (panics if negative).
#[inline]
pub fn i256_to_u256(x: I256) -> U256 {
    x.try_into().expect("i256_to_u256: value is negative")
}
