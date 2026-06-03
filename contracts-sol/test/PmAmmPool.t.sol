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
            xInitial: 1e18,
            yInitial: 1e18,
            l0: 1e18,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });
    }

    function testBuyYesCallsMathAndUpdatesReserves() public {
        uint256 yesOut = pool.buyYes(1e15);

        assertEq(yesOut, 1);
        assertEq(pool.xActive(), 1e18 + 1e15);
        assertEq(pool.yActive(), 1e18 - 1);
    }

    function testBuyNoUsesSwappedSolveAndUpdatesReserves() public {
        uint256 noOut = pool.buyNo(1e15);

        assertEq(noOut, 1);
        assertEq(pool.xActive(), 1e18 - 1);
        assertEq(pool.yActive(), 1e18 + 1e15);
    }

    function testReserveOverflowIsInterceptedBeforeStylusCall() public {
        pool = new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            xInitial: type(uint128).max,
            yInitial: 1e18,
            l0: 1e18,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });

        vm.expectRevert(PmAmmPool.KernelInputOutOfBounds.selector);
        pool.buyYes(1);
    }

    function testConstructorRejectsOutOfBoundsReserve() public {
        vm.expectRevert(PmAmmPool.KernelInputOutOfBounds.selector);
        new PmAmmPool({
            math_: IOmniverseMath(address(math)),
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
    }

    function testExpiredPoolRejectsSwap() public {
        vm.warp(block.timestamp + 31 days);
        vm.expectRevert(PmAmmPool.Expired.selector);
        pool.buyYes(1e15);
    }
}
