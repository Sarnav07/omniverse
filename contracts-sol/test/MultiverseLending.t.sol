// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MultiverseLending} from "../src/MultiverseLending.sol";
import {PmAmmPool} from "../src/PmAmmPool.sol";
import {IOmniverseMath} from "../src/interfaces/IOmniverseMath.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {CtfPositionLib} from "../src/libraries/CtfPositionLib.sol";
import {MockConditionalTokens} from "./mocks/MockConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockOmniverseMath} from "./mocks/MockOmniverseMath.sol";
import {MockPriceOracle} from "./mocks/MockPriceOracle.sol";

contract MultiverseLendingTest is Test {
    address internal lp = address(0x11);
    address internal seeder = address(0x5EED);
    address internal seeder2 = address(0x5EED2);
    address internal borrower = address(0xB0B);
    address internal borrower2 = address(0xB0B2);

    MockOmniverseMath internal math;
    MockConditionalTokens internal ctf;
    MockERC20 internal weth;
    MockERC20 internal usdc;
    PmAmmPool internal wethPool;
    MockPriceOracle internal oracle;
    MultiverseLending internal lending;

    bytes32 internal conditionId = keccak256("eth-flips-50k");
    uint256 internal yesWethId;
    uint256 internal yesUsdcId;
    uint256 internal noUsdcId;

    uint256 internal constant ETH_PRICE = 2000e18; // $2000 / ETH, WAD
    uint256 internal expiry;

    function setUp() public {
        math = new MockOmniverseMath();
        ctf = new MockConditionalTokens();
        weth = new MockERC20("Wrapped Ether", "WETH");
        usdc = new MockERC20("USD Coin", "USDC");
        oracle = new MockPriceOracle(ETH_PRICE);
        expiry = block.timestamp + 30 days;

        wethPool = new PmAmmPool({
            math_: IOmniverseMath(address(math)),
            conditionalTokens_: IConditionalTokens(address(ctf)),
            collateralToken_: address(weth),
            conditionId_: conditionId,
            marketId_: 0,
            xInitial: 0,
            yInitial: 0,
            l0: 6e18,
            expiry: expiry,
            gammaPrime: 2e18,
            dynamicLambda: true
        });

        lending = new MultiverseLending(
            IConditionalTokens(address(ctf)),
            address(weth),
            address(usdc),
            conditionId,
            wethPool,
            IPriceOracle(address(oracle))
        );

        yesWethId = lending.yesWethId();
        yesUsdcId = lending.yesUsdcId();
        noUsdcId = lending.noUsdcId();

        // Seed the WETH pool so gap() reads off live reserves.
        _splitFor(lp, weth, 100e18);
        vm.prank(lp);
        ctf.setApprovalForAll(address(wethPool), true);
        vm.prank(lp);
        wethPool.addLiquidity(20e18, 8e18, 8e18);

        // Seed the lending reserve with 10k USDC -> 10k YES-USDC + 10k NO-USDC.
        _seed(seeder, 10_000e18);
    }

    // ---- Trap 1: reserve is a YES-USDC position, never raw USDC ----

    function testReserveSeededAsYesUsdcNotRawUsdc() public view {
        assertEq(lending.reserveYesUsdc(), 10_000e18);
        assertEq(ctf.balanceOf(address(lending), yesUsdcId), 10_000e18);
        assertEq(ctf.balanceOf(address(lending), noUsdcId), 10_000e18);
        // The killer assertion: zero raw USDC sits in the lender.
        assertEq(usdc.balanceOf(address(lending)), 0);
        // The split deposited the USDC into the CTF, backing both universes.
        assertEq(usdc.balanceOf(address(ctf)), 10_000e18);
    }

    function testNoUniverseHasNoShortfallOnNoResolution() public {
        _depositAndBorrow(borrower, 1e18, 1_000e18);

        _resolve(2); // NO wins
        lending.settle();

        // NO-USDC reserve leg pays out; YES legs zero. No universe is left short.
        assertEq(ctf.balanceOf(address(lending), noUsdcId), 0);
        // Seed fully recovered as raw USDC, held by the lender for lenders to claim.
        assertEq(usdc.balanceOf(address(lending)), 10_000e18);
    }

    // ---- Trap 2: borrow only ever moves YES-USDC; cross-leg is impossible ----

    function testBorrowOnlyMovesYesUsdcLeavingOtherLegsUntouched() public {
        _deposit(borrower, 1e18);

        uint256 noUsdcBefore = ctf.balanceOf(address(lending), noUsdcId);
        uint256 yesUsdcBefore = ctf.balanceOf(address(lending), yesUsdcId);

        vm.prank(borrower);
        lending.borrow(1_000e18);

        // borrow() drained exactly 1000 YES-USDC out of the reserve and nothing else.
        assertEq(ctf.balanceOf(address(lending), yesUsdcId), yesUsdcBefore - 1_000e18);
        assertEq(ctf.balanceOf(address(lending), noUsdcId), noUsdcBefore); // NO-USDC untouched
        assertEq(lending.reserveYesUsdc(), 10_000e18 - 1_000e18);

        // The borrower received YES-USDC and only YES-USDC.
        assertEq(ctf.balanceOf(borrower, yesUsdcId), 1_000e18);
        assertEq(ctf.balanceOf(borrower, noUsdcId), 0);
        assertEq(lending.debtOf(borrower), 1_000e18);
    }

    function testNoBorrowPathForOtherLegOrCondition() public view {
        // The only lendable id the contract tracks is yesUsdcId; the NO leg and any
        // other-condition leg are simply different ids the borrow path never references.
        assertTrue(noUsdcId != yesUsdcId);
        uint256 otherCondYesUsdc = ctf.getPositionId(
            address(usdc), ctf.getCollectionId(bytes32(0), keccak256("other"), CtfPositionLib.YES_INDEX_SET)
        );
        assertTrue(otherCondYesUsdc != yesUsdcId);
        // The reserve accounting is denominated in the YES-USDC leg only.
        assertEq(ctf.balanceOf(address(lending), yesUsdcId), lending.reserveYesUsdc());
    }

    function testBorrowBeyondHealthReverts() public {
        _deposit(borrower, 1e18);
        // gap==0 -> LTV 0.80 -> max debt = 1*2000*0.80 = 1600. 1601 must revert.
        vm.prank(borrower);
        vm.expectRevert(MultiverseLending.Unhealthy.selector);
        lending.borrow(1_601e18);
    }

    // ---- Trap 3: both-universe solvency, value actually retrievable post-settle ----

    function testYesResolutionLenderMadeWholeAndBorrowerKeepsEquity() public {
        _depositAndBorrow(borrower, 1e18, 1_600e18); // HF == 1
        assertEq(lending.healthFactor(borrower), 1e18);

        _resolve(1); // YES wins
        lending.settle();
        assertEq(lending.settlePEth(), ETH_PRICE);

        // Borrower claims equity: C - D/pEth = 1 - 1600/2000 = 0.2 WETH.
        vm.prank(borrower);
        uint256 wethToBorrower = lending.claimBorrower();
        assertEq(wethToBorrower, 0.2e18);
        assertEq(weth.balanceOf(borrower), 0.2e18);
        assertEq(lending.collateralOf(borrower), 0);
        assertEq(lending.debtOf(borrower), 0);

        // Lender claims: cover 0.8 WETH (= 1600/2000) + unborrowed 8400 USDC.
        vm.prank(seeder);
        (uint256 wethToLender, uint256 usdcToLender) = lending.claimLender();
        assertEq(wethToLender, 0.8e18);
        assertEq(usdcToLender, 8_400e18);

        // Lender made whole: 0.8 WETH * $2000 + 8400 USDC == $10000 == seed value.
        uint256 lenderValueUsd = wethToLender * ETH_PRICE / 1e18 + usdcToLender;
        assertEq(lenderValueUsd, 10_000e18);

        // No funds locked: the contract is drained to dust.
        assertLe(weth.balanceOf(address(lending)), 1);
        assertEq(usdc.balanceOf(address(lending)), 0);
    }

    function testNoResolutionNetPnlZeroAndSeedRecovered() public {
        _depositAndBorrow(borrower, 1e18, 1_000e18);

        _resolve(2); // NO wins
        lending.settle();

        // Borrower: collateral worthless, debt forgiven -> nothing out, nothing owed.
        vm.prank(borrower);
        uint256 wethToBorrower = lending.claimBorrower();
        assertEq(wethToBorrower, 0);
        assertEq(lending.collateralOf(borrower), 0);
        assertEq(lending.debtOf(borrower), 0);
        // Borrower's borrowed YES-USDC is worthless; redeeming it pays nothing.
        uint256[] memory yesOnly = new uint256[](1);
        yesOnly[0] = CtfPositionLib.YES_INDEX_SET;
        vm.prank(borrower);
        ctf.redeemPositions(address(usdc), bytes32(0), conditionId, yesOnly);
        assertEq(usdc.balanceOf(borrower), 0); // net P&L on the loan is zero

        // Lender recovers the full seed as USDC via the NO-USDC leg.
        vm.prank(seeder);
        (uint256 wethToLender, uint256 usdcToLender) = lending.claimLender();
        assertEq(wethToLender, 0);
        assertEq(usdcToLender, 10_000e18);
        assertEq(usdc.balanceOf(address(lending)), 0); // drained, nothing locked
    }

    function testMultipleBorrowersAndLendersSettleSolvent() public {
        _seed(seeder2, 5_000e18); // total seed 15k, seeder 10k / seeder2 5k

        _depositAndBorrow(borrower, 2e18, 2_000e18); // HF 1.6
        _depositAndBorrow(borrower2, 1e18, 1_000e18); // HF 1.6

        _resolve(1); // YES
        lending.settle();

        vm.prank(borrower);
        uint256 b1 = lending.claimBorrower(); // 2 - 2000/2000 = 1 WETH
        vm.prank(borrower2);
        uint256 b2 = lending.claimBorrower(); // 1 - 1000/2000 = 0.5 WETH
        assertEq(b1, 1e18);
        assertEq(b2, 0.5e18);

        // Cover WETH = totalDebt/pEth = 3000/2000 = 1.5 WETH, split 10/15 : 5/15.
        // Reserve USDC = 15000 - 3000 = 12000, same split.
        vm.prank(seeder);
        (uint256 lw1, uint256 lu1) = lending.claimLender();
        vm.prank(seeder2);
        (uint256 lw2, uint256 lu2) = lending.claimLender();
        assertEq(lw1, 1.5e18 * 10 / 15);
        assertEq(lw2, 1.5e18 * 5 / 15);
        assertEq(lu1, 12_000e18 * 10 / 15);
        assertEq(lu2, 12_000e18 * 5 / 15);

        // Every lender recovered seed value (WETH@2000 + USDC).
        assertEq(lw1 * ETH_PRICE / 1e18 + lu1, 10_000e18);
        assertEq(lw2 * ETH_PRICE / 1e18 + lu2, 5_000e18);

        // Contract fully drained (dust only).
        assertLe(weth.balanceOf(address(lending)), 2);
        assertLe(usdc.balanceOf(address(lending)), 2);
    }

    /// @dev P45-H4 regression: indivisible debts so floor(Sum cover) != Sum floor(cover_i).
    ///      Without the per-transfer balance cap the last claimer reverts on dust.
    function testProRataDustDoesNotBrickLastClaimer() public {
        // Fresh book: deploy a lender with the auditor's exact 6000/3000 seed split and
        // 777/333/111 debts at a price that divides none of them.
        lending = new MultiverseLending(
            IConditionalTokens(address(ctf)),
            address(weth),
            address(usdc),
            conditionId,
            wethPool,
            IPriceOracle(address(oracle))
        );
        oracle.setPrice(3333e18);

        address ld1 = address(0xD1);
        address ld2 = address(0xD2);
        address b3 = address(0xB3);
        _seed(ld1, 6_000e18);
        _seed(ld2, 3_000e18);

        _depositAndBorrow(borrower, 1e18, 777e18);
        _depositAndBorrow(borrower2, 1e18, 333e18);
        _depositAndBorrow(b3, 1e18, 111e18);

        _resolve(1); // YES
        lending.settle();

        // All borrowers then both lenders claim with no revert. The last lender absorbs
        // the floor(Sum) - Sum(floor) dust via the balance cap instead of reverting.
        vm.prank(borrower);
        lending.claimBorrower();
        vm.prank(borrower2);
        lending.claimBorrower();
        vm.prank(b3);
        lending.claimBorrower();

        vm.prank(ld1);
        lending.claimLender();
        vm.prank(ld2);
        lending.claimLender();

        // Pot drained to at most a few wei of dust; nothing stranded, nobody bricked.
        assertLe(weth.balanceOf(address(lending)), 5);
        assertLe(usdc.balanceOf(address(lending)), 5);
    }

    function testSettleIsIdempotentAndPermissionless() public {
        _depositAndBorrow(borrower, 1e18, 1_000e18);
        _resolve(1);

        // Permissionless: a random address can settle.
        vm.prank(address(0xDEAD));
        lending.settle();
        assertTrue(lending.settled());
        uint256 wethAfterFirst = weth.balanceOf(address(lending));

        // Idempotent: a second call reverts, balances unchanged.
        vm.expectRevert(MultiverseLending.AlreadySettled.selector);
        lending.settle();
        assertEq(weth.balanceOf(address(lending)), wethAfterFirst);
    }

    function testSettleRevertsBeforeResolution() public {
        _depositAndBorrow(borrower, 1e18, 1_000e18);
        vm.expectRevert(MultiverseLending.Unresolved.selector);
        lending.settle();
    }

    // ---- P45-H2: live mutators frozen after settlement ----

    function testLiveMutatorsRevertAfterSettle() public {
        _depositAndBorrow(borrower, 1e18, 1_000e18);
        _resolve(1);
        lending.settle();

        vm.prank(seeder);
        usdc.approve(address(lending), 1e18);
        vm.prank(seeder);
        vm.expectRevert(MultiverseLending.AlreadySettled.selector);
        lending.seedReserve(1e18);

        vm.prank(borrower);
        vm.expectRevert(MultiverseLending.AlreadySettled.selector);
        lending.deposit(1e18);

        vm.prank(borrower);
        vm.expectRevert(MultiverseLending.AlreadySettled.selector);
        lending.borrow(1e18);

        vm.prank(borrower);
        vm.expectRevert(MultiverseLending.AlreadySettled.selector);
        lending.repay(1e18);

        vm.prank(borrower);
        vm.expectRevert(MultiverseLending.AlreadySettled.selector);
        lending.withdraw(1e18);
    }

    function testClaimsRevertBeforeSettle() public {
        _depositAndBorrow(borrower, 1e18, 1_000e18);
        vm.prank(borrower);
        vm.expectRevert(MultiverseLending.NotSettled.selector);
        lending.claimBorrower();
        vm.prank(seeder);
        vm.expectRevert(MultiverseLending.NotSettled.selector);
        lending.claimLender();
    }

    // ---- Trap 4: gap only tightens LTV, never inflates borrowing power ----

    function testGapMonotonicallyTightensLtv() public {
        _depositAndBorrow(borrower, 1e18, 1_000e18);
        uint256 hfFlat = lending.healthFactor(borrower);
        assertEq(hfFlat, 1.6e18); // C*pEth*LTV/D = 1*2000*0.80/1000

        // Drive a real gap by letting pool liquidity decay (ellActive goes stale
        // vs the decayed total) -> |g| grows -> LTV must fall -> HF must fall.
        vm.warp(block.timestamp + 5 days);
        uint256 hfSmallGap = lending.healthFactor(borrower);

        vm.warp(block.timestamp + 5 days);
        uint256 hfMidGap = lending.healthFactor(borrower);

        // Beyond G_CAP the haircut saturates: LTV floors at LTV_BASE*(1-H)=0.40.
        vm.warp(block.timestamp + 19 days);
        uint256 hfSaturated = lending.healthFactor(borrower);

        assertLt(hfSmallGap, hfFlat);
        assertLt(hfMidGap, hfSmallGap);
        assertLt(hfSaturated, hfMidGap);
        assertEq(hfSaturated, 0.8e18); // floor: 1*2000*0.40/1000
    }

    function testSpoofedHugeGapOnlyLowersLtv() public {
        _deposit(borrower, 1e18);
        vm.prank(borrower);
        lending.borrow(1_600e18);
        assertEq(lending.healthFactor(borrower), 1e18);

        // Widen the gap; the same position is now underwater -- the spoof shrank LTV.
        vm.warp(block.timestamp + 20 days);
        assertLt(lending.healthFactor(borrower), 1e18);
    }

    // ---- HF invariant to P(YES) swings ----

    function testHealthFactorInvariantToPriceOfYesSwing() public {
        _depositAndBorrow(borrower, 1e18, 1_000e18);
        uint256 hfBefore = lending.healthFactor(borrower);

        // Swing P(YES) by ~50 points via the pool's price oracle. HF must not move:
        // pYes cancels between collateral and debt legs.
        math.setPrice(0.25e18);
        uint256 hfLow = lending.healthFactor(borrower);
        math.setPrice(0.75e18);
        uint256 hfHigh = lending.healthFactor(borrower);

        assertEq(hfLow, hfBefore);
        assertEq(hfHigh, hfBefore);
    }

    function testHealthFactorMaxWhenNoDebt() public {
        _deposit(borrower, 1e18);
        assertEq(lending.healthFactor(borrower), type(uint256).max);
    }

    // ---- repay / withdraw accounting (live phase) ----

    function testRepayReducesDebtAndRefillsReserve() public {
        _depositAndBorrow(borrower, 1e18, 1_000e18);
        vm.prank(borrower);
        lending.repay(400e18);

        assertEq(lending.debtOf(borrower), 600e18);
        assertEq(lending.totalDebt(), 600e18);
        assertEq(lending.reserveYesUsdc(), 10_000e18 - 600e18);
        assertEq(ctf.balanceOf(address(lending), yesUsdcId), 10_000e18 - 600e18);
    }

    function testWithdrawBlockedWhenItBreaksHealth() public {
        _depositAndBorrow(borrower, 1e18, 1_600e18); // HF == 1 at full collateral
        vm.prank(borrower);
        vm.expectRevert(MultiverseLending.Unhealthy.selector);
        lending.withdraw(1); // any withdrawal pushes HF below 1
    }

    function testWithdrawAllowedWhenHealthy() public {
        _depositAndBorrow(borrower, 2e18, 1_600e18); // HF == 2
        vm.prank(borrower);
        lending.withdraw(1e18); // back to HF == 1
        assertEq(lending.collateralOf(borrower), 1e18);
        assertEq(ctf.balanceOf(borrower, yesWethId), 1e18);
    }

    // ---- helpers ----

    function _splitFor(address user, MockERC20 token, uint256 amount) internal {
        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(ctf), amount);
        ctf.splitPosition(address(token), bytes32(0), conditionId, CtfPositionLib.binaryPartition(), amount);
        vm.stopPrank();
    }

    function _seed(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(lending), amount);
        vm.prank(user);
        lending.seedReserve(amount);
    }

    function _deposit(address user, uint256 amount) internal {
        _splitFor(user, weth, amount);
        vm.prank(user);
        ctf.setApprovalForAll(address(lending), true);
        vm.prank(user);
        lending.deposit(amount);
    }

    function _depositAndBorrow(address user, uint256 collateral, uint256 debt) internal {
        _deposit(user, collateral);
        vm.prank(user);
        lending.borrow(debt);
    }

    function _resolve(uint256 winningIndexSet) internal {
        ctf.reportPayouts(conditionId, winningIndexSet);
    }
}
