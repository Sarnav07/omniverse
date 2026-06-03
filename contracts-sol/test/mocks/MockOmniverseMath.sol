// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockOmniverseMath {
    uint256 public lambda = 0.5e18;
    uint256 public price = 0.5e18;

    function setLambda(uint256 lambda_) external {
        lambda = lambda_;
    }

    function setPrice(uint256 price_) external {
        price = price_;
    }

    function phi(int256) external pure returns (uint256) {
        return 398_942_280_401_432_677;
    }

    function Phi(int256) external view returns (uint256) {
        return price;
    }

    function PhiInv(uint256) external pure returns (int256) {
        return 0;
    }

    function solveSwap(uint256 x1, uint256 y0, uint256 ell) external view returns (uint256 y1) {
        require(x1 <= type(uint128).max && y0 <= type(uint128).max && ell <= type(uint128).max, "MATH_TOUCHED_OOB");
        return y0 == 0 ? 0 : y0 - 1;
    }

    function poolValue(int256) external pure returns (uint256) {
        return 398_942_280_401_432_677;
    }

    function lambdaStarGaussian(uint256, uint256) external view returns (uint256) {
        return lambda;
    }
}
