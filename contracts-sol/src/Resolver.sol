// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";

/// @notice Owner-only resolver for binary prediction markets.
/// @dev This contract's address must be the `oracle` in the CTF's `prepareCondition`
///      call, because the real CTF gates `reportPayouts` on `msg.sender == oracle`.
contract Resolver {
    IConditionalTokens public immutable ctf;
    address public immutable owner;

    mapping(bytes32 => bool) public resolved;

    event Resolved(bytes32 indexed questionId, uint256[] payouts);

    error NotOwner();
    error AlreadyResolved();
    error InvalidPayouts();

    constructor(IConditionalTokens ctf_, address owner_) {
        require(address(ctf_) != address(0), "Resolver: zero CTF");
        require(owner_ != address(0), "Resolver: zero owner");
        ctf = ctf_;
        owner = owner_;
    }

    /// @notice Resolve a binary event. `payouts` must be length 2 (e.g. [1,0] for YES wins).
    /// @dev Only the owner can call. Double-resolution is rejected. The Resolver's address
    ///      must be the oracle address used in `prepareCondition(oracle, questionId, 2)`.
    function resolve(bytes32 questionId, uint256[] calldata payouts) external {
        if (msg.sender != owner) revert NotOwner();
        if (resolved[questionId]) revert AlreadyResolved();
        if (payouts.length != 2) revert InvalidPayouts();
        if (payouts[0] == 0 && payouts[1] == 0) revert InvalidPayouts();

        resolved[questionId] = true;
        ctf.reportPayouts(questionId, payouts);

        emit Resolved(questionId, payouts);
    }
}
