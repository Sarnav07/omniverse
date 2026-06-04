// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {PmAmmPool} from "../src/PmAmmPool.sol";
import {MultiverseLending} from "../src/MultiverseLending.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";
import {IERC20Minimal} from "../src/interfaces/IERC20Minimal.sol";
import {CtfPositionLib} from "../src/libraries/CtfPositionLib.sol";


/// @notice Resets the demo by creating a NEW event (since resolutions are permanent)
///         and seeding it exactly like SeedMarket.
contract ResetDemo is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");
        address lendingAddr = vm.envAddress("LENDING_ADDRESS");
        MarketFactory factory = MarketFactory(factoryAddr);
        MultiverseLending lending = MultiverseLending(lendingAddr);
        IConditionalTokens ctf = factory.conditionalTokens();
        IERC20Minimal weth = IERC20Minimal(factory.weth());
        IERC20Minimal usdc = IERC20Minimal(factory.usdc());
        address resolverAddr = vm.envAddress("RESOLVER_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. Create a NEW Event by appending a timestamp to make it unique
        string memory question = string(abi.encodePacked("Will ETH reach 10k in 2026? (Demo ", vm.toString(block.timestamp), ")"));
        bytes32 questionId = keccak256(bytes(question));
        uint256 expiry = block.timestamp + 30 days;
        uint256 l0 = 6e18;
        uint256 gammaPrime = 2e18;
        
        (PmAmmPool wethPool, PmAmmPool usdcPool) = factory.createEvent(
            question, expiry, resolverAddr, l0, gammaPrime, false
        );
        bytes32 conditionId = wethPool.conditionId();
        console.log("Created NEW Event (questionId):");
        console.logBytes32(questionId);
        console.log("WETH Pool:", address(wethPool));
        console.log("USDC Pool:", address(usdcPool));

        // 2. Split WETH & USDC to get positions (assume we already have WETH/USDC from previous seed)
        uint256[] memory partition = CtfPositionLib.binaryPartition();
        ctf.splitPosition(address(weth), bytes32(0), conditionId, partition, 10_000e18);
        ctf.splitPosition(address(usdc), bytes32(0), conditionId, partition, 50_000e18);
        
        // 3. Add Liquidity
        ctf.setApprovalForAll(address(wethPool), true);
        ctf.setApprovalForAll(address(usdcPool), true);
        wethPool.addLiquidity(5_000e18, 5_000e18, 5_000e18);
        usdcPool.addLiquidity(20_000e18, 20_000e18, 20_000e18);

        // 4. Update lending config if needed (lending handles 1 condition per instance, wait! 
        // Let's check MultiverseLending constructor. MultiverseLending is deployed PER condition.)
        
        console.log("NOTE: MultiverseLending is bound to a single condition ID!");
        console.log("To fully reset the demo, you must deploy a NEW MultiverseLending instance with the new conditionId.");
        
        vm.stopBroadcast();
    }
}
