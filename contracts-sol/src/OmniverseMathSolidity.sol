// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOmniverseMath} from "./interfaces/IOmniverseMath.sol";

/// @notice Solidity fallback for the Stylus math kernel.
/// @dev Uses WAD-scaled fixed-point arithmetic and the same ABI surface as IOmniverseMath.
contract OmniverseMathSolidity is IOmniverseMath {
    uint256 public constant WAD = 1e18;
    int256 internal constant WAD_I = 1e18;
    uint256 internal constant INV_SQRT_2PI = 398_942_280_401_432_677;
    uint256 internal constant PHI_MIN = 1e9;
    uint256 internal constant LAMBDA_MIN = 0.05e18;
    uint256 internal constant P_BOUNDARY = 1e14;
    uint256 internal constant L_MIN = 1e6;
    uint256 internal constant EPSILON = 10_000;
    uint256 internal constant MAX_ITER = 100;

    function phi(int256 z) public pure returns (uint256) {
        int256 absZ = z < 0 ? -z : z;
        if (absZ >= 8e18) return 0;

        int256 exponent = -((absZ * absZ) / WAD_I) / 2;
        return (_expWad(exponent) * INV_SQRT_2PI) / WAD;
    }

    function Phi(int256 z) public pure returns (uint256) {
        if (z <= -8e18) return 0;
        if (z >= 8e18) return WAD;

        bool negative = z < 0;
        uint256 absZ = uint256(negative ? -z : z);
        uint256 t = _wadDiv(WAD, WAD + (231_641_900_000_000_000 * absZ) / WAD);

        int256 poly = 1_330_274_429_000_000_000;
        poly = (poly * int256(t)) / WAD_I - 1_821_255_978_000_000_000;
        poly = (poly * int256(t)) / WAD_I + 1_781_477_937_000_000_000;
        poly = (poly * int256(t)) / WAD_I - 356_563_782_000_000_000;
        poly = (poly * int256(t)) / WAD_I + 319_381_530_000_000_000;
        poly = (poly * int256(t)) / WAD_I;

        uint256 cdfPositive = WAD - (phi(int256(absZ)) * uint256(poly)) / WAD;
        return negative ? WAD - cdfPositive : cdfPositive;
    }

    function PhiInv(uint256 p) public pure returns (int256 z) {
        require(p > 0 && p < WAD, "PhiInv: p out of range");

        int256 lo = -8e18;
        int256 hi = 8e18;
        for (uint256 i = 0; i < 96; i++) {
            int256 mid = (lo + hi) / 2;
            if (Phi(mid) < p) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        z = (lo + hi) / 2;
    }

    function solveSwap(uint256 x1, uint256 y0, uint256 ell) external pure returns (uint256 y1) {
        ell = ell < L_MIN ? L_MIN : ell;

        uint256 lo = 0;
        uint256 hi = x1 + 5 * ell;
        y1 = y0;
        if (y1 > hi) y1 = hi;
        if (y1 == 0) y1 = hi / 2;

        for (uint256 i = 0; i < MAX_ITER; i++) {
            int256 fVal = _invariantAt(x1, y1, ell);
            uint256 fAbs = _abs(fVal);
            if (fAbs < EPSILON || hi - lo <= 1) {
                return fVal > 0 ? y1 + 1 : y1;
            }

            int256 z = ((int256(y1) - int256(x1)) * WAD_I) / int256(ell);
            int256 fPrime = int256(Phi(z)) - WAD_I;

            if (fVal > 0) lo = y1;
            else hi = y1;

            if (fPrime == 0) {
                y1 = (lo + hi) / 2;
                continue;
            }

            int256 delta = (fVal * WAD_I) / fPrime;
            int256 next = int256(y1) - delta;
            if (next < int256(lo) || next > int256(hi)) {
                y1 = (lo + hi) / 2;
            } else {
                y1 = uint256(next);
            }
        }

        revert("solveSwap: no convergence");
    }

    function poolValue(int256 z) public pure returns (uint256) {
        uint256 phiZ = phi(z);
        int256 twoPhiMinusOne = int256(Phi(z) * 2) - WAD_I;
        int256 value = int256(phiZ) + (z * twoPhiMinusOne) / WAD_I;
        return value <= 0 ? 0 : uint256(value);
    }

    function lambdaStarGaussian(uint256 gammaPrime, uint256 p) external pure returns (uint256) {
        require(gammaPrime <= 1e24, "gamma too large");
        if (p <= P_BOUNDARY || p >= WAD - P_BOUNDARY) return LAMBDA_MIN;

        int256 z = PhiInv(p);
        uint256 phiZ = phi(z);
        if (phiZ < PHI_MIN) phiZ = PHI_MIN;
        uint256 vZ = poolValue(z);
        if (vZ < PHI_MIN) vZ = PHI_MIN;

        uint256 twoVPhi = 2 * ((vZ * phiZ) / WAD);
        if (twoVPhi == 0) return LAMBDA_MIN;

        uint256 gammaG = (gammaPrime * WAD) / twoVPhi;
        uint256 disc = _wadSqrt(WAD + 2 * gammaG);
        uint256 lambda = ((WAD + disc) * WAD) / (WAD + gammaG + disc);
        if (lambda < LAMBDA_MIN) return LAMBDA_MIN;
        return lambda > WAD ? WAD : lambda;
    }

    function _invariantAt(uint256 x, uint256 y, uint256 ell) internal pure returns (int256) {
        int256 diff = int256(y) - int256(x);
        int256 z = (diff * WAD_I) / int256(ell);
        return (diff * int256(Phi(z))) / WAD_I + (int256(ell) * int256(phi(z))) / WAD_I - int256(y);
    }

    function _expWad(int256 x) internal pure returns (uint256) {
        if (x == 0) return WAD;
        bool negative = x < 0;
        uint256 a = uint256(negative ? -x : x);
        uint256 term = WAD;
        uint256 sum = WAD;
        for (uint256 i = 1; i <= 80; i++) {
            term = (term * a) / WAD / i;
            if (term == 0) break;
            sum += term;
        }
        return negative ? (WAD * WAD) / sum : sum;
    }

    function _wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * WAD) / b;
    }

    function _sqrt(uint256 x) internal pure returns (uint256 z) {
        if (x == 0) return 0;
        z = x;
        uint256 y = (x + 1) / 2;
        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        }
    }

    function _wadSqrt(uint256 x) internal pure returns (uint256) {
        return _sqrt(x * WAD);
    }

    function _abs(int256 x) internal pure returns (uint256) {
        return uint256(x < 0 ? -x : x);
    }
}
