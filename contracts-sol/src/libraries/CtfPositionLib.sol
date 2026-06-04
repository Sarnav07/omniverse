// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library CtfPositionLib {
    bytes32 internal constant PARENT_COLLECTION_ID = bytes32(0);
    uint256 internal constant YES_INDEX_SET = 1;
    uint256 internal constant NO_INDEX_SET = 2;

    function binaryPartition() internal pure returns (uint256[] memory partition) {
        partition = new uint256[](2);
        partition[0] = YES_INDEX_SET;
        partition[1] = NO_INDEX_SET;
    }

    function collectionId(bytes32 conditionId, uint256 indexSet) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PARENT_COLLECTION_ID, conditionId, indexSet));
    }

    function positionId(address collateralToken, bytes32 conditionId, uint256 indexSet)
        internal
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encodePacked(collateralToken, collectionId(conditionId, indexSet))));
    }

    function yesPositionId(address collateralToken, bytes32 conditionId) internal pure returns (uint256) {
        return positionId(collateralToken, conditionId, YES_INDEX_SET);
    }

    function noPositionId(address collateralToken, bytes32 conditionId) internal pure returns (uint256) {
        return positionId(collateralToken, conditionId, NO_INDEX_SET);
    }
}
