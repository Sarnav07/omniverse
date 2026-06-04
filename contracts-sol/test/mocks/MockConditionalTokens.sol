// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IConditionalTokens} from "../../src/interfaces/IConditionalTokens.sol";
import {IERC1155Receiver} from "../../src/interfaces/IERC1155Receiver.sol";
import {IERC20Minimal} from "../../src/interfaces/IERC20Minimal.sol";
import {CtfPositionLib} from "../../src/libraries/CtfPositionLib.sol";

contract MockConditionalTokens is IConditionalTokens {
    mapping(address => mapping(uint256 => uint256)) public override balanceOf;
    mapping(address => mapping(address => bool)) public override isApprovedForAll;
    mapping(bytes32 => bool) public prepared;
    mapping(bytes32 => uint256) public payoutIndexSet;
    mapping(bytes32 => uint256) public override payoutDenominator;
    mapping(bytes32 => mapping(uint256 => uint256)) internal _payoutNumerators;

    // Track oracle per conditionId so reportPayouts can verify msg.sender.
    mapping(bytes32 => address) public oracleOf;
    // Track questionId → conditionId for resolution lookups.
    mapping(bytes32 => bytes32) internal _questionCondition;

    function payoutNumerators(bytes32 conditionId, uint256 index) external view override returns (uint256) {
        return _payoutNumerators[conditionId][index];
    }

    function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external {
        require(outcomeSlotCount == 2, "CTF: binary only");
        bytes32 cid = getConditionId(oracle, questionId, outcomeSlotCount);
        prepared[cid] = true;
        oracleOf[cid] = oracle;
        _questionCondition[_oracleQuestionKey(oracle, questionId)] = cid;
    }

    function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(oracle, questionId, outcomeSlotCount));
    }

    function splitPosition(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external {
        require(parentCollectionId == bytes32(0), "CTF: parent");
        require(partition.length == 2 && partition[0] == 1 && partition[1] == 2, "CTF: partition");
        require(IERC20Minimal(collateralToken).transferFrom(msg.sender, address(this), amount), "CTF: pull");

        balanceOf[
                msg.sender
            ][getPositionId(collateralToken, getCollectionId(parentCollectionId, conditionId, 1))] += amount;
        balanceOf[
                msg.sender
            ][getPositionId(collateralToken, getCollectionId(parentCollectionId, conditionId, 2))] += amount;
    }

    function mergePositions(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external {
        require(parentCollectionId == bytes32(0), "CTF: parent");
        require(partition.length == 2 && partition[0] == 1 && partition[1] == 2, "CTF: partition");

        uint256 yesId = getPositionId(collateralToken, getCollectionId(parentCollectionId, conditionId, 1));
        uint256 noId = getPositionId(collateralToken, getCollectionId(parentCollectionId, conditionId, 2));
        _burn(msg.sender, yesId, amount);
        _burn(msg.sender, noId, amount);
        require(IERC20Minimal(collateralToken).transfer(msg.sender, amount), "CTF: return");
    }

    function redeemPositions(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata indexSets
    ) external {
        require(parentCollectionId == bytes32(0), "CTF: parent");
        uint256 winner = payoutIndexSet[conditionId];
        require(winner == 1 || winner == 2, "CTF: unresolved");

        uint256 payout;
        for (uint256 i = 0; i < indexSets.length; i++) {
            uint256 id = getPositionId(collateralToken, getCollectionId(parentCollectionId, conditionId, indexSets[i]));
            uint256 amount = balanceOf[msg.sender][id];
            if (amount == 0) continue;
            _burn(msg.sender, id, amount);
            if (indexSets[i] == winner) payout += amount;
        }

        if (payout > 0) {
            require(IERC20Minimal(collateralToken).transfer(msg.sender, payout), "CTF: redeem");
        }
    }

    /// @notice Matches the real Gnosis CTF signature: keyed by questionId, payout
    ///         numerator array. The conditionId is derived from (msg.sender, questionId, 2)
    ///         because the real CTF only accepts reportPayouts from the oracle address that
    ///         was named in prepareCondition.
    function reportPayouts(bytes32 questionId, uint256[] calldata payouts) external {
        require(payouts.length == 2, "CTF: binary");
        bytes32 cid = _questionCondition[_oracleQuestionKey(msg.sender, questionId)];
        require(cid != bytes32(0), "CTF: condition not prepared or wrong oracle");

        // Store payout numerators.
        uint256 denom = payouts[0] + payouts[1];
        require(denom > 0, "CTF: zero payouts");
        payoutDenominator[cid] = denom;
        _payoutNumerators[cid][0] = payouts[0];
        _payoutNumerators[cid][1] = payouts[1];

        // Derive winning index set for the simplified redeemPositions logic.
        // Binary: payouts[0] > 0 means slot 0 (YES / indexSet 1) wins.
        if (payouts[0] > 0 && payouts[1] == 0) {
            payoutIndexSet[cid] = 1;
        } else if (payouts[1] > 0 && payouts[0] == 0) {
            payoutIndexSet[cid] = 2;
        } else {
            // Split resolution: pick slot 0 as "winner" for demo simplicity.
            payoutIndexSet[cid] = 1;
        }
    }

    function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(parentCollectionId, conditionId, indexSet));
    }

    function getPositionId(address collateralToken, bytes32 collectionId) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(collateralToken, collectionId)));
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "ERC1155: not approved");
        _transfer(from, to, id, amount);
        _callReceiver(msg.sender, from, to, id, amount, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external {
        require(ids.length == amounts.length, "ERC1155: length");
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "ERC1155: not approved");
        for (uint256 i = 0; i < ids.length; i++) {
            _transfer(from, to, ids[i], amounts[i]);
        }
        if (to.code.length > 0) {
            bytes4 retval = IERC1155Receiver(to).onERC1155BatchReceived(msg.sender, from, ids, amounts, data);
            require(retval == IERC1155Receiver.onERC1155BatchReceived.selector, "ERC1155: rejected");
        }
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
    }

    function _transfer(address from, address to, uint256 id, uint256 amount) internal {
        require(balanceOf[from][id] >= amount, "ERC1155: balance");
        balanceOf[from][id] -= amount;
        balanceOf[to][id] += amount;
    }

    function _burn(address owner, uint256 id, uint256 amount) internal {
        require(balanceOf[owner][id] >= amount, "ERC1155: burn");
        balanceOf[owner][id] -= amount;
    }

    function _callReceiver(address operator, address from, address to, uint256 id, uint256 amount, bytes calldata data)
        internal
    {
        if (to.code.length == 0) return;
        bytes4 retval = IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data);
        require(retval == IERC1155Receiver.onERC1155Received.selector, "ERC1155: rejected");
    }

    function _oracleQuestionKey(address oracle, bytes32 questionId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(oracle, questionId));
    }
}
