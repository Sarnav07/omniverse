// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {PmAmmPool} from "./PmAmmPool.sol";
import {MultiverseLending} from "./MultiverseLending.sol";
import {CtfPositionLib} from "./libraries/CtfPositionLib.sol";
import {IERC1155Receiver} from "./interfaces/IERC1155Receiver.sol";

contract OmniverseRouter is IERC1155Receiver {
    IConditionalTokens public immutable ctf;
    address public immutable weth;
    address public immutable usdc;

    constructor(IConditionalTokens _ctf, address _weth, address _usdc) {
        ctf = _ctf;
        weth = _weth;
        usdc = _usdc;
        IERC20Minimal(_weth).approve(address(_ctf), type(uint256).max);
        IERC20Minimal(_usdc).approve(address(_ctf), type(uint256).max);
    }

    // ============ SWAP (BUY YES) ============
    // The collateral is the pool's own token (WETH pool trades on WETH, USDC pool on USDC).
    // Reading it off the pool keeps the router universe-agnostic instead of pinned to usdc.
    function buyYes(PmAmmPool pool, bytes32 conditionId, uint256 amount, uint256 minYesOut) external {
        address collateral = pool.collateralToken();

        // 1. Pull collateral
        IERC20Minimal(collateral).transferFrom(msg.sender, address(this), amount);

        // 2. Split into YES and NO legs
        ctf.splitPosition(collateral, bytes32(0), conditionId, CtfPositionLib.binaryPartition(), amount);

        uint256 yesId = ctf.getPositionId(collateral, ctf.getCollectionId(bytes32(0), conditionId, CtfPositionLib.YES_INDEX_SET));

        // 3. Sell the NO leg to the pool to get MORE YES
        ctf.setApprovalForAll(address(pool), true);
        pool.buyYesFor(amount, minYesOut, msg.sender);

        // 4. Transfer the YES leg from the split directly to the user
        ctf.safeTransferFrom(address(this), msg.sender, yesId, amount, "");
    }

    // ============ SWAP (BUY NO) ============
    function buyNo(PmAmmPool pool, bytes32 conditionId, uint256 amount, uint256 minNoOut) external {
        address collateral = pool.collateralToken();

        IERC20Minimal(collateral).transferFrom(msg.sender, address(this), amount);
        ctf.splitPosition(collateral, bytes32(0), conditionId, CtfPositionLib.binaryPartition(), amount);

        uint256 noId = ctf.getPositionId(collateral, ctf.getCollectionId(bytes32(0), conditionId, CtfPositionLib.NO_INDEX_SET));

        ctf.setApprovalForAll(address(pool), true);
        pool.buyNoFor(amount, minNoOut, msg.sender);

        ctf.safeTransferFrom(address(this), msg.sender, noId, amount, "");
    }

    // ============ PROVIDE (ADD LIQUIDITY) ============
    function addLiquidity(PmAmmPool pool, bytes32 conditionId, uint256 amount, uint256 minShares) external {
        address collateral = pool.collateralToken();

        IERC20Minimal(collateral).transferFrom(msg.sender, address(this), amount);
        ctf.splitPosition(collateral, bytes32(0), conditionId, CtfPositionLib.binaryPartition(), amount);

        ctf.setApprovalForAll(address(pool), true);
        pool.addLiquidityFor(amount, amount, minShares, msg.sender);
    }

    // ============ INTENT ENGINE (EXECUTE/BORROW) ============
    function executeBorrow(
        MultiverseLending lending,
        bytes32 conditionId,
        uint256 wethCollateral,
        uint256 usdcBorrowAmount
    ) external {
        // 1. Pull WETH from user
        IERC20Minimal(weth).transferFrom(msg.sender, address(this), wethCollateral);

        // 2. Split WETH into YES-WETH and NO-WETH
        ctf.splitPosition(weth, bytes32(0), conditionId, CtfPositionLib.binaryPartition(), wethCollateral);
        uint256 noWethId = ctf.getPositionId(weth, ctf.getCollectionId(bytes32(0), conditionId, CtfPositionLib.NO_INDEX_SET));

        // 3. Deposit YES-WETH into MultiverseLending for self
        ctf.setApprovalForAll(address(lending), true);
        lending.deposit(wethCollateral);

        // 4. Borrow YES-USDC for self
        lending.borrow(usdcBorrowAmount);

        // 5. Transfer position to user
        lending.transferPosition(msg.sender, wethCollateral, usdcBorrowAmount);

        // 6. Transfer the YES-USDC borrowed to user
        uint256 yesUsdcId = ctf.getPositionId(usdc, ctf.getCollectionId(bytes32(0), conditionId, CtfPositionLib.YES_INDEX_SET));
        ctf.safeTransferFrom(address(this), msg.sender, yesUsdcId, usdcBorrowAmount, "");

        // 7. Transfer the NO-WETH to the user (they keep the opposing leg)
        ctf.safeTransferFrom(address(this), msg.sender, noWethId, wethCollateral, "");
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
