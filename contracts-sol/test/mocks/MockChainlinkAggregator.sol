// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAggregatorV3} from "../../src/interfaces/IAggregatorV3.sol";

/// @notice Test mock for Chainlink AggregatorV3. All fields are settable.
contract MockChainlinkAggregator is IAggregatorV3 {
    uint8 public override decimals;
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId;
    uint80 public answeredInRound;

    constructor(uint8 decimals_, int256 answer_, uint256 updatedAt_) {
        decimals = decimals_;
        answer = answer_;
        updatedAt = updatedAt_;
        roundId = 1;
        answeredInRound = 1;
    }

    function setAnswer(int256 answer_) external {
        answer = answer_;
    }

    function setUpdatedAt(uint256 updatedAt_) external {
        updatedAt = updatedAt_;
    }

    function setRoundData(uint80 roundId_, uint80 answeredInRound_) external {
        roundId = roundId_;
        answeredInRound = answeredInRound_;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, answer, 0, updatedAt, answeredInRound);
    }
}
