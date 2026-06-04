// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {PmAmmPool} from "../src/PmAmmPool.sol";
import {MultiverseLending} from "../src/MultiverseLending.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";
import {IERC20Minimal} from "../src/interfaces/IERC20Minimal.sol";
import {CtfPositionLib} from "../src/libraries/CtfPositionLib.sol";
import {OmniverseMathSolidity} from "../src/OmniverseMathSolidity.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";

/// @notice Seeds a local/testnet deployment with liquidity and demo positions.
contract SeedMarket is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");
        MarketFactory factory = MarketFactory(factoryAddr);
        IConditionalTokens ctf = factory.conditionalTokens();
        IERC20Minimal weth = IERC20Minimal(factory.weth());
        IERC20Minimal usdc = IERC20Minimal(factory.usdc());
        address resolverAddr = vm.envAddress("RESOLVER_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. Create Event
        string memory question = "Will ETH reach 10k in 2026?";
        bytes32 questionId = keccak256(bytes(question));
        uint256 expiry = block.timestamp + 30 days;
        uint256 l0 = 6e18;
        uint256 gammaPrime = 2e18;
        
        (PmAmmPool wethPool, PmAmmPool usdcPool) = factory.createEvent(
            question, expiry, resolverAddr, l0, gammaPrime, false
        );
        bytes32 conditionId = wethPool.conditionId();
        console.log("Created Event (conditionId):");
        console.logBytes32(conditionId);
        console.log("WETH Pool:", address(wethPool));
        console.log("USDC Pool:", address(usdcPool));

        // 2. Mint test tokens (if mock) and approve CTF
        // Assuming MockERC20 with a mint function
        (bool successWeth, ) = address(weth).call(abi.encodeWithSignature("mint(address,uint256)", deployer, 100_000e18));
        if (successWeth) console.log("Minted Mock WETH");
        (bool successUsdc, ) = address(usdc).call(abi.encodeWithSignature("mint(address,uint256)", deployer, 100_000e18));
        if (successUsdc) console.log("Minted Mock USDC");

        weth.approve(address(ctf), type(uint256).max);
        usdc.approve(address(ctf), type(uint256).max);

        // 3. Split WETH & USDC to get positions
        uint256[] memory partition = CtfPositionLib.binaryPartition();
        ctf.splitPosition(address(weth), bytes32(0), conditionId, partition, 10_000e18);
        ctf.splitPosition(address(usdc), bytes32(0), conditionId, partition, 50_000e18);
        console.log("Split WETH and USDC positions");

        // 4. Add Liquidity
        ctf.setApprovalForAll(address(wethPool), true);
        ctf.setApprovalForAll(address(usdcPool), true);
        wethPool.addLiquidity(5_000e18, 5_000e18, 5_000e18);
        usdcPool.addLiquidity(20_000e18, 20_000e18, 20_000e18);
        console.log("Added Liquidity to pools");

        // 5. Deploy MultiverseLending for this condition and seed YES-USDC debt reserve
        MultiverseLending lending = new MultiverseLending(
            ctf,
            address(weth),
            address(usdc),
            conditionId,
            wethPool,
            IPriceOracle(vm.envAddress("ORACLE_ADDRESS"))
        );
        
        usdc.approve(address(lending), type(uint256).max);
        lending.seedReserve(10_000e18);
        console.log("Deployed MultiverseLending and seeded 10,000 USDC reserve");

        // 6. Open demo loans (Borrow)
        // Borrower puts up YES-WETH collateral and borrows YES-USDC
        // Loan 1: Alice uses 100 WETH-YES to borrow 1,000 YES-USDC
        uint256 yesWethId = wethPool.yesPositionId();
        ctf.setApprovalForAll(address(lending), true);
        
        lending.deposit(100e18);
        lending.borrow(1_000e18);
        console.log("Opened Demo Loan 1: Deposited 100 YES-WETH, Borrowed 1000 YES-USDC");


        vm.stopBroadcast();
        
        string memory manifest = string(abi.encodePacked(
            '{\n',
            '  "questionId": "', vm.toString(questionId), '",\n',
            '  "conditionId": "', vm.toString(conditionId), '",\n',
            '  "wethPool": "', vm.toString(address(wethPool)), '",\n',
            '  "usdcPool": "', vm.toString(address(usdcPool)), '",\n',
            '  "yesWethId": "', vm.toString(yesWethId), '",\n',
            '  "noWethId": "', vm.toString(wethPool.noPositionId()), '",\n',
            '  "yesUsdcId": "', vm.toString(usdcPool.yesPositionId()), '",\n',
            '  "noUsdcId": "', vm.toString(usdcPool.noPositionId()), '",\n',
            '  "lending": "', vm.toString(address(lending)), '"\n',
            '}'
        ));
        vm.writeFile("deployments/seed-manifest.json", manifest);
        console.log("Seed manifest written to deployments/seed-manifest.json");
        
        console.log("Seed complete. Ready for demo.");
    }
}
