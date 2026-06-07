// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PmAmmPool} from "../src/PmAmmPool.sol";
import {IOmniverseMath} from "../src/interfaces/IOmniverseMath.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";
import {IERC1155Receiver} from "../src/interfaces/IERC1155Receiver.sol";
import {CtfPositionLib} from "../src/libraries/CtfPositionLib.sol";
import {MockConditionalTokens} from "./mocks/MockConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockOmniverseMath} from "./mocks/MockOmniverseMath.sol";

contract PmAmmPoolTest is Test {
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    MockOmniverseMath internal math;
    MockConditionalTokens internal ctf;
    MockERC20 internal collateral;
    PmAmmPool internal pool;

    bytes32 internal conditionId = keccak256("condition");
    uint256 internal yesId;
    uint256 internal noId;

    function setUp() public {
        math = new MockOmniverseMath();
        ctf = new MockConditionalTokens();
        collateral = new MockERC20("Collateral", "COL");
        yesId = CtfPositionLib.yesPositionId(address(collateral), conditionId);
        noId = CtfPositionLib.noPositionId(address(collateral), conditionId);

        pool = _deployPool(false, 6e18);
        _mintSplitApprove(alice, 1_000e18);
        _mintSplitApprove(bob, 1_000e18);
    }

    function testBuyYesTransfersErc1155AndUpdatesReserves() public {
        _seedPool(4e18, 1e18);

        vm.prank(alice);
        uint256 yesOut = pool.buyYes(1e15, 1, block.timestamp + 1);

        assertEq(yesOut, 107346317591403938);
        assertEq(pool.xActive(), 501000000000000000);
        assertEq(pool.yActive(), 1892653682408596062);
        assertEq(ctf.balanceOf(address(pool), noId), 1e18 + 1e15);
        assertEq(ctf.balanceOf(address(pool), yesId), 3892653682408596062);
    }

    function testBuyNoTransfersErc1155AndUpdatesReserves() public {
        _seedPool(4e18, 1e18);

        vm.prank(alice);
        uint256 noOut = pool.buyNo(1e15, 1, block.timestamp + 1);

        assertEq(noOut, 107346317591403938);
        assertEq(pool.xActive(), 392653682408596062);
        assertEq(pool.yActive(), 2001000000000000000);
        assertEq(ctf.balanceOf(address(pool), yesId), 4e18 + 1e15);
        assertEq(ctf.balanceOf(address(pool), noId), 892653682408596062);
    }

    function testUnapprovedInputTransferReverts() public {
        _seedPool(4e18, 1e18);
        vm.prank(alice);
        ctf.setApprovalForAll(address(pool), false);

        vm.prank(alice);
        vm.expectRevert(bytes("ERC1155: not approved"));
        pool.buyYes(1e15, 1, block.timestamp + 1);
    }

    function testSlippageDeadlineZeroAmountAndFreezeReverts() public {
        _seedPool(4e18, 1e18);

        vm.prank(alice);
        vm.expectRevert(PmAmmPool.InvalidAmount.selector);
        pool.buyYes(0, 0, block.timestamp + 1);

        vm.prank(alice);
        vm.expectRevert(PmAmmPool.DeadlineExpired.selector);
        pool.buyYes(1e15, 0, block.timestamp - 1);

        vm.prank(alice);
        vm.expectRevert(PmAmmPool.Slippage.selector);
        pool.buyYes(1e15, 1e18, block.timestamp + 1);

        vm.warp(pool.T() - 30 minutes);
        vm.prank(alice);
        vm.expectRevert(PmAmmPool.Frozen.selector);
        pool.buyYes(1e15, 1, type(uint256).max);
    }

    function testAddAndRemoveLiquidityPreservesSharesAndBalances() public {
        vm.prank(alice);
        uint256 aliceShares = pool.addLiquidity(100e18, 100e18, 100e18);
        vm.prank(bob);
        uint256 bobShares = pool.addLiquidity(50e18, 50e18, 50e18);

        assertEq(aliceShares, 100e18);
        assertEq(bobShares, 50e18);
        assertEq(pool.totalShares(), 150e18);
        assertEq(pool.sharesOf(alice), 100e18);
        assertEq(pool.sharesOf(bob), 50e18);

        vm.prank(alice);
        (uint256 yesOut, uint256 noOut) = pool.removeLiquidity(50e18, 49e18, 49e18);

        assertEq(yesOut, 50e18);
        assertEq(noOut, 50e18);
        assertEq(pool.totalShares(), 100e18);
        assertEq(pool.sharesOf(alice), 50e18);
        assertEq(ctf.balanceOf(address(pool), yesId), 100e18);
        assertEq(ctf.balanceOf(address(pool), noId), 100e18);
    }

    function testRevertsOnOffCurveKernelReturn() public {
        MaliciousMath bad = new MaliciousMath();
        pool = new PmAmmPool({
            math_: IOmniverseMath(address(bad)),
            conditionalTokens_: IConditionalTokens(address(ctf)),
            collateralToken_: address(collateral),
            conditionId_: conditionId,
            marketId_: 0,
            xInitial: 0,
            yInitial: 0,
            l0: 6e18,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });
        vm.prank(alice);
        ctf.setApprovalForAll(address(pool), true);
        vm.prank(alice);
        pool.addLiquidity(4e18, 1e18, 1e18);

        vm.prank(alice);
        vm.expectRevert(PmAmmPool.InvariantViolation.selector);
        pool.buyYes(1e15, 0, block.timestamp + 1);
    }

    function testDynamicRebalanceCallsLambdaAndPartitions() public {
        pool = _deployPool(true, 1e9);
        math.setLambda(0.25e18);
        vm.prank(alice);
        ctf.setApprovalForAll(address(pool), true);
        vm.prank(alice);
        pool.addLiquidity(20e18, 10e18, 10e18);

        vm.roll(block.number + 1);
        pool.rebalance();

        assertEq(pool.lambdaWad(), 0.25e18);
        assertEq(pool.xActive(), 2.5e18);
        assertEq(pool.yActive(), 5e18);
        assertEq(pool.xPassive(), 7.5e18);
        assertEq(pool.yPassive(), 15e18);
        assertEq(pool.ellActive(), 2500000000000000000);

        pool.rebalance();
        assertEq(pool.nLast(), block.number);
        assertEq(pool.xActive(), 2.5e18);
    }

    function testLiquidityDecaysWithTime() public {
        uint256 t0 = block.timestamp;
        pool = new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            conditionalTokens_: IConditionalTokens(address(ctf)),
            collateralToken_: address(collateral),
            conditionId_: conditionId,
            marketId_: 0,
            xInitial: 0,
            yInitial: 0,
            l0: 1e18,
            expiry: t0 + 40 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });

        assertEq(pool.currentLiquidity(), 1e18);

        vm.warp(t0 + 30 days);
        assertApproxEqAbs(pool.currentLiquidity(), 0.5e18, 1e15);

        vm.warp(t0 + 40 days);
        assertEq(pool.currentLiquidity(), pool.MIN_ELL());
    }

    function testRebalanceRejectedAfterExpiry() public {
        vm.warp(block.timestamp + 31 days);
        vm.roll(block.number + 1);
        vm.expectRevert(PmAmmPool.Expired.selector);
        pool.rebalance();
    }

    function testReserveBalancesStaySyncedAcrossSwapSequence() public {
        _seedPool(4e18, 1e18);

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(alice);
            pool.buyYes(1e15 + i, 1, block.timestamp + 1);
            _assertPoolBalancesMatchReserves();

            vm.prank(bob);
            pool.buyNo(1e15 + i, 1, block.timestamp + 1);
            _assertPoolBalancesMatchReserves();
        }

        vm.roll(block.number + 1);
        pool.rebalance();
        _assertPoolBalancesMatchReserves();
    }

    function testCurrentPriceUsesClosedFormMathCall() public {
        _seedPool(4e18, 1e18);
        math.setPrice(0.42e18);
        assertEq(pool.currentPrice(), 0.42e18);
    }

    function testPoolRejectsUnexpectedErc1155Position() public {
        uint256 unexpected = uint256(keccak256("unexpected"));
        vm.expectRevert(PmAmmPool.InvalidToken.selector);
        pool.onERC1155Received(address(this), alice, unexpected, 1, "");
    }

    function testReentrantReceiverCannotEnterSwap() public {
        _seedPool(4e18, 1e18);
        ReentrantBuyer buyer = new ReentrantBuyer(pool, ctf, noId);
        vm.prank(alice);
        ctf.safeTransferFrom(alice, address(buyer), noId, 10e18, "");
        buyer.approvePool();

        buyer.buyYes();

        assertTrue(buyer.sawReentrancyRevert());
        assertEq(ctf.balanceOf(address(buyer), yesId), 107346317591403938);
    }

    function testReserveOverflowIsInterceptedBeforeMathCall() public {
        pool = new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            conditionalTokens_: IConditionalTokens(address(ctf)),
            collateralToken_: address(collateral),
            conditionId_: conditionId,
            marketId_: 0,
            xInitial: type(uint128).max,
            yInitial: 1e18,
            l0: 1e18,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });

        vm.expectRevert(PmAmmPool.KernelInputOutOfBounds.selector);
        pool.buyYes(1, 0, block.timestamp + 1);
    }

    function testConstructorRejectsOutOfBoundsReserve() public {
        vm.expectRevert(PmAmmPool.KernelInputOutOfBounds.selector);
        new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            conditionalTokens_: IConditionalTokens(address(ctf)),
            collateralToken_: address(collateral),
            conditionId_: conditionId,
            marketId_: 0,
            xInitial: uint256(type(uint128).max) + 1,
            yInitial: 1e18,
            l0: 1e18,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });
    }

    function _deployPool(bool dynamicLambda, uint256 l0) internal returns (PmAmmPool) {
        return new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            conditionalTokens_: IConditionalTokens(address(ctf)),
            collateralToken_: address(collateral),
            conditionId_: conditionId,
            marketId_: 0,
            xInitial: 0,
            yInitial: 0,
            l0: l0,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: dynamicLambda
        });
    }

    function _mintSplitApprove(address user, uint256 amount) internal {
        collateral.mint(user, amount);
        vm.startPrank(user);
        collateral.approve(address(ctf), amount);
        ctf.splitPosition(address(collateral), bytes32(0), conditionId, CtfPositionLib.binaryPartition(), amount);
        ctf.setApprovalForAll(address(pool), true);
        vm.stopPrank();
    }

    function _seedPool(uint256 yesAmount, uint256 noAmount) internal {
        vm.prank(alice);
        pool.addLiquidity(yesAmount, noAmount, _min(yesAmount, noAmount));
    }

    function _assertPoolBalancesMatchReserves() internal view {
        assertEq(ctf.balanceOf(address(pool), noId), pool.xActive() + pool.xPassive());
        assertEq(ctf.balanceOf(address(pool), yesId), pool.yActive() + pool.yPassive());
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}

contract ReentrantBuyer is IERC1155Receiver {
    PmAmmPool internal pool;
    MockConditionalTokens internal ctf;
    uint256 internal noId;
    bool public sawReentrancyRevert;

    constructor(PmAmmPool pool_, MockConditionalTokens ctf_, uint256 noId_) {
        pool = pool_;
        ctf = ctf_;
        noId = noId_;
    }

    function approvePool() external {
        ctf.setApprovalForAll(address(pool), true);
    }

    function buyYes() external {
        pool.buyYes(1e15, 1, block.timestamp + 1);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4) {
        try pool.buyYes(1, 0, block.timestamp + 1) {
            sawReentrancyRevert = false;
        } catch (bytes memory data) {
            sawReentrancyRevert = data.length == 4 && bytes4(data) == PmAmmPool.Reentrancy.selector;
        }
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}

/// @dev Kernel that returns an off-curve output to trip the invariant guard.
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
