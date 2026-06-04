// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOmniverseMath} from "./interfaces/IOmniverseMath.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";
import {IERC1155Receiver} from "./interfaces/IERC1155Receiver.sol";
import {CtfPositionLib} from "./libraries/CtfPositionLib.sol";

/// @notice pm-AMM pool backed by Gnosis CTF-compatible ERC-1155 YES/NO positions.
contract PmAmmPool is IERC1155Receiver {
    uint256 public constant WAD = 1e18;
    uint256 public constant HALF_WAD = 0.5e18;
    uint256 public constant WAD_SQRT = 1e9;
    uint256 public constant MAX_KERNEL_INPUT = type(uint128).max;
    uint256 public constant MIN_ELL = 1e6;
    uint256 public constant FREEZE_WINDOW = 1 hours;
    uint256 public constant INVARIANT_EPS = 1e9;

    bytes4 internal constant ERC1155_RECEIVED = 0xf23a6e61;
    bytes4 internal constant ERC1155_BATCH_RECEIVED = 0xbc197c81;
    bytes4 internal constant ERC1155_RECEIVER_INTERFACE_ID = 0x4e2312e0;

    IOmniverseMath public immutable math;
    IConditionalTokens public immutable conditionalTokens;
    address public immutable collateralToken;
    bytes32 public immutable conditionId;
    uint256 public immutable yesPositionId;
    uint256 public immutable noPositionId;
    uint256 public immutable marketId;

    // x = NO reserve, y = YES reserve.
    uint256 public xActive;
    uint256 public yActive;
    uint256 public xPassive;
    uint256 public yPassive;

    uint256 public immutable L0;
    uint256 public immutable T;
    uint256 public immutable duration;
    uint256 public ellActive;
    uint256 public lambdaWad;
    uint256 public gammaPrimeWad;
    uint256 public nLast;
    bool public useDynamicLambda;

    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;

    uint256 private _entered = 1;

    event Rebalanced(uint256 xActive, uint256 yActive, uint256 ellActive, uint256 lambdaWad, uint256 blockNumber);
    event OmniverseTrade(
        uint256 indexed marketId,
        address indexed trader,
        uint8 side,
        uint256 size,
        uint256 priceWad,
        uint256 ellWad,
        uint256 lambdaWad,
        int256 gapWad,
        uint64 timestamp
    );
    event LiquidityAdded(address indexed provider, uint256 yesAmount, uint256 noAmount, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 yesAmount, uint256 noAmount, uint256 shares);

    error DeadlineExpired();
    error Expired();
    error Frozen();
    error InvalidAmount();
    error InvalidMath();
    error InvalidToken();
    error InvalidExpiry();
    error InvalidPosition();
    error KernelInputOutOfBounds();
    error MathReturnedInvalidReserve();
    error InvariantViolation();
    error Reentrancy();
    error Slippage();

    modifier nonReentrant() {
        if (_entered != 1) revert Reentrancy();
        _entered = 2;
        _;
        _entered = 1;
    }

    constructor(
        IOmniverseMath math_,
        IConditionalTokens conditionalTokens_,
        address collateralToken_,
        bytes32 conditionId_,
        uint256 marketId_,
        uint256 xInitial,
        uint256 yInitial,
        uint256 l0,
        uint256 expiry,
        uint256 gammaPrime,
        bool dynamicLambda
    ) {
        if (address(math_) == address(0)) revert InvalidMath();
        if (address(conditionalTokens_) == address(0) || collateralToken_ == address(0)) revert InvalidToken();
        if (expiry <= block.timestamp) revert InvalidExpiry();

        math = math_;
        conditionalTokens = conditionalTokens_;
        collateralToken = collateralToken_;
        conditionId = conditionId_;
        yesPositionId = CtfPositionLib.yesPositionId(collateralToken_, conditionId_);
        noPositionId = CtfPositionLib.noPositionId(collateralToken_, conditionId_);
        marketId = marketId_;
        L0 = l0;
        T = expiry;
        duration = expiry - block.timestamp;
        gammaPrimeWad = gammaPrime;
        useDynamicLambda = dynamicLambda;
        lambdaWad = dynamicLambda ? WAD : HALF_WAD;
        nLast = block.number;

        _assertKernelBounds(xInitial, yInitial, l0);
        xActive = xInitial;
        yActive = yInitial;
        ellActive = _floorEll(l0);
    }

    function buyYes(uint256 noIn, uint256 minOut) external nonReentrant returns (uint256 yesOut) {
        return _buyYes(noIn, minOut, type(uint256).max);
    }

    /// @notice Buy YES by paying NO into the pool.
    function buyYes(uint256 noIn, uint256 minOut, uint256 deadline) external nonReentrant returns (uint256 yesOut) {
        return _buyYes(noIn, minOut, deadline);
    }

    function buyNo(uint256 yesIn, uint256 minOut) external nonReentrant returns (uint256 noOut) {
        return _buyNo(yesIn, minOut, type(uint256).max);
    }

    /// @notice Buy NO by paying YES into the pool.
    function buyNo(uint256 yesIn, uint256 minOut, uint256 deadline) external nonReentrant returns (uint256 noOut) {
        return _buyNo(yesIn, minOut, deadline);
    }

    function addLiquidity(uint256 yesAmount, uint256 noAmount, uint256 minShares)
        external
        nonReentrant
        returns (uint256 mintedShares)
    {
        if (yesAmount == 0 || noAmount == 0) revert InvalidAmount();
        _rebalance();

        uint256 xTotal = xActive + xPassive;
        uint256 yTotal = yActive + yPassive;
        if (totalShares == 0) {
            mintedShares = _min(yesAmount, noAmount);
        } else {
            mintedShares = _min((yesAmount * totalShares) / yTotal, (noAmount * totalShares) / xTotal);
        }
        if (mintedShares == 0 || mintedShares < minShares) revert Slippage();

        totalShares += mintedShares;
        sharesOf[msg.sender] += mintedShares;
        xActive += noAmount;
        yActive += yesAmount;
        _assertKernelBounds(xActive, yActive, ellActive);

        conditionalTokens.safeTransferFrom(msg.sender, address(this), yesPositionId, yesAmount, "");
        conditionalTokens.safeTransferFrom(msg.sender, address(this), noPositionId, noAmount, "");

        emit LiquidityAdded(msg.sender, yesAmount, noAmount, mintedShares);
    }

    function removeLiquidity(uint256 shares, uint256 minYesOut, uint256 minNoOut)
        external
        nonReentrant
        returns (uint256 yesOut, uint256 noOut)
    {
        if (shares == 0 || sharesOf[msg.sender] < shares) revert InvalidAmount();
        _rebalance();

        uint256 supply = totalShares;
        noOut = ((xActive + xPassive) * shares) / supply;
        yesOut = ((yActive + yPassive) * shares) / supply;
        if (yesOut < minYesOut || noOut < minNoOut) revert Slippage();

        totalShares = supply - shares;
        sharesOf[msg.sender] -= shares;
        _removeReserves(noOut, yesOut);

        conditionalTokens.safeTransferFrom(address(this), msg.sender, yesPositionId, yesOut, "");
        conditionalTokens.safeTransferFrom(address(this), msg.sender, noPositionId, noOut, "");

        emit LiquidityRemoved(msg.sender, yesOut, noOut, shares);
    }

    function rebalance() external nonReentrant {
        _rebalance();
    }

    function currentPrice() public view returns (uint256) {
        _assertKernelBounds(xActive, yActive, ellActive);
        return math.Phi(_zFromReserves(xActive, yActive, ellActive));
    }

    /// @notice Current decayed liquidity parameter L_t = L0 * sqrt((T - t)/duration).
    function currentLiquidity() public view returns (uint256) {
        return _floorEll(_liquidityAt(block.timestamp));
    }

    function gap() public view returns (int256) {
        uint256 xTotal = xActive + xPassive;
        uint256 yTotal = yActive + yPassive;
        uint256 ellTotal = _floorEll(_liquidityAt(block.timestamp >= T ? T - 1 : block.timestamp));
        return _zFromReserves(xActive, yActive, ellActive) - _zFromReserves(xTotal, yTotal, ellTotal);
    }

    function getReserves()
        external
        view
        returns (
            uint256 xActive_,
            uint256 xPassive_,
            uint256 yActive_,
            uint256 yPassive_,
            uint256 ellActive_,
            uint256 lambdaWad_,
            uint256 lT_
        )
    {
        return (xActive, xPassive, yActive, yPassive, ellActive, lambdaWad, _liquidityAt(block.timestamp));
    }

    function onERC1155Received(address, address, uint256 id, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != address(conditionalTokens)) revert InvalidToken();
        if (id != yesPositionId && id != noPositionId) revert InvalidPosition();
        return ERC1155_RECEIVED;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata ids, uint256[] calldata, bytes calldata)
        external
        view
        returns (bytes4)
    {
        if (msg.sender != address(conditionalTokens)) revert InvalidToken();
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] != yesPositionId && ids[i] != noPositionId) revert InvalidPosition();
        }
        return ERC1155_BATCH_RECEIVED;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == ERC1155_RECEIVER_INTERFACE_ID;
    }

    function _buyYes(uint256 noIn, uint256 minOut, uint256 deadline) internal returns (uint256 yesOut) {
        _checkTrade(noIn, deadline);
        _rebalance();

        uint256 x1 = xActive + noIn;
        _assertKernelBounds(x1, yActive, ellActive);

        uint256 y1 = math.solveSwap(x1, yActive, ellActive);
        if (y1 > yActive) revert MathReturnedInvalidReserve();

        yesOut = yActive - y1;
        if (yesOut < minOut) revert Slippage();
        if (conditionalTokens.balanceOf(address(this), yesPositionId) < yesOut) revert MathReturnedInvalidReserve();

        xActive = x1;
        yActive = y1;

        (uint256 priceWad, int256 gapWad) = _assertInvariantAndPrice();

        conditionalTokens.safeTransferFrom(msg.sender, address(this), noPositionId, noIn, "");
        conditionalTokens.safeTransferFrom(address(this), msg.sender, yesPositionId, yesOut, "");

        emit OmniverseTrade(
            marketId, msg.sender, 0, noIn, priceWad, ellActive, lambdaWad, gapWad, uint64(block.timestamp)
        );
    }

    function _buyNo(uint256 yesIn, uint256 minOut, uint256 deadline) internal returns (uint256 noOut) {
        _checkTrade(yesIn, deadline);
        _rebalance();

        uint256 y1 = yActive + yesIn;
        _assertKernelBounds(y1, xActive, ellActive);

        uint256 x1 = math.solveSwap(y1, xActive, ellActive);
        if (x1 > xActive) revert MathReturnedInvalidReserve();

        noOut = xActive - x1;
        if (noOut < minOut) revert Slippage();
        if (conditionalTokens.balanceOf(address(this), noPositionId) < noOut) revert MathReturnedInvalidReserve();

        xActive = x1;
        yActive = y1;

        (uint256 priceWad, int256 gapWad) = _assertInvariantAndPrice();

        conditionalTokens.safeTransferFrom(msg.sender, address(this), yesPositionId, yesIn, "");
        conditionalTokens.safeTransferFrom(address(this), msg.sender, noPositionId, noOut, "");

        emit OmniverseTrade(
            marketId, msg.sender, 2, yesIn, priceWad, ellActive, lambdaWad, gapWad, uint64(block.timestamp)
        );
    }

    function _checkTrade(uint256 amountIn, uint256 deadline) internal view {
        if (amountIn == 0) revert InvalidAmount();
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (block.timestamp >= T - FREEZE_WINDOW) revert Frozen();
    }

    function _rebalance() internal {
        if (block.timestamp >= T) revert Expired();
        if (block.number <= nLast) return;

        uint256 xTotal = xActive + xPassive;
        uint256 yTotal = yActive + yPassive;
        uint256 ellTotal = _floorEll(_liquidityAt(block.timestamp));
        _assertKernelBounds(xTotal, yTotal, ellTotal);

        uint256 p = math.Phi(_zFromReserves(xTotal, yTotal, ellTotal));
        uint256 nextLambda = useDynamicLambda ? math.lambdaStarGaussian(gammaPrimeWad, p) : HALF_WAD;
        if (nextLambda > WAD) revert MathReturnedInvalidReserve();

        uint256 nextXActive = (xTotal * nextLambda) / WAD;
        uint256 nextYActive = (yTotal * nextLambda) / WAD;
        uint256 nextEllActive = _floorEll((ellTotal * nextLambda) / WAD);

        _assertKernelBounds(nextXActive, nextYActive, nextEllActive);

        xActive = nextXActive;
        yActive = nextYActive;
        xPassive = xTotal - nextXActive;
        yPassive = yTotal - nextYActive;
        ellActive = nextEllActive;
        lambdaWad = nextLambda;
        nLast = block.number;

        emit Rebalanced(nextXActive, nextYActive, nextEllActive, nextLambda, block.number);
    }

    function _liquidityAt(uint256 timestamp) internal view returns (uint256) {
        if (timestamp >= T) return 0;
        uint256 fractionWad = ((T - timestamp) * WAD) / duration;
        return (L0 * _sqrt(fractionWad)) / WAD_SQRT;
    }

    function _assertInvariantAndPrice() internal view returns (uint256 priceWad, int256 gapWad) {
        int256 zAfter = _zFromReserves(xActive, yActive, ellActive);
        priceWad = math.Phi(zAfter);
        int256 f = _invariantResidual(xActive, yActive, ellActive, priceWad, math.phi(zAfter));
        if (f > int256(INVARIANT_EPS) || f < -int256(INVARIANT_EPS)) revert InvariantViolation();
        gapWad = gap();
    }

    /// @dev Signed residual of the pm-AMM invariant f = (y-x)*Phi(z) + ell*phi(z) - y.
    function _invariantResidual(uint256 x, uint256 y, uint256 ell, uint256 pPhi, uint256 pSmallPhi)
        internal
        pure
        returns (int256)
    {
        int256 diff = _toInt256(y) - _toInt256(x);
        int256 term1 = (diff * int256(pPhi)) / int256(WAD);
        int256 term2 = (_toInt256(ell) * int256(pSmallPhi)) / int256(WAD);
        return term1 + term2 - _toInt256(y);
    }

    function _removeReserves(uint256 noOut, uint256 yesOut) internal {
        xActive = _removeFromBuckets(xActive, xPassive, noOut, true);
        yActive = _removeFromBuckets(yActive, yPassive, yesOut, false);
    }

    function _removeFromBuckets(uint256 active, uint256 passive, uint256 amount, bool isNo) internal returns (uint256) {
        if (amount <= passive) {
            if (isNo) xPassive = passive - amount;
            else yPassive = passive - amount;
            return active;
        }

        uint256 activeOut = amount - passive;
        if (activeOut > active) revert InvalidAmount();
        if (isNo) xPassive = 0;
        else yPassive = 0;
        return active - activeOut;
    }

    function _zFromReserves(uint256 x, uint256 y, uint256 ell) internal pure returns (int256) {
        int256 ySigned = _toInt256(y);
        int256 xSigned = _toInt256(x);
        int256 ellSigned = _toInt256(ell);
        return ((ySigned - xSigned) * int256(WAD)) / ellSigned;
    }

    function _assertKernelBounds(uint256 x, uint256 y, uint256 ell) internal pure {
        if (x > MAX_KERNEL_INPUT || y > MAX_KERNEL_INPUT || ell > MAX_KERNEL_INPUT) {
            revert KernelInputOutOfBounds();
        }
    }

    function _floorEll(uint256 ell) internal pure returns (uint256) {
        return ell < MIN_ELL ? MIN_ELL : ell;
    }

    function _toInt256(uint256 value) internal pure returns (int256) {
        if (value > uint256(type(int256).max)) revert KernelInputOutOfBounds();
        return int256(value);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _sqrt(uint256 x) internal pure returns (uint256 z) {
        if (x == 0) return 0;
        z = x;
        uint256 y = (x + 1) / 2;
        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        }
    }
}
