// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @notice Fail-closed Chainlink ETH/USD reader implementing IPriceOracle.
/// @dev Reverts on stale, non-positive, or round-incomplete answers so any
///      downstream consumer (e.g. MultiverseLending HF) fails safe.
contract ChainlinkPriceOracle is IPriceOracle {
    uint256 public constant WAD = 1e18;

    IAggregatorV3 public immutable feed;
    uint256 public immutable heartbeat;
    uint256 internal immutable _scaleFactor;

    error StaleAnswer();
    error NonPositiveAnswer();
    error IncompleteRound();

    /// @param feed_ Chainlink aggregator address (e.g. ETH/USD on Arbitrum).
    /// @param heartbeat_ Maximum acceptable staleness in seconds (e.g. 3600 for ETH/USD).
    constructor(IAggregatorV3 feed_, uint256 heartbeat_) {
        require(address(feed_) != address(0), "ChainlinkPriceOracle: zero feed");
        require(heartbeat_ > 0, "ChainlinkPriceOracle: zero heartbeat");
        feed = feed_;
        heartbeat = heartbeat_;
        // Pre-compute the scale factor: WAD / 10^feedDecimals.
        // ETH/USD typically has 8 decimals → scaleFactor = 1e10.
        _scaleFactor = WAD / (10 ** feed_.decimals());
    }

    /// @notice Returns the ETH/USD price in WAD (1e18 == $1).
    /// @dev Reverts if the answer is stale, non-positive, or the round is incomplete.
    function priceWad() external view override returns (uint256) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();

        if (answer <= 0) revert NonPositiveAnswer();
        if (answeredInRound < roundId) revert IncompleteRound();
        if (block.timestamp - updatedAt > heartbeat) revert StaleAnswer();

        return uint256(answer) * _scaleFactor;
    }
}
