// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOmniverseMath} from "./interfaces/IOmniverseMath.sol";

/// @notice Minimal pm-AMM pool shell that delegates Gaussian math to Stylus.
/// @dev This scaffold intentionally keeps token transfer/settlement out of scope.
/// It validates the Solidity-to-Stylus boundary and PA-AMM reserve accounting.
contract PmAmmPool {
    uint256 public constant WAD = 1e18;
    uint256 public constant HALF_WAD = 0.5e18;
    uint256 public constant MAX_KERNEL_INPUT = type(uint128).max;
    uint256 public constant MIN_ELL = 1e6;

    IOmniverseMath public immutable math;

    // x = NO reserve, y = YES reserve.
    uint256 public xActive;
    uint256 public yActive;
    uint256 public xPassive;
    uint256 public yPassive;

    uint256 public immutable L0;
    uint256 public immutable T;
    uint256 public ellActive;
    uint256 public lambdaWad;
    uint256 public gammaPrimeWad;
    uint256 public nLast;
    bool public useDynamicLambda;

    event Rebalanced(uint256 xActive, uint256 yActive, uint256 ellActive, uint256 lambdaWad, uint256 blockNumber);
    event OmniverseTrade(
        address indexed trader,
        uint8 side,
        uint256 amountIn,
        uint256 amountOut,
        uint256 priceWad,
        uint256 ellWad,
        uint256 lambdaWad
    );

    error Expired();
    error InvalidAmount();
    error InvalidMath();
    error InvalidExpiry();
    error KernelInputOutOfBounds();
    error MathReturnedInvalidReserve();

    constructor(
        IOmniverseMath math_,
        uint256 xInitial,
        uint256 yInitial,
        uint256 l0,
        uint256 expiry,
        uint256 gammaPrime,
        bool dynamicLambda
    ) {
        if (address(math_) == address(0)) revert InvalidMath();
        if (expiry <= block.timestamp) revert InvalidExpiry();

        math = math_;
        L0 = l0;
        T = expiry;
        gammaPrimeWad = gammaPrime;
        useDynamicLambda = dynamicLambda;
        lambdaWad = dynamicLambda ? WAD : HALF_WAD;
        nLast = block.number;

        _assertKernelBounds(xInitial, yInitial, l0);
        xActive = xInitial;
        yActive = yInitial;
        ellActive = _floorEll(l0);
    }

    /// @notice Buy YES by paying NO into the pool.
    function buyYes(uint256 noIn) external returns (uint256 yesOut) {
        if (noIn == 0) revert InvalidAmount();
        _rebalance();

        uint256 x1 = xActive + noIn;
        _assertKernelBounds(x1, yActive, ellActive);

        uint256 y1 = math.solveSwap(x1, yActive, ellActive);
        if (y1 > yActive) revert MathReturnedInvalidReserve();

        yesOut = yActive - y1;
        xActive = x1;
        yActive = y1;

        emit OmniverseTrade(msg.sender, 0, noIn, yesOut, currentPrice(), ellActive, lambdaWad);
    }

    /// @notice Buy NO by paying YES into the pool.
    /// @dev Uses reserve symmetry: solving swapped reserves gives the new NO reserve.
    function buyNo(uint256 yesIn) external returns (uint256 noOut) {
        if (yesIn == 0) revert InvalidAmount();
        _rebalance();

        uint256 y1 = yActive + yesIn;
        _assertKernelBounds(y1, xActive, ellActive);

        uint256 x1 = math.solveSwap(y1, xActive, ellActive);
        if (x1 > xActive) revert MathReturnedInvalidReserve();

        noOut = xActive - x1;
        xActive = x1;
        yActive = y1;

        emit OmniverseTrade(msg.sender, 1, yesIn, noOut, currentPrice(), ellActive, lambdaWad);
    }

    function rebalance() external {
        _rebalance();
    }

    function currentPrice() public view returns (uint256) {
        uint256 ell = _floorEll(ellActive);
        _assertKernelBounds(xActive, yActive, ell);
        return math.Phi(_zFromReserves(xActive, yActive, ell));
    }

    function _rebalance() internal {
        if (block.timestamp >= T) revert Expired();
        if (block.number <= nLast) return;

        uint256 xTotal = xActive + xPassive;
        uint256 yTotal = yActive + yPassive;
        uint256 ellTotal = _floorEll(_liquidityAt(block.timestamp));
        _assertKernelBounds(xTotal, yTotal, ellTotal);

        uint256 p = math.Phi(_zFromReserves(xTotal, yTotal, ellTotal));
        uint256 nextLambda = useDynamicLambda ? math.lambdaStarGaussian(gammaPrimeWad, p) : HALF_WAD;
        if (nextLambda > WAD) revert MathReturnedInvalidReserve();

        uint256 nextXActive = (xTotal * nextLambda) / WAD;
        uint256 nextYActive = (yTotal * nextLambda) / WAD;
        uint256 nextEllActive = _floorEll((ellTotal * nextLambda) / WAD);

        _assertKernelBounds(nextXActive, nextYActive, nextEllActive);

        xActive = nextXActive;
        yActive = nextYActive;
        xPassive = xTotal - nextXActive;
        yPassive = yTotal - nextYActive;
        ellActive = nextEllActive;
        lambdaWad = nextLambda;
        nLast = block.number;

        emit Rebalanced(nextXActive, nextYActive, nextEllActive, nextLambda, block.number);
    }

    function _liquidityAt(uint256 timestamp) internal view returns (uint256) {
        uint256 timeRemaining = T - timestamp;
        return L0 * _sqrt(timeRemaining);
    }

    function _zFromReserves(uint256 x, uint256 y, uint256 ell) internal pure returns (int256) {
        int256 ySigned = _toInt256(y);
        int256 xSigned = _toInt256(x);
        int256 ellSigned = _toInt256(ell);
        return ((ySigned - xSigned) * int256(WAD)) / ellSigned;
    }

    function _assertKernelBounds(uint256 x, uint256 y, uint256 ell) internal pure {
        if (x > MAX_KERNEL_INPUT || y > MAX_KERNEL_INPUT || ell > MAX_KERNEL_INPUT) {
            revert KernelInputOutOfBounds();
        }
    }

    function _floorEll(uint256 ell) internal pure returns (uint256) {
        return ell < MIN_ELL ? MIN_ELL : ell;
    }

    function _toInt256(uint256 value) internal pure returns (int256) {
        if (value > uint256(type(int256).max)) revert KernelInputOutOfBounds();
        return int256(value);
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
}
