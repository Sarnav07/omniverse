// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CtfPositionLib} from "../src/libraries/CtfPositionLib.sol";
import {MockConditionalTokens} from "./mocks/MockConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract ConditionalTokensTest is Test {
    MockConditionalTokens internal ctf;
    MockERC20 internal collateral;

    address internal oracle = address(0xDEAD);
    bytes32 internal questionId = keccak256("condition");
    bytes32 internal conditionId;
    uint256 internal yesId;
    uint256 internal noId;

    function setUp() public {
        ctf = new MockConditionalTokens();
        collateral = new MockERC20("Collateral", "COL");

        // Prepare condition via the oracle so reportPayouts will work.
        vm.prank(oracle); // not strictly needed for prepareCondition, but set up oracle
        ctf.prepareCondition(oracle, questionId, 2);
        conditionId = ctf.getConditionId(oracle, questionId, 2);

        yesId = CtfPositionLib.yesPositionId(address(collateral), conditionId);
        noId = CtfPositionLib.noPositionId(address(collateral), conditionId);
        collateral.mint(address(this), 1_000e18);
        collateral.approve(address(ctf), type(uint256).max);
    }

    function testPositionIdsMatchCtfDerivation() public view {
        bytes32 yesCollection = ctf.getCollectionId(bytes32(0), conditionId, 1);
        bytes32 noCollection = ctf.getCollectionId(bytes32(0), conditionId, 2);

        assertEq(yesId, ctf.getPositionId(address(collateral), yesCollection));
        assertEq(noId, ctf.getPositionId(address(collateral), noCollection));
        assertTrue(yesId != noId);
    }

    function testSplitMintsYesAndNoAndEscrowsCollateral() public {
        ctf.splitPosition(address(collateral), bytes32(0), conditionId, CtfPositionLib.binaryPartition(), 100e18);

        assertEq(ctf.balanceOf(address(this), yesId), 100e18);
        assertEq(ctf.balanceOf(address(this), noId), 100e18);
        assertEq(collateral.balanceOf(address(ctf)), 100e18);
    }

    function testMergeBurnsFullSetAndReturnsCollateral() public {
        ctf.splitPosition(address(collateral), bytes32(0), conditionId, CtfPositionLib.binaryPartition(), 100e18);
        uint256 balanceBefore = collateral.balanceOf(address(this));

        ctf.mergePositions(address(collateral), bytes32(0), conditionId, CtfPositionLib.binaryPartition(), 100e18);

        assertEq(ctf.balanceOf(address(this), yesId), 0);
        assertEq(ctf.balanceOf(address(this), noId), 0);
        assertEq(collateral.balanceOf(address(this)), balanceBefore + 100e18);
    }

    function testRedeemWinnerOneToOneAndLoserZero() public {
        ctf.splitPosition(address(collateral), bytes32(0), conditionId, CtfPositionLib.binaryPartition(), 100e18);

        // Resolve as oracle with payout vector [1, 0] → YES wins.
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        payouts[1] = 0;
        vm.prank(oracle);
        ctf.reportPayouts(questionId, payouts);

        uint256[] memory indexSets = new uint256[](2);
        indexSets[0] = 1;
        indexSets[1] = 2;
        uint256 balanceBefore = collateral.balanceOf(address(this));

        ctf.redeemPositions(address(collateral), bytes32(0), conditionId, indexSets);

        assertEq(collateral.balanceOf(address(this)), balanceBefore + 100e18);
        assertEq(ctf.balanceOf(address(this), yesId), 0);
        assertEq(ctf.balanceOf(address(this), noId), 0);
    }
}
