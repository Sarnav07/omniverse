// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {PmAmmPool} from "../src/PmAmmPool.sol";
import {IOmniverseMath} from "../src/interfaces/IOmniverseMath.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";
import {CtfPositionLib} from "../src/libraries/CtfPositionLib.sol";
import {MockConditionalTokens} from "./mocks/MockConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockOmniverseMath} from "./mocks/MockOmniverseMath.sol";

contract MarketFactoryTest is Test {
    address internal alice = address(0xA11CE);

    MockOmniverseMath internal math;
    MockConditionalTokens internal ctf;
    MockERC20 internal weth;
    MockERC20 internal usdc;
    MarketFactory internal factory;

    string internal question = "Will it rain tomorrow?";
    address internal resolver = address(0xDEAD);

    function setUp() public {
        math = new MockOmniverseMath();
        ctf = new MockConditionalTokens();
        weth = new MockERC20("Wrapped Ether", "WETH");
        usdc = new MockERC20("USD Coin", "USDC");
        factory = new MarketFactory(
            IOmniverseMath(address(math)), IConditionalTokens(address(ctf)), address(weth), address(usdc)
        );
    }

    function testCreateEventRegistersTwoPools() public {
        (PmAmmPool poolWeth, PmAmmPool poolUsdc) = _createEvent();

        assertEq(poolWeth.collateralToken(), address(weth));
        assertEq(poolUsdc.collateralToken(), address(usdc));
        assertEq(factory.getMarkets().length, 2);
        assertEq(address(factory.getMarket(0)), address(poolWeth));
        assertEq(address(factory.getMarket(1)), address(poolUsdc));
    }

    function testBothPoolsShareOneConditionId() public {
        (PmAmmPool poolWeth, PmAmmPool poolUsdc) = _createEvent();

        bytes32 questionId = keccak256(bytes(question));
        bytes32 expected = keccak256(abi.encodePacked(resolver, questionId, uint256(2)));
        assertEq(poolWeth.conditionId(), expected);
        assertEq(poolWeth.conditionId(), poolUsdc.conditionId());
        assertTrue(ctf.prepared(expected));
    }

    function testEachPoolDerivesPositionIdsForOwnCollateral() public {
        (PmAmmPool poolWeth, PmAmmPool poolUsdc) = _createEvent();
        bytes32 conditionId = poolWeth.conditionId();

        assertEq(poolWeth.yesPositionId(), CtfPositionLib.yesPositionId(address(weth), conditionId));
        assertEq(poolWeth.noPositionId(), CtfPositionLib.noPositionId(address(weth), conditionId));
        assertEq(poolUsdc.yesPositionId(), CtfPositionLib.yesPositionId(address(usdc), conditionId));
        assertEq(poolUsdc.noPositionId(), CtfPositionLib.noPositionId(address(usdc), conditionId));
        assertTrue(poolWeth.yesPositionId() != poolUsdc.yesPositionId());
    }

    function testMarketsOfConditionHoldsBothPools() public {
        (PmAmmPool poolWeth, PmAmmPool poolUsdc) = _createEvent();
        bytes32 conditionId = poolWeth.conditionId();

        address[] memory pools = factory.marketsOfCondition(conditionId);
        assertEq(pools.length, 2);
        assertEq(pools[0], address(poolWeth));
        assertEq(pools[1], address(poolUsdc));
    }

    function testDuplicateQuestionReverts() public {
        _createEvent();
        vm.expectRevert(MarketFactory.AlreadyExists.selector);
        _createEvent();
    }

    function testWethPoolIsIndependentlyTradeable() public {
        (PmAmmPool poolWeth,) = _createEvent();
        bytes32 conditionId = poolWeth.conditionId();
        _splitApprove(alice, address(weth), conditionId, address(poolWeth), 1_000e18);

        vm.prank(alice);
        poolWeth.addLiquidity(4e18, 1e18, 1e18);

        vm.prank(alice);
        uint256 yesOut = poolWeth.buyYes(1e15, 1, block.timestamp + 1);

        assertEq(yesOut, 107346317591403938);
        assertEq(poolWeth.xActive(), 501000000000000000);
    }

    function _createEvent() internal returns (PmAmmPool, PmAmmPool) {
        return factory.createEvent(question, "SYM", "cat", block.timestamp + 30 days, resolver, 6e18, 2e18, false);
    }

    function _splitApprove(address user, address collateral, bytes32 conditionId, address pool, uint256 amount)
        internal
    {
        MockERC20(collateral).mint(user, amount);
        vm.startPrank(user);
        MockERC20(collateral).approve(address(ctf), amount);
        ctf.splitPosition(collateral, bytes32(0), conditionId, CtfPositionLib.binaryPartition(), amount);
        ctf.setApprovalForAll(pool, true);
        vm.stopPrank();
    }
}
