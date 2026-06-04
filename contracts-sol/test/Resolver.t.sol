// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Resolver} from "../src/Resolver.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";
import {CtfPositionLib} from "../src/libraries/CtfPositionLib.sol";
import {MockConditionalTokens} from "./mocks/MockConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract ResolverTest is Test {
    MockConditionalTokens internal ctf;
    MockERC20 internal collateral;
    Resolver internal resolver;

    address internal owner = address(0xBEEF);
    bytes32 internal questionId = keccak256("will-eth-hit-10k");
    bytes32 internal conditionId;

    function setUp() public {
        ctf = new MockConditionalTokens();
        collateral = new MockERC20("Collateral", "COL");
        resolver = new Resolver(IConditionalTokens(address(ctf)), owner);

        // The resolver's address is the oracle for this condition.
        ctf.prepareCondition(address(resolver), questionId, 2);
        conditionId = ctf.getConditionId(address(resolver), questionId, 2);
    }

    function testResolveYesSetsPayout() public {
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        payouts[1] = 0;

        vm.prank(owner);
        resolver.resolve(questionId, payouts);

        assertTrue(resolver.resolved(questionId));
        assertEq(ctf.payoutDenominator(conditionId), 1);
        assertEq(ctf.payoutNumerators(conditionId, 0), 1);
        assertEq(ctf.payoutNumerators(conditionId, 1), 0);
    }

    function testResolveNoSetsPayout() public {
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 0;
        payouts[1] = 1;

        vm.prank(owner);
        resolver.resolve(questionId, payouts);

        assertEq(ctf.payoutNumerators(conditionId, 0), 0);
        assertEq(ctf.payoutNumerators(conditionId, 1), 1);
    }

    function testResolveAndRedeemWinnerGetsCollateral() public {
        // Split collateral.
        collateral.mint(address(this), 1_000e18);
        collateral.approve(address(ctf), 1_000e18);
        ctf.splitPosition(address(collateral), bytes32(0), conditionId, CtfPositionLib.binaryPartition(), 1_000e18);

        // Resolve: YES wins.
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        payouts[1] = 0;
        vm.prank(owner);
        resolver.resolve(questionId, payouts);

        // Redeem: YES holder (index set 1) gets collateral 1:1, NO gets 0.
        uint256[] memory indexSets = new uint256[](2);
        indexSets[0] = 1;
        indexSets[1] = 2;
        uint256 balBefore = collateral.balanceOf(address(this));
        ctf.redeemPositions(address(collateral), bytes32(0), conditionId, indexSets);

        assertEq(collateral.balanceOf(address(this)), balBefore + 1_000e18);
    }

    function testOnlyOwnerCanResolve() public {
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        payouts[1] = 0;

        vm.prank(address(0xBAD));
        vm.expectRevert(Resolver.NotOwner.selector);
        resolver.resolve(questionId, payouts);
    }

    function testDoubleResolveReverts() public {
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        payouts[1] = 0;

        vm.prank(owner);
        resolver.resolve(questionId, payouts);

        vm.prank(owner);
        vm.expectRevert(Resolver.AlreadyResolved.selector);
        resolver.resolve(questionId, payouts);
    }

    function testInvalidPayoutsLengthReverts() public {
        uint256[] memory payouts = new uint256[](3);
        payouts[0] = 1;
        payouts[1] = 0;
        payouts[2] = 0;

        vm.prank(owner);
        vm.expectRevert(Resolver.InvalidPayouts.selector);
        resolver.resolve(questionId, payouts);
    }

    function testZeroPayoutsReverts() public {
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 0;
        payouts[1] = 0;

        vm.prank(owner);
        vm.expectRevert(Resolver.InvalidPayouts.selector);
        resolver.resolve(questionId, payouts);
    }

    function testResolverMustBeTheOracle() public {
        // Prepare a condition with a DIFFERENT oracle address.
        bytes32 otherQ = keccak256("other-question");
        address otherOracle = address(0xFACE);
        ctf.prepareCondition(otherOracle, otherQ, 2);

        // The resolver is NOT the oracle for this condition, so reportPayouts
        // should fail because msg.sender (resolver) != oracle registered in CTF.
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        payouts[1] = 0;

        vm.prank(owner);
        vm.expectRevert(); // CTF mock: "condition not prepared or wrong oracle"
        resolver.resolve(otherQ, payouts);
    }

    function testResolvedEventEmitted() public {
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 0;
        payouts[1] = 1;

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit Resolver.Resolved(questionId, payouts);
        resolver.resolve(questionId, payouts);
    }
}
