// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OmniverseMathSolidity} from "../src/OmniverseMathSolidity.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {MultiverseLending} from "../src/MultiverseLending.sol";
import {Resolver} from "../src/Resolver.sol";
import {ChainlinkPriceOracle} from "../src/ChainlinkPriceOracle.sol";
import {PmAmmPool} from "../src/PmAmmPool.sol";
import {IOmniverseMath} from "../src/interfaces/IOmniverseMath.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";

/// @notice Deploys the full OMNIVERSE stack (excluding CTF, which is external infra).
///
/// Usage (local fork):
///   forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
///
/// Usage (Arb Sepolia):
///   forge script script/Deploy.s.sol --rpc-url $ARB_SEPOLIA_RPC --broadcast --verify
///
/// Environment variables:
///   DEPLOYER_PRIVATE_KEY  - deployer's private key
///   CTF_ADDRESS           - deployed ConditionalTokens address (or uses mock)
///   WETH_ADDRESS          - WETH address (or deploys mock)
///   USDC_ADDRESS          - USDC address (or deploys mock)
///   CHAINLINK_ETH_USD     - Chainlink ETH/USD feed address (optional; uses mock oracle if unset)
///   CHAINLINK_HEARTBEAT   - Heartbeat in seconds (default 3600)
///   OWNER_ADDRESS         - Resolver owner (defaults to deployer)
contract Deploy is Script {
    // --- Mock CTF for local/fork deployments when no real CTF is available ---
    // We import it so it's available to the script; on real chains, pass CTF_ADDRESS.
    // (Imported inline to avoid polluting src/ with test mocks.)

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // --- Resolve external addresses (or deploy mocks) ---
        address ctfAddr = vm.envOr("CTF_ADDRESS", address(0));
        address wethAddr = vm.envOr("WETH_ADDRESS", address(0));
        address usdcAddr = vm.envOr("USDC_ADDRESS", address(0));
        address chainlinkFeed = vm.envOr("CHAINLINK_ETH_USD", address(0));
        uint256 heartbeat = vm.envOr("CHAINLINK_HEARTBEAT", uint256(3600));
        address ownerAddr = vm.envOr("OWNER_ADDRESS", deployer);

        vm.startBroadcast(deployerKey);

        // --- 1. Math fallback ---
        OmniverseMathSolidity math = new OmniverseMathSolidity();
        console.log("OmniverseMathSolidity:", address(math));

        // --- 2. CTF (use existing or deploy mock) ---
        if (ctfAddr == address(0)) {
            // Deploy the mock CTF for local testing. On real chains, provide CTF_ADDRESS.
            console.log("WARNING: No CTF_ADDRESS provided; deploying MockConditionalTokens (demo only).");
            // We use CREATE to deploy the mock. It's in test/mocks/ but included via import path.
            bytes memory ctfBytecode = vm.getCode("MockConditionalTokens.sol:MockConditionalTokens");
            address deployed;
            assembly {
                deployed := create(0, add(ctfBytecode, 0x20), mload(ctfBytecode))
            }
            require(deployed != address(0), "Deploy: CTF deployment failed");
            ctfAddr = deployed;
            console.log("MockConditionalTokens:", ctfAddr);
        } else {
            console.log("Using existing CTF:", ctfAddr);
        }

        // --- 3. WETH/USDC (use existing or deploy mock) ---
        if (wethAddr == address(0)) {
            bytes memory wethBytecode = vm.getCode("MockERC20.sol:MockERC20");
            bytes memory wethInit = abi.encodePacked(wethBytecode, abi.encode("Wrapped Ether", "WETH"));
            address deployed;
            assembly {
                deployed := create(0, add(wethInit, 0x20), mload(wethInit))
            }
            require(deployed != address(0), "Deploy: WETH deployment failed");
            wethAddr = deployed;
            console.log("MockWETH:", wethAddr);
        } else {
            console.log("Using existing WETH:", wethAddr);
        }

        if (usdcAddr == address(0)) {
            bytes memory usdcBytecode = vm.getCode("MockERC20.sol:MockERC20");
            bytes memory usdcInit = abi.encodePacked(usdcBytecode, abi.encode("USD Coin", "USDC"));
            address deployed;
            assembly {
                deployed := create(0, add(usdcInit, 0x20), mload(usdcInit))
            }
            require(deployed != address(0), "Deploy: USDC deployment failed");
            usdcAddr = deployed;
            console.log("MockUSDC:", usdcAddr);
        } else {
            console.log("Using existing USDC:", usdcAddr);
        }

        // --- 4. Price Oracle ---
        address oracleAddr;
        if (chainlinkFeed != address(0)) {
            ChainlinkPriceOracle chainlinkOracle = new ChainlinkPriceOracle(
                IAggregatorV3(chainlinkFeed), heartbeat
            );
            oracleAddr = address(chainlinkOracle);
            console.log("ChainlinkPriceOracle:", oracleAddr);
        } else {
            // Deploy a mock price oracle at $2000/ETH for demo.
            bytes memory oracleBytecode = vm.getCode("MockPriceOracle.sol:MockPriceOracle");
            bytes memory oracleInit = abi.encodePacked(oracleBytecode, abi.encode(uint256(2000e18)));
            address deployed;
            assembly {
                deployed := create(0, add(oracleInit, 0x20), mload(oracleInit))
            }
            require(deployed != address(0), "Deploy: Oracle deployment failed");
            oracleAddr = deployed;
            console.log("MockPriceOracle ($2000):", oracleAddr);
        }

        // --- 5. Resolver ---
        Resolver resolver = new Resolver(IConditionalTokens(ctfAddr), ownerAddr);
        console.log("Resolver:", address(resolver));

        // --- 6. MarketFactory ---
        MarketFactory factory = new MarketFactory(
            IOmniverseMath(address(math)),
            IConditionalTokens(ctfAddr),
            wethAddr,
            usdcAddr
        );
        console.log("MarketFactory:", address(factory));

        vm.stopBroadcast();

        // --- Write manifest ---
        string memory manifest = _buildManifest(
            address(math), ctfAddr, wethAddr, usdcAddr,
            oracleAddr, address(resolver), address(factory)
        );
        vm.writeFile("deployments/arb-sepolia.json", manifest);
        console.log("Manifest written to deployments/arb-sepolia.json");
    }

    function _buildManifest(
        address math,
        address ctf,
        address weth,
        address usdc,
        address oracle,
        address resolver,
        address factory
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '{\n',
            '  "omniverseMath": "', _toHex(math), '",\n',
            '  "conditionalTokens": "', _toHex(ctf), '",\n',
            '  "weth": "', _toHex(weth), '",\n',
            '  "usdc": "', _toHex(usdc), '",\n',
            '  "priceOracle": "', _toHex(oracle), '",\n',
            '  "resolver": "', _toHex(resolver), '",\n',
            '  "marketFactory": "', _toHex(factory), '"\n',
            '}'
        ));
    }

    function _toHex(address a) internal pure returns (string memory) {
        bytes memory b = new bytes(42);
        b[0] = '0';
        b[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            uint8 v = uint8(uint160(a) >> (8 * (19 - i)));
            b[2 + i * 2] = _hexChar(v >> 4);
            b[3 + i * 2] = _hexChar(v & 0x0f);
        }
        return string(b);
    }

    function _hexChar(uint8 d) internal pure returns (bytes1) {
        return d < 10 ? bytes1(d + 48) : bytes1(d + 87);
    }
}
