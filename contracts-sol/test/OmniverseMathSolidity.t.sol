// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OmniverseMathSolidity} from "../src/OmniverseMathSolidity.sol";

contract OmniverseMathSolidityTest is Test {
    OmniverseMathSolidity internal math;

    function setUp() public {
        math = new OmniverseMathSolidity();
    }

    function testPhiReferenceValues() public view {
        assertApproxEqAbs(math.phi(0), 398_942_280_401_432_677, 1e9);
        assertApproxEqAbs(math.phi(1e18), 241_970_724_519_143_365, 1e12);
        assertEq(math.phi(9e18), 0);
    }

    function testBigPhiReferenceValues() public view {
        assertApproxEqAbs(math.Phi(0), 0.5e18, 1e12);
        assertApproxEqAbs(math.Phi(1e18), 841_344_746_068_543_000, 2e12);
        assertApproxEqAbs(math.Phi(-1e18), 158_655_253_931_457_000, 2e12);
    }

    function testPhiInvRoundTrips() public view {
        uint256[5] memory points =
            [uint256(0.1e18), uint256(0.25e18), uint256(0.5e18), uint256(0.75e18), uint256(0.9e18)];
        for (uint256 i = 0; i < points.length; i++) {
            int256 z = math.PhiInv(points[i]);
            assertApproxEqAbs(math.Phi(z), points[i], 2e12);
        }
    }

    function testPoolValueAndLambdaReferences() public view {
        assertApproxEqAbs(math.poolValue(0), 398_942_280_401_432_677, 1e9);
        assertApproxEqAbs(math.lambdaStarGaussian(2e18, 0.5e18), 427_000_000_000_000_000, 6e16);
        assertApproxEqAbs(math.lambdaStarGaussian(2e18, 0.01e18), 295_000_000_000_000_000, 8e16);
    }

    function testSolveSwapReturnsLowerOutputReserveForBuyYes() public view {
        uint256 ell = 1e18;
        uint256 y0 = 398_942_280_401_432_677;
        uint256 x1 = y0 + 1e16;

        uint256 y1 = math.solveSwap(x1, y0, ell);

        assertLt(y1, y0);
    }
}
