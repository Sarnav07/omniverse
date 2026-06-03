// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Solidity interface for the Arbitrum Stylus OmniverseMath kernel.
/// @dev Function names are case-sensitive ABI selectors. `Phi` and `PhiInv`
/// must match the Rust `#[selector(name = "...")]` exports exactly.
interface IOmniverseMath {
    function phi(int256 z) external pure returns (uint256);
    function Phi(int256 z) external pure returns (uint256);
    function PhiInv(uint256 p) external pure returns (int256 z);
    function solveSwap(uint256 x1, uint256 y0, uint256 ell) external pure returns (uint256 y1);
    function poolValue(int256 z) external pure returns (uint256);
    function lambdaStarGaussian(uint256 gammaPrime, uint256 p) external pure returns (uint256);
}
