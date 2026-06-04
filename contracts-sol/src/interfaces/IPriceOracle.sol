// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ETH/USD spot price, WAD-scaled (1e18 == $1 per ETH).
/// @dev A production reader (Phase 6, Chainlink) MUST revert on stale or
///      non-positive answers; the fail-closed behaviour lives in the impl, not here.
interface IPriceOracle {
    function priceWad() external view returns (uint256);
}
