// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PmAmmPool} from "../src/PmAmmPool.sol";
import {IOmniverseMath} from "../src/interfaces/IOmniverseMath.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";
import {MockConditionalTokens} from "./mocks/MockConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {CtfPositionLib} from "../src/libraries/CtfPositionLib.sol";

/// @notice Runs the core invariant and solveSwap tests against the LIVE Stylus kernel.
/// @dev Requires --fork-url to be pointing to Arbitrum Sepolia where the WASM kernel is deployed.
contract KernelIntegrationTest is Test {
    IOmniverseMath internal liveKernel;
    MockConditionalTokens internal ctf;
    MockERC20 internal collateral;
    PmAmmPool internal pool;

    address internal alice = address(0xA11CE);
    bytes32 internal conditionId = keccak256("live-stylus-test");
    uint256 internal yesId;
    uint256 internal noId;

    function setUp() public {
        // Read the live Stylus kernel address from the environment or manifest
        address kernelAddress = vm.envOr("STYLUS_KERNEL", address(0));
        if (kernelAddress == address(0)) {
            // Read from deployments/arb-sepolia.json if STYLUS_KERNEL not set
            string memory path = string.concat(vm.projectRoot(), "/deployments/arb-sepolia.json");
            try vm.readFile(path) returns (string memory json) {
                bytes memory parsed = vm.parseJson(json, ".omniverseMath");
                kernelAddress = abi.decode(parsed, (address));
            } catch {
                revert("STYLUS_KERNEL env var not set and manifest not found");
            }
        }
        liveKernel = IOmniverseMath(kernelAddress);
        
        // Verify it's deployed
        require(kernelAddress.code.length > 0, "No code at Stylus kernel address");

        // Set up local environment
        ctf = new MockConditionalTokens();
        collateral = new MockERC20("Collateral", "COL");
        yesId = CtfPositionLib.yesPositionId(address(collateral), conditionId);
        noId = CtfPositionLib.noPositionId(address(collateral), conditionId);

        pool = new PmAmmPool({
            math_: liveKernel,
            conditionalTokens_: IConditionalTokens(address(ctf)),
            collateralToken_: address(collateral),
            conditionId_: conditionId,
            marketId_: 0,
            xInitial: 0,
            yInitial: 0,
            l0: 6e18,
            expiry: block.timestamp + 30 days,
            gammaPrime: 2e18,
            dynamicLambda: false
        });

        // Mint and approve for Alice
        collateral.mint(alice, 1_000e18);
        vm.startPrank(alice);
        collateral.approve(address(ctf), type(uint256).max);
        ctf.splitPosition(address(collateral), bytes32(0), conditionId, CtfPositionLib.binaryPartition(), 1_000e18);
        ctf.setApprovalForAll(address(pool), true);
        vm.stopPrank();
    }

    function testLiveKernelIntegrationAddLiquidity() public {
        vm.prank(alice);
        uint256 shares = pool.addLiquidity(10e18, 10e18, 10e18);
        
        assertEq(shares, 10e18);
        assertEq(pool.xActive(), 10e18);
        assertEq(pool.yActive(), 10e18);
        assertEq(pool.ellActive(), 10e18);
    }

    function testLiveKernelIntegrationSwap() public {
        // Seed pool
        vm.prank(alice);
        pool.addLiquidity(10e18, 10e18, 10e18);

        // Buy YES
        vm.prank(alice);
        uint256 yesOut = pool.buyYes(1e18, 1, block.timestamp + 1);

        // Verify the invariants
        assertTrue(yesOut > 0);
        assertEq(pool.xActive(), 11e18); // 10e18 + 1e18 NO paid
        assertEq(pool.yActive(), 10e18 - yesOut); // 10e18 - YES received
        
        // Ensure solveSwap via the live kernel behaves correctly
        uint256 value = liveKernel.solveSwap(11e18, 10e18 - yesOut, 10e18);
        assertApproxEqAbs(value, 1e18, pool.INVARIANT_EPS());
    }
}
