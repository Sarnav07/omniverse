// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChainlinkPriceOracle} from "../src/ChainlinkPriceOracle.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {MockChainlinkAggregator} from "./mocks/MockChainlinkAggregator.sol";

contract ChainlinkPriceOracleTest is Test {
    MockChainlinkAggregator internal agg;
    ChainlinkPriceOracle internal oracle;

    uint256 internal constant HEARTBEAT = 3600;

    function setUp() public {
        // ETH/USD: 8 decimals, $2000, updatedAt = now.
        agg = new MockChainlinkAggregator(8, 2000_00000000, block.timestamp);
        oracle = new ChainlinkPriceOracle(IAggregatorV3(address(agg)), HEARTBEAT);
    }

    function testNormalAnswerReturnsWadScaledPrice() public view {
        // $2000 with 8 decimals → 2000e18 WAD.
        assertEq(oracle.priceWad(), 2000e18);
    }

    function testDifferentPriceScalesCorrectly() public {
        agg.setAnswer(1500_00000000); // $1500
        assertEq(oracle.priceWad(), 1500e18);

        agg.setAnswer(1); // $0.00000001
        assertEq(oracle.priceWad(), 1e10); // 1 * 1e10 = 1e10
    }

    function testNonPositiveAnswerReverts() public {
        agg.setAnswer(0);
        vm.expectRevert(ChainlinkPriceOracle.NonPositiveAnswer.selector);
        oracle.priceWad();

        agg.setAnswer(-1);
        vm.expectRevert(ChainlinkPriceOracle.NonPositiveAnswer.selector);
        oracle.priceWad();
    }

    function testStaleAnswerReverts() public {
        // Move time forward past the heartbeat.
        vm.warp(block.timestamp + HEARTBEAT + 1);
        vm.expectRevert(ChainlinkPriceOracle.StaleAnswer.selector);
        oracle.priceWad();
    }

    function testFreshAnswerAtExactHeartbeatDoesNotRevert() public {
        // Exactly at the heartbeat boundary should NOT revert.
        vm.warp(block.timestamp + HEARTBEAT);
        assertEq(oracle.priceWad(), 2000e18);
    }

    function testIncompleteRoundReverts() public {
        agg.setRoundData(5, 4); // answeredInRound < roundId
        vm.expectRevert(ChainlinkPriceOracle.IncompleteRound.selector);
        oracle.priceWad();
    }

    function testCompleteRoundDoesNotRevert() public {
        agg.setRoundData(5, 5); // answeredInRound == roundId
        assertEq(oracle.priceWad(), 2000e18);

        agg.setRoundData(5, 6); // answeredInRound > roundId (edge case, should pass)
        assertEq(oracle.priceWad(), 2000e18);
    }

    function testImmutablesSetCorrectly() public view {
        assertEq(address(oracle.feed()), address(agg));
        assertEq(oracle.heartbeat(), HEARTBEAT);
    }
}
