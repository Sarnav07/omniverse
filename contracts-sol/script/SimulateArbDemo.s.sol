// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {PmAmmPool} from "../src/PmAmmPool.sol";
import {MultiverseLending} from "../src/MultiverseLending.sol";
import {OmniverseRouter} from "../src/Router.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";
import {IERC20Minimal} from "../src/interfaces/IERC20Minimal.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {CtfPositionLib} from "../src/libraries/CtfPositionLib.sol";

/// @notice Creates the single dynamic-lambda market used by the live math dashboard.
contract SimulateArbDemo is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");
        MarketFactory factory = MarketFactory(factoryAddr);
        IConditionalTokens ctf = factory.conditionalTokens();
        IERC20Minimal weth = IERC20Minimal(factory.weth());
        IERC20Minimal usdc = IERC20Minimal(factory.usdc());
        address resolverAddr = vm.envAddress("RESOLVER_ADDRESS");
        address mathAddr = address(factory.math());

        vm.startBroadcast(deployerKey);

        // 1. Massive mock minting for realistic large-volume numbers.
        uint256 massiveMint = 10_000_000e18;
        (bool successWeth, ) = address(weth).call(abi.encodeWithSignature("mint(address,uint256)", deployer, massiveMint));
        if (successWeth) console.log("Minted 10M Mock WETH for realistic volume");
        (bool successUsdc, ) = address(usdc).call(abi.encodeWithSignature("mint(address,uint256)", deployer, massiveMint));
        if (successUsdc) console.log("Minted 10M Mock USDC for optional lending seed");
        weth.approve(address(ctf), type(uint256).max);
        usdc.approve(address(ctf), type(uint256).max);

        // 2. Create one dynamic-lambda market. Include the timestamp in the
        // question so repeated demo runs do not collide with questionUsed.
        string memory runId = vm.toString(block.timestamp);
        string memory question = string.concat("Will AI surpass human intelligence by 2030? (Dynamic Lambda Live Demo) #", runId);
        string memory symbol = "AI2030-DYN";
        uint256 expiry = block.timestamp + 30 days;
        // L0 sized so the demo's 2k/4k/6k preset trades visibly move the price.
        // Active liquidity ell ~= lambda*(0.5)*L0 ~= 0.43*25k ~= 10.7k, so ~12k of
        // attack volume walks P across the W-curve toward ~0.9.
        uint256 l0 = 25_000e18;
        uint256 gammaPrime = 2e18;
        
        (PmAmmPool wethPool, PmAmmPool usdcPool) = factory.createEvent(
            question, symbol, "demo", expiry, resolverAddr, l0, gammaPrime, true
        );
        bytes32 conditionId = wethPool.conditionId();

        // 3. Split massive WETH positions for initial LP and live demo trades.
        uint256[] memory partition = CtfPositionLib.binaryPartition();
        ctf.splitPosition(address(weth), bytes32(0), conditionId, partition, 2_000_000e18);

        // 4. Provide initial liquidity ON the pm-AMM invariant surface. At P=0.5 the
        // on-curve symmetric reserves are x=y=phi(0)*L0 = 0.39894*L0. Seeding x=y=L0
        // (the old behaviour) sits ~2.5x off the curve, so the first trade snaps the
        // price discontinuously. 9974e18 = round(0.39894 * 25_000e18).
        uint256 seedReserve = 9974e18;
        ctf.setApprovalForAll(address(wethPool), true);
        wethPool.addLiquidity(seedReserve, seedReserve, 0);

        console.log("Initialized dynamic market on-invariant (P=0.5) with ~9974/9974 WETH liquidity.");

        // 5. Optional lending seed. If ORACLE_ADDRESS is unset, lendingAddress
        // remains zero and the dashboard will show the lending panel as unseeded.
        address oracleAddr = vm.envOr("ORACLE_ADDRESS", address(0));
        address lendingAddress = address(0);
        uint256 lendingCollateral = 0;
        uint256 lendingDebt = 0;
        uint256 lendingSeed = 0;

        if (oracleAddr != address(0)) {
            ctf.splitPosition(address(usdc), bytes32(0), conditionId, partition, 50_000e18);
            MultiverseLending lending =
                new MultiverseLending(ctf, address(weth), address(usdc), conditionId, wethPool, IPriceOracle(oracleAddr));

            usdc.approve(address(lending), type(uint256).max);
            ctf.setApprovalForAll(address(lending), true);

            lendingSeed = 10_000e18;
            lendingCollateral = 100e18;
            lendingDebt = 1_000e18;
            lending.seedReserve(lendingSeed);
            lending.deposit(lendingCollateral);
            lending.borrow(lendingDebt);
            lendingAddress = address(lending);
            console.log("Seeded demo lending market:", lendingAddress);
        }

        // 6. Fresh router for this run. It is stateless (orchestrates split/deposit/borrow
        // per call) and reads each pool's own collateral, so one router serves both
        // universes. Deploying it here keeps the manifest the single source of truth and
        // guarantees the frontend always calls the current bytecode.
        OmniverseRouter router = new OmniverseRouter(ctf, address(weth), address(usdc));
        console.log("Router:", address(router));

        uint256 createdBlock = block.number;
        console.log("Dynamic market created.");
        console.log("WETH Pool:", address(wethPool));
        console.log("USDC Pool:", address(usdcPool));
        console.log("Math kernel:", mathAddr);
        vm.stopBroadcast();

        // Write output manifest for frontend
        string memory manifest = string(abi.encodePacked(
            '{\n',
            '  "runId": "', runId, '",\n',
            '  "createdBlock": ', vm.toString(createdBlock), ',\n',
            '  "question": "', question, '",\n',
            '  "symbol": "', symbol, '",\n',
            '  "conditionId": "', vm.toString(conditionId), '",\n',
            '  "wethMarketId": "', vm.toString(wethPool.marketId()), '",\n',
            '  "usdcMarketId": "', vm.toString(usdcPool.marketId()), '",\n',
            '  "poolWeth": "', vm.toString(address(wethPool)), '",\n',
            '  "poolUsdc": "', vm.toString(address(usdcPool)), '",\n',
            '  "yesWethId": "', vm.toString(wethPool.yesPositionId()), '",\n',
            '  "noWethId": "', vm.toString(wethPool.noPositionId()), '",\n',
            '  "factory": "', vm.toString(factoryAddr), '",\n',
            '  "resolver": "', vm.toString(resolverAddr), '",\n',
            '  "router": "', vm.toString(address(router)), '",\n',
            '  "math": "', vm.toString(mathAddr), '",\n',
            '  "demoAccount": "', vm.toString(deployer), '",\n',
            '  "weth": "', vm.toString(address(weth)), '",\n',
            '  "usdc": "', vm.toString(address(usdc)), '",\n',
            '  "l0": "25000000000000000000000",\n',
            '  "gammaPrime": "2000000000000000000",\n',
            '  "initialLiquidityYes": "9974000000000000000000",\n',
            '  "initialLiquidityNo": "9974000000000000000000",\n',
            '  "lending": "', vm.toString(lendingAddress), '",\n',
            '  "lendingSeed": "', vm.toString(lendingSeed), '",\n',
            '  "lendingCollateral": "', vm.toString(lendingCollateral), '",\n',
            '  "lendingDebt": "', vm.toString(lendingDebt), '"\n',
            '}'
        ));
        vm.writeFile("deployments/demo-manifest.json", manifest);
        console.log("Manifest written to deployments/demo-manifest.json");
    }
}
