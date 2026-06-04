// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockOmniverseMath {
    uint256 public constant PHI_CONST = 398_942_280_401_432_677;

    uint256 public lambda = 0.5e18;
    uint256 public price = 0.5e18;
    uint256 public poolValueReturn = 398_942_280_401_432_677;
    uint256 public nextPoolValueReturn;

    function setLambda(uint256 lambda_) external {
        lambda = lambda_;
    }

    function setPrice(uint256 price_) external {
        price = price_;
    }

    function setPoolValue(uint256 value) external {
        poolValueReturn = value;
    }

    function setNextPoolValue(uint256 value) external {
        nextPoolValueReturn = value;
    }

    function phi(int256) external pure returns (uint256) {
        return PHI_CONST;
    }

    function Phi(int256) external view returns (uint256) {
        return price;
    }

    function PhiInv(uint256) external pure returns (int256) {
        return 0;
    }

    /// @dev On-curve y for constant P=price, Q=PHI_CONST: y = (ell*Q - x1*P)/(WAD-P).
    function solveSwap(uint256 x1, uint256 y0, uint256 ell) external view returns (uint256 y1) {
        require(x1 <= type(uint128).max && y0 <= type(uint128).max && ell <= type(uint128).max, "MATH_TOUCHED_OOB");
        return ((ell * PHI_CONST) - (x1 * price)) / (1e18 - price);
    }

    function poolValue(int256 z) external view returns (uint256) {
        if (z != 0 && nextPoolValueReturn != 0) return nextPoolValueReturn;
        return poolValueReturn;
    }

    function lambdaStarGaussian(uint256, uint256) external view returns (uint256) {
        return lambda;
    }
}
