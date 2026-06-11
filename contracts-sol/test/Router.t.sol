// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {OmniverseRouter} from "../src/Router.sol";
import {MultiverseLending} from "../src/MultiverseLending.sol";
import {PmAmmPool} from "../src/PmAmmPool.sol";
import {MockConditionalTokens} from "./mocks/MockConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {CtfPositionLib} from "../src/libraries/CtfPositionLib.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {OmniverseMathSolidity} from "../src/OmniverseMathSolidity.sol";

contract RouterTest is Test {
    OmniverseRouter router;
    MockConditionalTokens ctf;
    MockERC20 weth;
    MockERC20 usdc;
    MarketFactory factory;
    OmniverseMathSolidity math;
    
    address alice = address(0x1);
    address resolver = address(0x2);

    PmAmmPool wethPool;
    PmAmmPool usdcPool;
    bytes32 conditionId;

    function setUp() public {
        ctf = new MockConditionalTokens();
        weth = new MockERC20("WETH", "WETH");
        usdc = new MockERC20("USDC", "USDC");
        math = new OmniverseMathSolidity();

        router = new OmniverseRouter(ctf, address(weth), address(usdc));

        weth.mint(alice, 100_000e18);
        usdc.mint(alice, 100_000e18);

        vm.startPrank(alice);
        weth.approve(address(router), type(uint256).max);
        usdc.approve(address(router), type(uint256).max);
        weth.approve(address(ctf), type(uint256).max);
        usdc.approve(address(ctf), type(uint256).max);
        vm.stopPrank();

        _setupEvent();
    }

    function _setupEvent() internal {
        conditionId = bytes32(uint256(1));
        ctf.prepareCondition(resolver, conditionId, 2);

        usdcPool = new PmAmmPool(
            math, ctf, address(usdc), conditionId, 1, 0, 0, 10_000e18, block.timestamp + 30 days, 2e18, false
        );
        // The live demo trades on the WETH-collateral pool; cover both universes.
        wethPool = new PmAmmPool(
            math, ctf, address(weth), conditionId, 2, 0, 0, 10_000e18, block.timestamp + 30 days, 2e18, false
        );

        // Add liquidity to both pools directly
        vm.startPrank(alice);
        ctf.splitPosition(address(usdc), bytes32(0), conditionId, CtfPositionLib.binaryPartition(), 50_000e18);
        ctf.setApprovalForAll(address(usdcPool), true);
        usdcPool.addLiquidity(10_000e18, 10_000e18, 0);

        ctf.splitPosition(address(weth), bytes32(0), conditionId, CtfPositionLib.binaryPartition(), 50_000e18);
        ctf.setApprovalForAll(address(wethPool), true);
        wethPool.addLiquidity(10_000e18, 10_000e18, 0);
        vm.stopPrank();
    }

    function testRouterBuyYes() public {
        vm.startPrank(alice);
        uint256 usdcAmount = 1000e18;
        
        uint256 balanceBefore = ctf.balanceOf(alice, usdcPool.yesPositionId());
        router.buyYes(usdcPool, conditionId, usdcAmount, 0);
        uint256 balanceAfter = ctf.balanceOf(alice, usdcPool.yesPositionId());
        
        assertGt(balanceAfter - balanceBefore, usdcAmount); // Should get split YES + swap YES
        vm.stopPrank();
    }

    function testRouterBuyYesOnWethPool() public {
        // Regression: the WETH pool's collateral is WETH, so the router must pull WETH.
        // The old hardcoded-usdc router reverted here with "ERC20: allowance".
        vm.startPrank(alice);
        uint256 amount = 1000e18;

        uint256 balanceBefore = ctf.balanceOf(alice, wethPool.yesPositionId());
        router.buyYes(wethPool, conditionId, amount, 0);
        uint256 balanceAfter = ctf.balanceOf(alice, wethPool.yesPositionId());

        assertGt(balanceAfter - balanceBefore, amount); // split YES-WETH + swap YES-WETH
        vm.stopPrank();
    }

    function testRouterBuyNo() public {
        vm.startPrank(alice);
        uint256 usdcAmount = 1000e18;
        
        uint256 balanceBefore = ctf.balanceOf(alice, usdcPool.noPositionId());
        router.buyNo(usdcPool, conditionId, usdcAmount, 0);
        uint256 balanceAfter = ctf.balanceOf(alice, usdcPool.noPositionId());
        
        assertGt(balanceAfter - balanceBefore, usdcAmount); // Should get split NO + swap NO
        vm.stopPrank();
    }

    function testRouterAddLiquidity() public {
        vm.startPrank(alice);
        uint256 usdcAmount = 1000e18;
        
        uint256 sharesBefore = usdcPool.sharesOf(alice);
        router.addLiquidity(usdcPool, conditionId, usdcAmount, 0);
        uint256 sharesAfter = usdcPool.sharesOf(alice);
        
        assertGt(sharesAfter, sharesBefore);
        vm.stopPrank();
    }
}
