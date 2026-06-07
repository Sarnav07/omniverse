// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOmniverseMath} from "./interfaces/IOmniverseMath.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";
import {PmAmmPool} from "./PmAmmPool.sol";

/// @notice Deploys a paired WETH/USDC pm-AMM market per binary event over a shared CTF condition.
contract MarketFactory {
    uint256 internal constant OUTCOME_SLOTS = 2;

    IOmniverseMath public immutable math;
    IConditionalTokens public immutable conditionalTokens;
    address public immutable weth;
    address public immutable usdc;

    PmAmmPool[] public markets;
    mapping(bytes32 => bool) public questionUsed;
    mapping(bytes32 => address[]) internal _marketsOfCondition;

    event EventCreated(
        bytes32 indexed conditionId,
        bytes32 indexed questionId,
        address resolver,
        address poolWeth,
        address poolUsdc,
        uint256 wethMarketId,
        uint256 usdcMarketId,
        string question,
        string symbol,
        string category
    );

    error AlreadyExists();

    constructor(IOmniverseMath math_, IConditionalTokens conditionalTokens_, address weth_, address usdc_) {
        math = math_;
        conditionalTokens = conditionalTokens_;
        weth = weth_;
        usdc = usdc_;
    }

    function createEvent(
        string calldata question,
        string calldata symbol,
        string calldata category,
        uint256 expiry,
        address resolver,
        uint256 l0,
        uint256 gammaPrime,
        bool useDynamicLambda
    ) external returns (PmAmmPool poolWeth, PmAmmPool poolUsdc) {
        bytes32 questionId = keccak256(bytes(question));
        if (questionUsed[questionId]) revert AlreadyExists();
        questionUsed[questionId] = true;

        conditionalTokens.prepareCondition(resolver, questionId, OUTCOME_SLOTS);
        bytes32 conditionId = conditionalTokens.getConditionId(resolver, questionId, OUTCOME_SLOTS);

        // WETH = tradeable universe, USDC = lending debt universe.
        poolWeth = _deploy(weth, conditionId, l0, expiry, gammaPrime, useDynamicLambda);
        poolUsdc = _deploy(usdc, conditionId, l0, expiry, gammaPrime, useDynamicLambda);

        _marketsOfCondition[conditionId].push(address(poolWeth));
        _marketsOfCondition[conditionId].push(address(poolUsdc));

        emit EventCreated(
            conditionId,
            questionId,
            resolver,
            address(poolWeth),
            address(poolUsdc),
            poolWeth.marketId(),
            poolUsdc.marketId(),
            question,
            symbol,
            category
        );
    }

    function getMarkets() external view returns (PmAmmPool[] memory) {
        return markets;
    }

    function getMarket(uint256 id) external view returns (PmAmmPool) {
        return markets[id];
    }

    function marketsOfCondition(bytes32 conditionId) external view returns (address[] memory) {
        return _marketsOfCondition[conditionId];
    }

    function _deploy(
        address collateral,
        bytes32 conditionId,
        uint256 l0,
        uint256 expiry,
        uint256 gammaPrime,
        bool useDynamicLambda
    ) internal returns (PmAmmPool pool) {
        pool = new PmAmmPool(
            math, conditionalTokens, collateral, conditionId, markets.length, 0, 0, l0, expiry, gammaPrime, useDynamicLambda
        );
        markets.push(pool);
    }
}
