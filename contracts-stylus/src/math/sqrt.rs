//! Integer and WAD-scaled square root (Babylonian / Newton-Raphson).
//! Port of PRBMath's Common.sqrt and SD59x18.sqrt.

use stylus_sdk::alloy_primitives::{I256, U256};
use crate::wad::WAD;

/// Most significant bit position of a U256 (0-indexed).
/// Returns 0 for x == 0.
pub fn msb(mut x: U256) -> u32 {
    let mut result: u32 = 0;

    if x >= U256::from(1u128) << 128 {
        x >>= 128;
        result += 128;
    }
    if x >= U256::from(1u64) << 64 {
        x >>= 64;
        result += 64;
    }
    if x >= U256::from(1u32) << 32 {
        x >>= 32;
        result += 32;
    }
    if x >= U256::from(1u16) << 16 {
        x >>= 16;
        result += 16;
    }
    if x >= U256::from(1u16) << 8 {
        x >>= 8;
        result += 8;
    }
    if x >= U256::from(1u8) << 4 {
        x >>= 4;
        result += 4;
    }
    if x >= U256::from(1u8) << 2 {
        x >>= 2;
        result += 2;
    }
    if x >= U256::from(2u8) {
        result += 1;
    }
    result
}

/// Integer square root of a U256 using the Babylonian method.
/// Rounds down (floor). Returns 0 for input 0.
pub fn sqrt_u(x: U256) -> U256 {
    if x.is_zero() {
        return U256::ZERO;
    }

    // Initial guess: 2^(msb(x)/2)
    let mut result = U256::from(1u8);
    let x_aux = x;

    if x_aux >= U256::from(1u128) << 128 {
        result <<= 64;
    }
    let shifted = if x_aux >= U256::from(1u128) << 128 { x_aux >> 128 } else { x_aux };

    let shifted2 = if shifted >= U256::from(1u64) << 64 {
        result <<= 32;
        shifted >> 64
    } else {
        shifted
    };

    let shifted3 = if shifted2 >= U256::from(1u32) << 32 {
        result <<= 16;
        shifted2 >> 32
    } else {
        shifted2
    };

    let shifted4 = if shifted3 >= U256::from(1u16) << 16 {
        result <<= 8;
        shifted3 >> 16
    } else {
        shifted3
    };

    let shifted5 = if shifted4 >= U256::from(1u16) << 8 {
        result <<= 4;
        shifted4 >> 8
    } else {
        shifted4
    };

    let shifted6 = if shifted5 >= U256::from(1u8) << 4 {
        result <<= 2;
        shifted5 >> 4
    } else {
        shifted5
    };

    if shifted6 >= U256::from(1u8) << 2 {
        result <<= 1;
    }

    // 7 Newton-Raphson iterations — sufficient for U256 precision.
    result = (result + x / result) >> 1;
    result = (result + x / result) >> 1;
    result = (result + x / result) >> 1;
    result = (result + x / result) >> 1;
    result = (result + x / result) >> 1;
    result = (result + x / result) >> 1;
    result = (result + x / result) >> 1;

    // Floor: if result² > x, take x/result instead.
    let rounded = x / result;
    if result > rounded {
        result = rounded;
    }

    result
}

/// WAD-scaled square root: sqrt(x) where x is in WAD.
/// Returns result in WAD. Input must be non-negative.
/// Equivalent to sqrt(x * WAD) to correct for scaling.
pub fn wad_sqrt(x: U256) -> U256 {
    sqrt_u(x * WAD)
}

/// WAD-scaled square root for signed values.
/// Panics if x < 0.
pub fn wad_sqrt_i(x: I256) -> I256 {
    assert!(!x.is_negative(), "sqrt of negative");
    let x_u: U256 = x.try_into().unwrap();
    I256::try_from(wad_sqrt(x_u)).unwrap()
}
