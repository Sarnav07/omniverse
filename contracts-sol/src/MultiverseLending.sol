// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";
import {IERC1155Receiver} from "./interfaces/IERC1155Receiver.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {PmAmmPool} from "./PmAmmPool.sol";
import {CtfPositionLib} from "./libraries/CtfPositionLib.sol";

/// @notice Zero-liquidation lending across one CTF condition: collateral is the
///         YES-WETH leg, debt is the YES-USDC leg. Both legs share the same
///         conditionId so they resolve together; P(YES) cancels out of the health
///         factor and the book is net-settled at resolution, never liquidated.
contract MultiverseLending is IERC1155Receiver {
    uint256 public constant WAD = 1e18;
    uint256 public constant LTV_BASE = 0.80e18;
    uint256 public constant H = 0.50e18;
    /// @dev Gap normaliser. |g| at G_CAP applies the full H haircut; beyond it the
    ///      haircut clamps. 1 WAD matches the pool's z-scale, where a unit z-gap is
    ///      already an extreme dislocation, so spoofing a larger gap can only shrink LTV.
    uint256 public constant G_CAP = 1e18;

    bytes4 internal constant ERC1155_RECEIVED = 0xf23a6e61;
    bytes4 internal constant ERC1155_BATCH_RECEIVED = 0xbc197c81;
    bytes4 internal constant ERC1155_RECEIVER_INTERFACE_ID = 0x4e2312e0;

    IConditionalTokens public immutable conditionalTokens;
    address public immutable weth;
    address public immutable usdc;
    bytes32 public immutable conditionId;
    PmAmmPool public immutable wethPool;
    IPriceOracle public immutable ethUsd;

    uint256 public immutable yesWethId;
    uint256 public immutable yesUsdcId;
    uint256 public immutable noUsdcId;

    uint256 public reserveYesUsdc; // unborrowed YES-USDC (live phase)
    uint256 public totalDebt; // sum of debtOf (live phase)
    uint256 public seedTotal; // total USDC seeded (== NO-USDC held)
    mapping(address => uint256) public collateralOf;
    mapping(address => uint256) public debtOf;
    mapping(address => uint256) public seedOf;

    bool public settled;
    bool public yesWon;
    uint256 public settlePEth; // ETH/USD snapshot at settlement, WAD
    uint256 public settledTotalDebt; // totalDebt frozen at settlement
    uint256 public settledReserveUsdc; // reserveYesUsdc redeemed to raw USDC (YES branch)
    uint256 public lenderCoverWeth; // total WETH set aside to cover debt (YES branch)

    uint256 private _entered = 1;

    event ReserveSeeded(address indexed from, uint256 amount);
    event Deposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Settled(bool yesWon, uint256 pEth, uint256 wethRedeemed, uint256 usdcRedeemed);
    event BorrowerClaimed(address indexed user, uint256 wethOut);
    event LenderClaimed(address indexed user, uint256 wethOut, uint256 usdcOut);

    error InvalidAmount();
    error InvalidToken();
    error InvalidPosition();
    error Unhealthy();
    error InsufficientReserve();
    error InsufficientCollateral();
    error InsufficientDebt();
    error NotSettled();
    error AlreadySettled();
    error Unresolved();
    error Reentrancy();

    modifier nonReentrant() {
        if (_entered != 1) revert Reentrancy();
        _entered = 2;
        _;
        _entered = 1;
    }

    modifier notSettled() {
        if (settled) revert AlreadySettled();
        _;
    }

    modifier onlySettled() {
        if (!settled) revert NotSettled();
        _;
    }

    constructor(
        IConditionalTokens ctf,
        address weth_,
        address usdc_,
        bytes32 conditionId_,
        PmAmmPool wethPool_,
        IPriceOracle ethUsd_
    ) {
        if (address(ctf) == address(0) || weth_ == address(0) || usdc_ == address(0)) revert InvalidToken();
        if (address(wethPool_) == address(0) || address(ethUsd_) == address(0)) revert InvalidToken();

        conditionalTokens = ctf;
        weth = weth_;
        usdc = usdc_;
        conditionId = conditionId_;
        wethPool = wethPool_;
        ethUsd = ethUsd_;

        // Derive ids straight from the CTF so we agree with the real Gnosis contract.
        yesWethId = ctf.getPositionId(weth_, ctf.getCollectionId(bytes32(0), conditionId_, CtfPositionLib.YES_INDEX_SET));
        yesUsdcId = ctf.getPositionId(usdc_, ctf.getCollectionId(bytes32(0), conditionId_, CtfPositionLib.YES_INDEX_SET));
        noUsdcId = ctf.getPositionId(usdc_, ctf.getCollectionId(bytes32(0), conditionId_, CtfPositionLib.NO_INDEX_SET));

        IERC20Minimal(usdc_).approve(address(ctf), type(uint256).max);
    }

    /// @notice Seed the borrowable reserve. USDC is split into YES/NO legs so the
    ///         contract never custodies raw USDC; only the YES-USDC leg is lendable
    ///         and the NO-USDC leg keeps the opposite universe solvent at resolution.
    function seedReserve(uint256 usdcAmount) external nonReentrant notSettled {
        if (usdcAmount == 0) revert InvalidAmount();
        reserveYesUsdc += usdcAmount;
        seedTotal += usdcAmount;
        seedOf[msg.sender] += usdcAmount;

        IERC20Minimal(usdc).transferFrom(msg.sender, address(this), usdcAmount);
        conditionalTokens.splitPosition(usdc, bytes32(0), conditionId, CtfPositionLib.binaryPartition(), usdcAmount);

        emit ReserveSeeded(msg.sender, usdcAmount);
    }

    function deposit(uint256 amount) external nonReentrant notSettled {
        if (amount == 0) revert InvalidAmount();
        collateralOf[msg.sender] += amount;
        conditionalTokens.safeTransferFrom(msg.sender, address(this), yesWethId, amount, "");
        emit Deposited(msg.sender, amount);
    }

    /// @notice Borrow YES-USDC against escrowed YES-WETH. The only position this
    ///         function ever lends is yesUsdcId, so a cross-leg (NO-USDC) or
    ///         cross-condition borrow is structurally impossible.
    function borrow(uint256 amount) external nonReentrant notSettled {
        if (amount == 0) revert InvalidAmount();
        if (amount > reserveYesUsdc) revert InsufficientReserve();

        reserveYesUsdc -= amount;
        totalDebt += amount;
        debtOf[msg.sender] += amount;
        if (healthFactor(msg.sender) < WAD) revert Unhealthy();

        conditionalTokens.safeTransferFrom(address(this), msg.sender, yesUsdcId, amount, "");
        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external nonReentrant notSettled {
        uint256 debt = debtOf[msg.sender];
        if (amount == 0 || amount > debt) revert InsufficientDebt();

        debtOf[msg.sender] = debt - amount;
        totalDebt -= amount;
        reserveYesUsdc += amount;
        conditionalTokens.safeTransferFrom(msg.sender, address(this), yesUsdcId, amount, "");
        emit Repaid(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant notSettled {
        uint256 collateral = collateralOf[msg.sender];
        if (amount == 0 || amount > collateral) revert InsufficientCollateral();

        collateralOf[msg.sender] = collateral - amount;
        if (healthFactor(msg.sender) < WAD) revert Unhealthy();

        conditionalTokens.safeTransferFrom(address(this), msg.sender, yesWethId, amount, "");
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Permissionless, idempotent settlement. Redeems every leg the contract
    ///         holds to raw collateral, reads the resolution outcome from the CTF
    ///         payout vector, snapshots ETH/USD, and freezes the book. Claims are the
    ///         only entry points afterwards.
    function settle() external nonReentrant notSettled {
        if (conditionalTokens.payoutDenominator(conditionId) == 0) revert Unresolved();

        // YES occupies outcome slot 0 of the binary partition.
        yesWon = conditionalTokens.payoutNumerators(conditionId, 0) > 0;
        settlePEth = ethUsd.priceWad();
        settledTotalDebt = totalDebt;
        settled = true;

        uint256 wethBefore = IERC20Minimal(weth).balanceOf(address(this));
        uint256 usdcBefore = IERC20Minimal(usdc).balanceOf(address(this));

        uint256[] memory both = CtfPositionLib.binaryPartition();
        conditionalTokens.redeemPositions(weth, bytes32(0), conditionId, both);
        conditionalTokens.redeemPositions(usdc, bytes32(0), conditionId, both);

        uint256 wethRedeemed = IERC20Minimal(weth).balanceOf(address(this)) - wethBefore;
        uint256 usdcRedeemed = IERC20Minimal(usdc).balanceOf(address(this)) - usdcBefore;

        if (yesWon) {
            // The WETH pot is the redeemed collateral. The debt is covered out of it at
            // the frozen price; lenders get that slice, borrowers keep the rest.
            // HF>=1 at borrow guarantees the cover never exceeds collateral.
            lenderCoverWeth = settledTotalDebt * WAD / settlePEth;
            if (lenderCoverWeth > wethRedeemed) lenderCoverWeth = wethRedeemed;
            settledReserveUsdc = usdcRedeemed; // unborrowed reserve YES-USDC -> USDC
        }
        // NO branch: collateral redeemed to 0, USDC pot == seed via NO-USDC.

        emit Settled(yesWon, settlePEth, wethRedeemed, usdcRedeemed);
    }

    /// @notice Borrower claim. YES: receives collateral net of debt valued at the
    ///         frozen price (equity = C - D/pEth, the cover slice goes to lenders).
    ///         NO: collateral is worthless and the debt is forgiven; nothing to pay.
    function claimBorrower() external nonReentrant onlySettled returns (uint256 wethOut) {
        uint256 collateral = collateralOf[msg.sender];
        uint256 debt = debtOf[msg.sender];
        if (collateral == 0 && debt == 0) revert InvalidAmount();

        collateralOf[msg.sender] = 0;
        debtOf[msg.sender] = 0;

        if (yesWon) {
            uint256 cover = debt * WAD / settlePEth;
            wethOut = cover >= collateral ? 0 : collateral - cover;
            wethOut = _capWeth(wethOut);
            if (wethOut > 0) IERC20Minimal(weth).transfer(msg.sender, wethOut);
        }

        emit BorrowerClaimed(msg.sender, wethOut);
    }

    /// @notice Lender claim, pro-rata to seed share. YES: the unborrowed reserve
    ///         (USDC) plus the debt-covering WETH set aside from borrowers, recovering
    ///         the seed value AT the settlement price -- the WETH leg is downside-exposed
    ///         to ETH, and if ETH fell since borrow the cover is capped at the collateral
    ///         so lenders eat that shortfall. NO: the NO-USDC redemption returns the seed
    ///         in USDC.
    function claimLender() external nonReentrant onlySettled returns (uint256 wethOut, uint256 usdcOut) {
        uint256 share = seedOf[msg.sender];
        if (share == 0) revert InvalidAmount();
        seedOf[msg.sender] = 0;

        if (yesWon) {
            wethOut = _capWeth(lenderCoverWeth * share / seedTotal);
            usdcOut = settledReserveUsdc * share / seedTotal;
            if (wethOut > 0) IERC20Minimal(weth).transfer(msg.sender, wethOut);
        } else {
            // NO-USDC redeemed 1:1 to the seed, so each lender recovers exactly its seed.
            usdcOut = share;
        }
        usdcOut = _capUsdc(usdcOut);
        if (usdcOut > 0) IERC20Minimal(usdc).transfer(msg.sender, usdcOut);

        emit LenderClaimed(msg.sender, wethOut, usdcOut);
    }

    /// @dev Cap an outgoing transfer at the live balance so pro-rata rounding dust is
    ///      absorbed by the last claimant instead of bricking them on insufficient funds.
    function _capWeth(uint256 amount) internal view returns (uint256) {
        uint256 bal = IERC20Minimal(weth).balanceOf(address(this));
        return amount > bal ? bal : amount;
    }

    function _capUsdc(uint256 amount) internal view returns (uint256) {
        uint256 bal = IERC20Minimal(usdc).balanceOf(address(this));
        return amount > bal ? bal : amount;
    }

    /// @notice HF = C * pEth * LTV_max(g) / D, all WAD. Collateral is worth
    ///         C*pYes*pEth and debt D*pYes, so P(YES) cancels and HF is invariant to
    ///         price swings. D==0 is unbounded health.
    function healthFactor(address user) public view returns (uint256) {
        uint256 debt = debtOf[user];
        if (debt == 0) return type(uint256).max;

        uint256 pEth = ethUsd.priceWad();
        uint256 ltv = _ltvMax(wethPool.gap());
        return (collateralOf[user] * pEth / WAD) * ltv / debt;
    }

    /// @dev Clamped-linear haircut on |g|: a spoofed wide gap only lowers LTV.
    function _ltvMax(int256 g) internal pure returns (uint256) {
        uint256 absG = g == type(int256).min ? uint256(type(int256).max) + 1 : uint256(g < 0 ? -g : g);
        uint256 norm = absG * WAD / G_CAP;
        if (norm > WAD) norm = WAD;
        return LTV_BASE * (WAD - norm * H / WAD) / WAD;
    }

    function onERC1155Received(address, address, uint256 id, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != address(conditionalTokens)) revert InvalidToken();
        if (id != yesWethId && id != yesUsdcId && id != noUsdcId) revert InvalidPosition();
        return ERC1155_RECEIVED;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata ids, uint256[] calldata, bytes calldata)
        external
        view
        returns (bytes4)
    {
        if (msg.sender != address(conditionalTokens)) revert InvalidToken();
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] != yesWethId && ids[i] != yesUsdcId && ids[i] != noUsdcId) revert InvalidPosition();
        }
        return ERC1155_BATCH_RECEIVED;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == ERC1155_RECEIVER_INTERFACE_ID;
    }
}
