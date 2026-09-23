// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./VitaelOracle.sol";

/**
 * @title VitaelLendingPool
 * @notice Multi-asset lending & borrowing — USDC, EURC, cirBTC on Arc Testnet.
 * @dev Each asset can be supplied (earning yield) AND used as collateral to borrow others.
 *      Interest model: kinked rate (Aave-style). Oracle: Stork via VitaelOracle (8 dec).
 */
contract VitaelLendingPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct AssetConfig {
        bool isSupported;
        uint8 decimals;
        uint256 ltv; // basis points, e.g. 7500 = 75%
        uint256 liquidationThreshold; // basis points, e.g. 8000 = 80%
        uint256 liquidationBonus; // basis points, e.g. 500  = 5%
        // Interest model (per-asset)
        uint256 baseRate; // 1e18 scale, e.g. 2e16 = 2%
        uint256 optimalUtilization; // 1e18 scale, e.g. 8e17 = 80%
        uint256 slope1; // 1e18 scale
        uint256 slope2; // 1e18 scale
        uint256 reserveFactor; // basis points, e.g. 1000 = 10%
    }

    struct AssetState {
        uint256 totalBorrowed; // compounded total borrowed (asset decimals)
        uint256 totalReserves; // protocol reserves (asset decimals)
        uint256 borrowIndex; // cumulative borrow index (1e18)
        uint256 lastAccruedTime;
        // Supply-side: share-based (like Compound cTokens)
        uint256 totalShares; // total supply shares
    }

    struct UserBorrow {
        uint256 principal; // principal at last update (asset decimals)
        uint256 borrowIndex; // borrow index at last update
    }

    // ─── State ────────────────────────────────────────────────────────────────

    VitaelOracle public immutable oracle;

    address[] public supportedAssets;
    mapping(address => AssetConfig) public assetConfigs;
    mapping(address => AssetState) public assetStates;

    // user => asset => supply shares
    mapping(address => mapping(address => uint256)) public userShares;
    // user => collateral asset => amount deposited (separate from supply)
    mapping(address => mapping(address => uint256)) public userCollateral;
    // user => borrow asset => borrow state
    mapping(address => mapping(address => UserBorrow)) public userBorrows;

    // Dedicated collateral is custody-only, never supplier-owned liquidity.
    mapping(address => uint256) public totalCollateral;
    // Only cash received through protocol entry points belongs to the lending market.
    mapping(address => uint256) public accountedCash;
    mapping(address => uint256) public totalDebtShares;
    mapping(address => mapping(address => uint256)) public userDebtShares;
    uint256 public constant DEBT_SHARE_SCALE = 1e27;

    struct LiquidationQuote {
        uint256 repayAmount;
        uint256 seizedCollateral;
        uint256 supplyShares;
    }

    uint256 public constant CLOSE_FACTOR = 5000; // 50% max liquidation

    // ─── Events ───────────────────────────────────────────────────────────────

    event AssetAdded(address indexed asset);
    event Supplied(address indexed user, address indexed asset, uint256 amount, uint256 shares);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount, uint256 shares);
    event CollateralDeposited(address indexed user, address indexed asset, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed asset, uint256 amount);
    event Borrowed(address indexed user, address indexed asset, uint256 amount);
    event Repaid(address indexed user, address indexed asset, uint256 amount);
    event Liquidated(
        address indexed borrower,
        address indexed liquidator,
        address indexed collateralAsset,
        address debtAsset,
        uint256 repaidAmount,
        uint256 seizedCollateral
    );
    event InterestAccrued(address indexed asset, uint256 borrowIndex);
    event ReservesWithdrawn(address indexed asset, uint256 amount);
    event AccountShortfall(address indexed user, uint256 shortfallUSD);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroAmount();
    error AssetNotSupported();
    error InsufficientBalance();
    error InsufficientLiquidity();
    error HealthFactorTooLow();
    error BorrowLimitExceeded();
    error PositionHealthy();
    error RepayExceedsDebt();
    error ExceedsCloseFactor();
    error InsufficientReserves();
    error SameAsset();
    error InvalidAssetConfiguration();
    error ZeroShares();
    error UnsupportedTransfer();
    error NoLiquidatableCollateral();
    error LiquidationTooSmall();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _oracle) Ownable(msg.sender) {
        oracle = VitaelOracle(_oracle);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new asset. Call once per token.
     * @param asset          Token address
     * @param decimals       Token decimals (6 for USDC/EURC, 8 for cirBTC)
     * @param ltv            Loan-to-value in bps (e.g. 7500)
     * @param liqThreshold   Liquidation threshold in bps (e.g. 8000)
     * @param liqBonus       Liquidation bonus in bps (e.g. 500)
     * @param baseRate       Annual base borrow rate 1e18 (e.g. 2e16 = 2%)
     * @param optimalUtil    Optimal utilization 1e18 (e.g. 8e17 = 80%)
     * @param slope1         Slope below optimal 1e18 (e.g. 4e16 = 4%)
     * @param slope2         Slope above optimal 1e18 (e.g. 75e16 = 75%)
     * @param reserveFactor  Reserve factor in bps (e.g. 1000 = 10%)
     */
    function addAsset(
        address asset,
        uint8 decimals,
        uint256 ltv,
        uint256 liqThreshold,
        uint256 liqBonus,
        uint256 baseRate,
        uint256 optimalUtil,
        uint256 slope1,
        uint256 slope2,
        uint256 reserveFactor
    ) external onlyOwner {
        if (
            asset.code.length == 0 || decimals > 18 || IERC20Metadata(asset).decimals() != decimals
                || ltv > liqThreshold || liqThreshold > 10000 || liqBonus > 10000 || reserveFactor > 10000
                || optimalUtil == 0 || optimalUtil >= 1e18
        ) revert InvalidAssetConfiguration();
        if (assetConfigs[asset].isSupported) accrueInterest(asset);
        if (!assetConfigs[asset].isSupported) {
            supportedAssets.push(asset);
            assetStates[asset].borrowIndex = 1e18;
            assetStates[asset].lastAccruedTime = block.timestamp;
        }
        assetConfigs[asset] = AssetConfig({
            isSupported: true,
            decimals: decimals,
            ltv: ltv,
            liquidationThreshold: liqThreshold,
            liquidationBonus: liqBonus,
            baseRate: baseRate,
            optimalUtilization: optimalUtil,
            slope1: slope1,
            slope2: slope2,
            reserveFactor: reserveFactor
        });
        emit AssetAdded(asset);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Interest accrual ─────────────────────────────────────────────────────

    function accrueInterest(address asset) public {
        AssetState storage s = assetStates[asset];
        AssetConfig storage c = assetConfigs[asset];
        uint256 index = _currentBorrowIndex(asset);
        uint256 debt = _debtFromShares(totalDebtShares[asset], index);
        uint256 interest = debt - s.totalBorrowed;
        s.totalReserves += Math.mulDiv(interest, c.reserveFactor, 10000);
        s.totalBorrowed = debt;
        s.borrowIndex = index;
        s.lastAccruedTime = block.timestamp;
        if (interest > 0) emit InterestAccrued(asset, index);
    }

    function _borrowRate(AssetConfig storage c, uint256 totalBorrowed, uint256 cash) internal view returns (uint256) {
        if (totalBorrowed == 0) return c.baseRate;
        uint256 total = cash + totalBorrowed;
        uint256 u = (totalBorrowed * 1e18) / total;
        if (u <= c.optimalUtilization) {
            return c.baseRate + (u * c.slope1) / c.optimalUtilization;
        }
        return c.baseRate + c.slope1 + ((u - c.optimalUtilization) * c.slope2) / (1e18 - c.optimalUtilization);
    }

    // ─── Exchange rate (shares → asset) ──────────────────────────────────────

    /**
     * @notice 1 share = how many asset tokens (1e18 scaled).
     *         Increases over time as interest accrues.
     */
    function exchangeRate(address asset) public view returns (uint256) {
        AssetState storage s = assetStates[asset];
        if (s.totalShares == 0) return 1e18;
        return Math.mulDiv(_supplyAssets(asset), 1e18, s.totalShares);
    }

    function _sharesToAsset(address asset, uint256 shares) internal view returns (uint256) {
        return previewRedeem(asset, shares);
    }

    function _assetToShares(address asset, uint256 amount) internal view returns (uint256) {
        return previewSupply(asset, amount);
    }

    function previewSupply(address asset, uint256 amount) public view returns (uint256) {
        uint256 shares = assetStates[asset].totalShares;
        return shares == 0 ? amount : Math.mulDiv(amount, shares, _supplyAssets(asset));
    }

    function previewRedeem(address asset, uint256 shares) public view returns (uint256) {
        uint256 total = assetStates[asset].totalShares;
        return total == 0 ? shares : Math.mulDiv(shares, _supplyAssets(asset), total);
    }

    /// @notice Shares to burn for an asset withdrawal, rounded against the withdrawing account.
    function previewWithdraw(address asset, uint256 amount) public view returns (uint256) {
        uint256 shares = assetStates[asset].totalShares;
        return shares == 0 ? amount : Math.mulDiv(amount, shares, _supplyAssets(asset), Math.Rounding.Ceil);
    }

    // ─── Supply / Withdraw ────────────────────────────────────────────────────

    /**
     * @notice Supply any supported asset to earn yield.
     *         Receive supply shares (like cTokens) tracked internally.
     */
    function supply(address asset, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (!assetConfigs[asset].isSupported) revert AssetNotSupported();

        accrueInterest(asset);

        uint256 shares = _assetToShares(asset, amount);
        if (shares == 0) revert ZeroShares();
        assetStates[asset].totalShares += shares;
        userShares[msg.sender][asset] += shares;
        accountedCash[asset] += amount;
        _pullTokens(asset, amount);
        emit Supplied(msg.sender, asset, amount, shares);
    }

    /**
     * @notice Withdraw supplied asset by burning shares.
     * @param asset   Token to withdraw
     * @param shares  Number of supply shares to redeem (use type(uint256).max for all)
     */
    function withdraw(address asset, uint256 shares) external nonReentrant whenNotPaused {
        if (shares == 0) revert ZeroAmount();
        if (!assetConfigs[asset].isSupported) revert AssetNotSupported();

        accrueInterest(asset);

        uint256 userSh = userShares[msg.sender][asset];
        if (shares == type(uint256).max) shares = userSh;
        if (shares == 0) revert ZeroShares();
        if (shares > userSh) revert InsufficientBalance();

        uint256 amount = _sharesToAsset(asset, shares);
        if (amount == 0) revert ZeroAmount();
        if (getAvailableLiquidity(asset) < amount) revert InsufficientLiquidity();

        assetStates[asset].totalShares -= shares;
        userShares[msg.sender][asset] -= shares;
        accountedCash[asset] -= amount;

        // Validate the final cash/share state; a revert rolls back the transfer.
        IERC20(asset).safeTransfer(msg.sender, amount);
        if (_hasBorrow(msg.sender)) {
            _validateBorrowPosition(msg.sender);
        }

        emit Withdrawn(msg.sender, asset, amount, shares);
    }

    // ─── Collateral ───────────────────────────────────────────────────────────

    /**
     * @notice Deposit collateral (separate from supply — not earning yield).
     *         Use this to back borrows without earning supply APY.
     */
    function depositCollateral(address asset, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (!assetConfigs[asset].isSupported) revert AssetNotSupported();

        userCollateral[msg.sender][asset] += amount;
        totalCollateral[asset] += amount;
        _pullTokens(asset, amount);
        emit CollateralDeposited(msg.sender, asset, amount);
    }

    /**
     * @notice Withdraw collateral only if remaining collateral covers debt at the configured LTV.
     */
    function withdrawCollateral(address asset, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (userCollateral[msg.sender][asset] < amount) revert InsufficientBalance();

        userCollateral[msg.sender][asset] -= amount;
        totalCollateral[asset] -= amount;
        IERC20(asset).safeTransfer(msg.sender, amount);

        if (_hasBorrow(msg.sender)) {
            _validateBorrowPosition(msg.sender);
        }

        emit CollateralWithdrawn(msg.sender, asset, amount);
    }

    // ─── Borrow / Repay ───────────────────────────────────────────────────────

    /**
     * @notice Borrow any supported asset against collateral or supplied assets.
     * @param asset   Token to borrow
     * @param amount  Amount in token decimals
     */
    function borrow(address asset, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (!assetConfigs[asset].isSupported) revert AssetNotSupported();

        accrueInterest(asset);

        if (getAvailableLiquidity(asset) < amount) revert InsufficientLiquidity();

        AssetState storage s = assetStates[asset];
        uint256 shares = Math.mulDiv(amount, DEBT_SHARE_SCALE, s.borrowIndex, Math.Rounding.Ceil);
        totalDebtShares[asset] += shares;
        userDebtShares[msg.sender][asset] += shares;
        uint256 debt = _debtFromShares(totalDebtShares[asset], s.borrowIndex);
        // Rounding dust belongs to reserves, not newly created supplier yield.
        s.totalReserves += debt - s.totalBorrowed - amount;
        s.totalBorrowed = debt;
        _snapshotBorrow(msg.sender, asset);
        accountedCash[asset] -= amount;

        // Check after cash leaves: otherwise supplied collateral is temporarily inflated.
        IERC20(asset).safeTransfer(msg.sender, amount);
        _validateBorrowPosition(msg.sender);
        emit Borrowed(msg.sender, asset, amount);
    }

    /**
     * @notice Repay borrowed asset.
     * @param asset   Token to repay
     * @param amount  Amount to repay (use type(uint256).max to repay full debt)
     */
    function repay(address asset, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (!assetConfigs[asset].isSupported) revert AssetNotSupported();

        accrueInterest(asset);

        uint256 currentDebt = getBorrowBalance(msg.sender, asset);
        if (currentDebt == 0) revert ZeroAmount();

        // Allow repaying full debt with max uint
        if (amount > currentDebt) amount = currentDebt;

        _reduceDebt(msg.sender, asset, amount);
        _pullTokens(asset, amount);
        emit Repaid(msg.sender, asset, amount);
    }

    // ─── Liquidation ──────────────────────────────────────────────────────────

    /**
     * @notice Liquidate an unhealthy position.
     * @param borrower        Address of the borrower
     * @param debtAsset       Asset the borrower owes
     * @param collateralAsset Asset to seize as reward
     * @param repayAmount     Amount of debtAsset to repay (≤ 50% of total debt)
     */
    function liquidate(address borrower, address debtAsset, address collateralAsset, uint256 repayAmount)
        external
        nonReentrant
        whenNotPaused
    {
        accrueInterest(debtAsset);
        if (collateralAsset != debtAsset) accrueInterest(collateralAsset);
        LiquidationQuote memory q = _quoteLiquidation(borrower, debtAsset, collateralAsset, repayAmount);

        uint256 dedicated = Math.min(q.seizedCollateral, userCollateral[borrower][collateralAsset]);
        userCollateral[borrower][collateralAsset] -= dedicated;
        totalCollateral[collateralAsset] -= dedicated;
        userShares[borrower][collateralAsset] -= q.supplyShares;
        assetStates[collateralAsset].totalShares -= q.supplyShares;
        accountedCash[collateralAsset] -= q.seizedCollateral - dedicated;

        _reduceDebt(borrower, debtAsset, q.repayAmount);
        _pullTokens(debtAsset, q.repayAmount);
        IERC20(collateralAsset).safeTransfer(msg.sender, q.seizedCollateral);
        emit Liquidated(borrower, msg.sender, collateralAsset, debtAsset, q.repayAmount, q.seizedCollateral);

        (,, uint256 shortfall) = getAccountShortfall(borrower);
        if (shortfall > 0) emit AccountShortfall(borrower, shortfall);
    }

    /// @notice Quote executable repayment and collateral, capped by collateral and current liquidity.
    function quoteLiquidation(address borrower, address debtAsset, address collateralAsset, uint256 repayAmount)
        external
        view
        returns (uint256 actualRepay, uint256 seizedCollateral, uint256 supplyShares)
    {
        LiquidationQuote memory q = _quoteLiquidation(borrower, debtAsset, collateralAsset, repayAmount);
        return (q.repayAmount, q.seizedCollateral, q.supplyShares);
    }

    function _quoteLiquidation(address borrower, address debtAsset, address collateralAsset, uint256 repayAmount)
        internal
        view
        returns (LiquidationQuote memory q)
    {
        if (repayAmount == 0) revert ZeroAmount();
        if (!assetConfigs[debtAsset].isSupported || !assetConfigs[collateralAsset].isSupported) {
            revert AssetNotSupported();
        }
        if (_healthFactor(borrower) >= 1e18) revert PositionHealthy();
        uint256 totalDebt = getBorrowBalance(borrower, debtAsset);
        if (totalDebt == 0) revert ZeroAmount();
        // Ceil lets a final one-unit debt be repaid rather than becoming unliquidatable dust.
        if (repayAmount > Math.mulDiv(totalDebt, CLOSE_FACTOR, 10000, Math.Rounding.Ceil)) {
            revert ExceedsCloseFactor();
        }

        uint256 dedicated = userCollateral[borrower][collateralAsset];
        uint256 supplied = _sharesToAsset(collateralAsset, userShares[borrower][collateralAsset]);
        uint256 available = dedicated + Math.min(supplied, getAvailableLiquidity(collateralAsset));
        if (available == 0) revert NoLiquidatableCollateral();

        AssetConfig storage cc = assetConfigs[collateralAsset];
        uint256 numerator = oracle.getAssetPrice(debtAsset) * (10 ** cc.decimals) * (10000 + cc.liquidationBonus);
        uint256 denominator = oracle.getAssetPrice(collateralAsset) * (10 ** assetConfigs[debtAsset].decimals) * 10000;
        uint256 affordableRepay = Math.mulDiv(available, denominator, numerator);
        q.repayAmount = Math.min(repayAmount, affordableRepay);
        q.seizedCollateral = Math.mulDiv(q.repayAmount, numerator, denominator);
        if (q.repayAmount == 0 || q.seizedCollateral == 0) revert LiquidationTooSmall();
        if (q.seizedCollateral > dedicated) {
            q.supplyShares = previewWithdraw(collateralAsset, q.seizedCollateral - dedicated);
        }
    }

    // ─── View functions ───────────────────────────────────────────────────────

    /**
     * @notice Compounded borrow balance for a user on a specific asset.
     */
    function getBorrowBalance(address user, address asset) public view returns (uint256) {
        return _debtFromShares(userDebtShares[user][asset], _currentBorrowIndex(asset));
    }

    /**
     * @notice Supply balance (in asset tokens) for a user.
     */
    function getSupplyBalance(address user, address asset) public view returns (uint256) {
        uint256 shares = userShares[user][asset];
        if (shares == 0) return 0;
        return _sharesToAsset(asset, shares);
    }

    /**
     * @notice Health factor for a user. Returns type(uint256).max if no borrows.
     *         HF < 1e18 → liquidatable.
     */
    function getHealthFactor(address user) external view returns (uint256) {
        return _healthFactor(user);
    }

    /**
     * @notice Full position summary for a user.
     * @return totalCollateralUSD  Total collateral value (8-dec USD)
     * @return totalBorrowUSD      Total borrow value (8-dec USD)
     * @return healthFactor        HF scaled 1e18
     */
    function getPosition(address user)
        external
        view
        returns (uint256 totalCollateralUSD, uint256 totalBorrowUSD, uint256 healthFactor)
    {
        (totalCollateralUSD,, totalBorrowUSD) = _positionValues(user);
        healthFactor = _healthFactor(user);
    }

    /// @notice Mark-to-oracle shortfall in 8-decimal USD. Does not forgive debt or allocate losses.
    /// @dev Supply collateral is valued at its accounting claim, not guaranteed liquidation proceeds.
    function getAccountShortfall(address user)
        public
        view
        returns (uint256 collateralUSD, uint256 debtUSD, uint256 shortfallUSD)
    {
        for (uint256 i; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            uint256 collateral = userCollateral[user][asset] + _sharesToAsset(asset, userShares[user][asset]);
            uint256 debt = getBorrowBalance(user, asset);
            if (collateral == 0 && debt == 0) continue;
            uint256 price = oracle.getAssetPrice(asset);
            uint256 unit = 10 ** assetConfigs[asset].decimals;
            collateralUSD += Math.mulDiv(collateral, price, unit);
            debtUSD += Math.mulDiv(debt, price, unit, Math.Rounding.Ceil);
        }
        shortfallUSD = debtUSD > collateralUSD ? debtUSD - collateralUSD : 0;
    }

    /// @notice Tokens sent outside supply/repay/collateral entry points are not credited to any account.
    function getUnaccountedBalance(address asset) external view returns (uint256) {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        uint256 accounted = accountedCash[asset] + totalCollateral[asset];
        return balance > accounted ? balance - accounted : 0;
    }

    /**
     * @notice Current borrow APY for an asset (1e18 scale).
     */
    function getBorrowRate(address asset) external view returns (uint256) {
        AssetState storage s = assetStates[asset];
        AssetConfig storage c = assetConfigs[asset];
        uint256 cash = getAvailableLiquidity(asset);
        return _borrowRate(c, s.totalBorrowed, cash);
    }

    /**
     * @notice Current supply APY for an asset (1e18 scale).
     */
    function getSupplyRate(address asset) external view returns (uint256) {
        AssetState storage s = assetStates[asset];
        AssetConfig storage c = assetConfigs[asset];
        uint256 cash = getAvailableLiquidity(asset);
        if (s.totalBorrowed == 0) return 0;
        uint256 total = cash + s.totalBorrowed;
        uint256 u = (s.totalBorrowed * 1e18) / total;
        uint256 borrowRate = _borrowRate(c, s.totalBorrowed, cash);
        return (borrowRate * u * (10000 - c.reserveFactor)) / (1e18 * 10000);
    }

    /**
     * @notice Utilization rate for an asset (1e18 scale).
     */
    function getUtilization(address asset) external view returns (uint256) {
        AssetState storage s = assetStates[asset];
        if (s.totalBorrowed == 0) return 0;
        uint256 cash = getAvailableLiquidity(asset);
        uint256 total = cash + s.totalBorrowed;
        return (s.totalBorrowed * 1e18) / total;
    }

    /// @notice Accounted lending cash; excludes dedicated collateral and unsolicited transfers.
    function getAvailableLiquidity(address asset) public view returns (uint256) {
        return accountedCash[asset];
    }

    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }

    // ─── Owner: withdraw reserves ─────────────────────────────────────────────

    function withdrawReserves(address asset, uint256 amount) external onlyOwner nonReentrant {
        accrueInterest(asset);
        AssetState storage s = assetStates[asset];
        if (amount > s.totalReserves) revert InsufficientReserves();
        if (getAvailableLiquidity(asset) < amount) revert InsufficientLiquidity();
        s.totalReserves -= amount;
        accountedCash[asset] -= amount;
        IERC20(asset).safeTransfer(msg.sender, amount);
        emit ReservesWithdrawn(asset, amount);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _debtFromShares(uint256 shares, uint256 index) internal pure returns (uint256) {
        return Math.mulDiv(shares, index, DEBT_SHARE_SCALE, Math.Rounding.Ceil);
    }

    function _currentBorrowIndex(address asset) internal view returns (uint256 index) {
        AssetState storage s = assetStates[asset];
        index = s.borrowIndex;
        if (totalDebtShares[asset] == 0) return index;
        uint256 rate = _borrowRate(assetConfigs[asset], s.totalBorrowed, getAvailableLiquidity(asset));
        index += Math.mulDiv(index, rate * (block.timestamp - s.lastAccruedTime), 365 days * 1e18);
    }

    function _supplyAssets(address asset) internal view returns (uint256) {
        AssetState storage s = assetStates[asset];
        uint256 debt = _debtFromShares(totalDebtShares[asset], _currentBorrowIndex(asset));
        uint256 pendingReserve = Math.mulDiv(debt - s.totalBorrowed, assetConfigs[asset].reserveFactor, 10000);
        return accountedCash[asset] + debt - s.totalReserves - pendingReserve;
    }

    function _snapshotBorrow(address user, address asset) internal {
        uint256 index = assetStates[asset].borrowIndex;
        userBorrows[user][asset] = UserBorrow(_debtFromShares(userDebtShares[user][asset], index), index);
    }

    function _reduceDebt(address user, address asset, uint256 amount) internal {
        AssetState storage s = assetStates[asset];
        uint256 owned = userDebtShares[user][asset];
        uint256 shares = amount >= _debtFromShares(owned, s.borrowIndex)
            ? owned
            : Math.mulDiv(amount, DEBT_SHARE_SCALE, s.borrowIndex);
        if (shares == 0) revert ZeroShares();
        userDebtShares[user][asset] = owned - shares;
        totalDebtShares[asset] -= shares;
        uint256 debt = _debtFromShares(totalDebtShares[asset], s.borrowIndex);
        s.totalReserves += amount - (s.totalBorrowed - debt);
        s.totalBorrowed = debt;
        accountedCash[asset] += amount;
        _snapshotBorrow(user, asset);
    }

    function _pullTokens(address asset, uint256 amount) internal {
        uint256 beforeBalance = IERC20(asset).balanceOf(address(this));
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        if (IERC20(asset).balanceOf(address(this)) != beforeBalance + amount) revert UnsupportedTransfer();
    }

    function _hasBorrow(address user) internal view returns (bool) {
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            if (userBorrows[user][supportedAssets[i]].principal > 0) return true;
        }
        return false;
    }

    /**
     * @dev Returns (collateralThresholdUSD, collateralLtvUSD, totalBorrowUSD) in 8-dec precision.
     */
    function _positionValues(address user)
        internal
        view
        returns (uint256 collateralThresholdUSD, uint256 collateralLtvUSD, uint256 totalBorrowUSD)
    {
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            AssetConfig storage c = assetConfigs[asset];
            // Collateral: dedicated deposits + supply positions
            uint256 collAmt = userCollateral[user][asset] + _sharesToAsset(asset, userShares[user][asset]);
            uint256 debt = getBorrowBalance(user, asset);
            if (collAmt == 0 && debt == 0) continue;
            uint256 price = oracle.getAssetPrice(asset);

            if (collAmt > 0) {
                uint256 valueUSD = Math.mulDiv(collAmt, price, 10 ** c.decimals);
                collateralThresholdUSD += (valueUSD * c.liquidationThreshold) / 10000;
                collateralLtvUSD += (valueUSD * c.ltv) / 10000;
            }

            // Borrows
            if (debt > 0) {
                totalBorrowUSD += Math.mulDiv(debt, price, 10 ** c.decimals, Math.Rounding.Ceil);
            }
        }
    }

    function _healthFactor(address user) internal view returns (uint256) {
        (uint256 collThreshUSD,, uint256 borrowUSD) = _positionValues(user);
        if (borrowUSD == 0) return type(uint256).max;
        return (collThreshUSD * 1e18) / borrowUSD;
    }

    function _validateBorrowPosition(address user) internal view {
        (uint256 thresholdUSD, uint256 ltvUSD, uint256 debtUSD) = _positionValues(user);
        if (debtUSD > thresholdUSD) revert HealthFactorTooLow();
        if (debtUSD > ltvUSD) revert BorrowLimitExceeded();
    }
}
