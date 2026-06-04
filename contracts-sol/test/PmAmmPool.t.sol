// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PmAmmPool} from "../src/PmAmmPool.sol";
import {IOmniverseMath} from "../src/interfaces/IOmniverseMath.sol";
import {MockOmniverseMath} from "./mocks/MockOmniverseMath.sol";

contract PmAmmPoolTest is Test {
    MockOmniverseMath internal math;
    PmAmmPool internal pool;

    function setUp() public {
        math = new MockOmniverseMath();
        pool = new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            marketId_: 0,
            xInitial: 1e18,
            yInitial: 4e18,
            l0: 6e18,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });
    }

    function testBuyYesCallsMathAndUpdatesReserves() public {
        uint256 yesOut = pool.buyYes(1e15, 0);

        assertEq(yesOut, 213692635182807876);
        assertEq(pool.xActive(), 1e18 + 1e15);
        assertEq(pool.yActive(), 3786307364817192124);
    }

    function testBuyNoUsesSwappedSolveAndUpdatesReserves() public {
        uint256 noOut = pool.buyNo(1e15, 0);

        assertEq(noOut, 213692635182807876);
        assertEq(pool.xActive(), 786307364817192124);
        assertEq(pool.yActive(), 4e18 + 1e15);
    }

    function testSwapsFrozenNearExpiry() public {
        uint256 t = pool.T();
        vm.warp(t - 30 minutes);
        vm.expectRevert(PmAmmPool.Frozen.selector);
        pool.buyYes(1e15, 0);
    }

    function testBuyYesRespectsMinOut() public {
        vm.expectRevert(PmAmmPool.Slippage.selector);
        pool.buyYes(1e15, 1e18);
    }

    function testRevertsOnOffCurveKernelReturn() public {
        MaliciousMath bad = new MaliciousMath();
        pool = new PmAmmPool({
            math_: IOmniverseMath(address(bad)),
            marketId_: 0,
            xInitial: 1e18,
            yInitial: 4e18,
            l0: 6e18,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });

        vm.expectRevert(PmAmmPool.InvariantViolation.selector);
        pool.buyYes(1e15, 0);
    }

    function testReserveOverflowIsInterceptedBeforeStylusCall() public {
        pool = new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            marketId_: 0,
            xInitial: type(uint128).max,
            yInitial: 1e18,
            l0: 1e18,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });

        vm.expectRevert(PmAmmPool.KernelInputOutOfBounds.selector);
        pool.buyYes(1, 0);
    }

    function testConstructorRejectsOutOfBoundsReserve() public {
        vm.expectRevert(PmAmmPool.KernelInputOutOfBounds.selector);
        new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            marketId_: 0,
            xInitial: uint256(type(uint128).max) + 1,
            yInitial: 1e18,
            l0: 1e18,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });
    }

    function testDynamicRebalanceCallsLambdaAndPartitions() public {
        pool = new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            marketId_: 0,
            xInitial: 10e18,
            yInitial: 20e18,
            l0: 1e9,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: true
        });
        math.setLambda(0.25e18);

        vm.roll(block.number + 1);
        pool.rebalance();

        assertEq(pool.lambdaWad(), 0.25e18);
        assertEq(pool.xActive(), 2.5e18);
        assertEq(pool.yActive(), 5e18);
        assertEq(pool.xPassive(), 7.5e18);
        assertEq(pool.yPassive(), 15e18);
        assertEq(pool.ellActive(), 0.25e9);
    }

    function testLiquidityDecaysWithTime() public {
        uint256 t0 = block.timestamp;
        pool = new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            marketId_: 0,
            xInitial: 1e18,
            yInitial: 1e18,
            l0: 1e18,
            expiry: t0 + 40 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });

        assertEq(pool.currentLiquidity(), 1e18);

        // 10 of 40 days remaining => sqrt(0.25) = 0.5 => L_t ~= 0.5e18.
        vm.warp(t0 + 30 days);
        assertApproxEqAbs(pool.currentLiquidity(), 0.5e18, 1e15);

        vm.warp(t0 + 40 days);
        assertEq(pool.currentLiquidity(), pool.MIN_ELL());
    }

    function testExpiredPoolRejectsSwap() public {
        // Past expiry the freeze guard fires before _rebalance, so swaps revert Frozen.
        vm.warp(block.timestamp + 31 days);
        vm.expectRevert(PmAmmPool.Frozen.selector);
        pool.buyYes(1e15, 0);
    }

    function testRebalanceRejectedAfterExpiry() public {
        vm.warp(block.timestamp + 31 days);
        vm.roll(block.number + 1);
        vm.expectRevert(PmAmmPool.Expired.selector);
        pool.rebalance();
    }
}

/// @dev Kernel that returns an off-curve (too-generous) output to trip the invariant guard.
contract MaliciousMath {
    uint256 public constant PHI_CONST = 398_942_280_401_432_677;
    uint256 public price = 0.5e18;

    function phi(int256) external pure returns (uint256) {
        return PHI_CONST;
    }

    function Phi(int256) external view returns (uint256) {
        return price;
    }

    function PhiInv(uint256) external pure returns (int256) {
        return 0;
    }

    function solveSwap(uint256 x1, uint256, uint256 ell) external view returns (uint256 y1) {
        // On-curve y minus 0.5e18 leaves reserves off the invariant.
        uint256 onCurve = ((ell * PHI_CONST) - (x1 * price)) / (1e18 - price);
        return onCurve - 0.5e18;
    }

    function poolValue(int256) external pure returns (uint256) {
        return PHI_CONST;
    }

    function lambdaStarGaussian(uint256, uint256) external pure returns (uint256) {
        return 0.5e18;
    }
}
