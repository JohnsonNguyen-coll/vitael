// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
        bool    isSupported;
        uint8   decimals;
        uint256 ltv;                  // basis points, e.g. 7500 = 75%
        uint256 liquidationThreshold; // basis points, e.g. 8000 = 80%
        uint256 liquidationBonus;     // basis points, e.g. 500  = 5%
        // Interest model (per-asset)
        uint256 baseRate;             // 1e18 scale, e.g. 2e16 = 2%
        uint256 optimalUtilization;   // 1e18 scale, e.g. 8e17 = 80%
        uint256 slope1;               // 1e18 scale
        uint256 slope2;               // 1e18 scale
        uint256 reserveFactor;        // basis points, e.g. 1000 = 10%
    }

    struct AssetState {
        uint256 totalBorrowed;   // compounded total borrowed (asset decimals)
        uint256 totalReserves;   // protocol reserves (asset decimals)
        uint256 borrowIndex;     // cumulative borrow index (1e18)
        uint256 lastAccruedTime;
        // Supply-side: share-based (like Compound cTokens)
        uint256 totalShares;     // total supply shares
    }

    struct UserBorrow {
        uint256 principal;   // principal at last update (asset decimals)
        uint256 borrowIndex; // borrow index at last update
    }

    // ─── State ────────────────────────────────────────────────────────────────

    VitaelOracle public immutable oracle;

    address[] public supportedAssets;
    mapping(address => AssetConfig) public assetConfigs;
    mapping(address => AssetState)  public assetStates;

    // user => asset => supply shares
    mapping(address => mapping(address => uint256)) public userShares;
    // user => collateral asset => amount deposited (separate from supply)
    mapping(address => mapping(address => uint256)) public userCollateral;
    // user => borrow asset => borrow state
    mapping(address => mapping(address => UserBorrow)) public userBorrows;

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
        address indexed borrower, address indexed liquidator,
        address indexed collateralAsset, address debtAsset,
        uint256 repaidAmount, uint256 seizedCollateral
    );
    event InterestAccrued(address indexed asset, uint256 borrowIndex);
    event ReservesWithdrawn(address indexed asset, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroAmount();
    error AssetNotSupported();
    error InsufficientBalance();
    error InsufficientLiquidity();
    error HealthFactorTooLow();
    error PositionHealthy();
    error RepayExceedsDebt();
    error ExceedsCloseFactor();
    error InsufficientReserves();
    error SameAsset();


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
        uint8   decimals,
        uint256 ltv,
        uint256 liqThreshold,
        uint256 liqBonus,
        uint256 baseRate,
        uint256 optimalUtil,
        uint256 slope1,
        uint256 slope2,
        uint256 reserveFactor
    ) external onlyOwner {
        if (!assetConfigs[asset].isSupported) {
            supportedAssets.push(asset);
            assetStates[asset].borrowIndex     = 1e18;
            assetStates[asset].lastAccruedTime = block.timestamp;
        }
        assetConfigs[asset] = AssetConfig({
            isSupported:          true,
            decimals:             decimals,
            ltv:                  ltv,
            liquidationThreshold: liqThreshold,
            liquidationBonus:     liqBonus,
            baseRate:             baseRate,
            optimalUtilization:   optimalUtil,
            slope1:               slope1,
            slope2:               slope2,
            reserveFactor:        reserveFactor
        });
        emit AssetAdded(asset);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }


    // ─── Interest accrual ─────────────────────────────────────────────────────

    function accrueInterest(address asset) public {
        AssetState  storage s = assetStates[asset];
        AssetConfig storage c = assetConfigs[asset];
        uint256 elapsed = block.timestamp - s.lastAccruedTime;
        if (elapsed == 0 || s.totalBorrowed == 0) {
            s.lastAccruedTime = block.timestamp;
            return;
        }

        uint256 cash = IERC20(asset).balanceOf(address(this));
        uint256 rate = _borrowRate(c, s.totalBorrowed, cash);

        uint256 interest    = (s.totalBorrowed * rate * elapsed) / (365 days * 1e18);
        uint256 reserve     = (interest * c.reserveFactor) / 10000;

        s.totalBorrowed  += interest;
        s.totalReserves  += reserve;
        s.borrowIndex    += (s.borrowIndex * rate * elapsed) / (365 days * 1e18);
        s.lastAccruedTime = block.timestamp;

        emit InterestAccrued(asset, s.borrowIndex);
    }

    function _borrowRate(
        AssetConfig storage c,
        uint256 totalBorrowed,
        uint256 cash
    ) internal view returns (uint256) {
        if (totalBorrowed == 0) return c.baseRate;
        uint256 total = cash + totalBorrowed;
        uint256 u     = (totalBorrowed * 1e18) / total;
        if (u <= c.optimalUtilization) {
            return c.baseRate + (u * c.slope1) / c.optimalUtilization;
        }
        return c.baseRate + c.slope1
            + ((u - c.optimalUtilization) * c.slope2) / (1e18 - c.optimalUtilization);
    }

    // ─── Exchange rate (shares → asset) ──────────────────────────────────────

    /**
     * @notice 1 share = how many asset tokens (1e18 scaled).
     *         Increases over time as interest accrues.
     */
    function exchangeRate(address asset) public view returns (uint256) {
        AssetState storage s = assetStates[asset];
        if (s.totalShares == 0) return 1e18;

        // Simulate pending interest
        AssetConfig storage c = assetConfigs[asset];
        uint256 elapsed = block.timestamp - s.lastAccruedTime;
        uint256 cash    = IERC20(asset).balanceOf(address(this));
        uint256 pendingInterest = 0;
        uint256 pendingReserve  = 0;
        if (elapsed > 0 && s.totalBorrowed > 0) {
            uint256 rate = _borrowRate(c, s.totalBorrowed, cash);
            pendingInterest = (s.totalBorrowed * rate * elapsed) / (365 days * 1e18);
            pendingReserve  = (pendingInterest * c.reserveFactor) / 10000;
        }

        uint256 totalAssets = cash
            + s.totalBorrowed + pendingInterest
            - s.totalReserves - pendingReserve;

        return (totalAssets * 1e18) / s.totalShares;
    }

    function _sharesToAsset(address asset, uint256 shares) internal view returns (uint256) {
        return (shares * exchangeRate(asset)) / 1e18;
    }

    function _assetToShares(address asset, uint256 amount) internal view returns (uint256) {
        uint256 rate = exchangeRate(asset);
        return (amount * 1e18) / rate;
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
        assetStates[asset].totalShares += shares;
        userShares[msg.sender][asset]  += shares;

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
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
        if (shares > userSh) revert InsufficientBalance();

        uint256 amount = _sharesToAsset(asset, shares);
        if (IERC20(asset).balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        assetStates[asset].totalShares -= shares;
        userShares[msg.sender][asset]  -= shares;

        // Health check if user also has borrows
        if (_hasBorrow(msg.sender)) {
            if (_healthFactor(msg.sender) < 1e18) revert HealthFactorTooLow();
        }

        IERC20(asset).safeTransfer(msg.sender, amount);
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
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, asset, amount);
    }

    /**
     * @notice Withdraw collateral. Reverts if health factor would drop below 1.
     */
    function withdrawCollateral(address asset, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (userCollateral[msg.sender][asset] < amount) revert InsufficientBalance();

        userCollateral[msg.sender][asset] -= amount;

        if (_hasBorrow(msg.sender)) {
            if (_healthFactor(msg.sender) < 1e18) revert HealthFactorTooLow();
        }

        IERC20(asset).safeTransfer(msg.sender, amount);
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

        if (IERC20(asset).balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        // Update user borrow state
        UserBorrow storage ub = userBorrows[msg.sender][asset];
        AssetState  storage s  = assetStates[asset];

        uint256 currentDebt = _compoundedDebt(ub, s.borrowIndex);
        ub.principal   = currentDebt + amount;
        ub.borrowIndex = s.borrowIndex;

        s.totalBorrowed += amount;

        // Health check AFTER updating state
        if (_healthFactor(msg.sender) < 1e18) revert HealthFactorTooLow();

        IERC20(asset).safeTransfer(msg.sender, amount);
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

        UserBorrow storage ub = userBorrows[msg.sender][asset];
        AssetState  storage s  = assetStates[asset];

        uint256 currentDebt = _compoundedDebt(ub, s.borrowIndex);
        if (currentDebt == 0) revert ZeroAmount();

        // Allow repaying full debt with max uint
        if (amount > currentDebt) amount = currentDebt;

        ub.principal   = currentDebt - amount;
        ub.borrowIndex = s.borrowIndex;
        s.totalBorrowed -= amount;

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
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
    function liquidate(
        address borrower,
        address debtAsset,
        address collateralAsset,
        uint256 repayAmount
    ) external nonReentrant whenNotPaused {
        if (repayAmount == 0) revert ZeroAmount();
        if (debtAsset == collateralAsset) revert SameAsset();

        accrueInterest(debtAsset);

        if (_healthFactor(borrower) >= 1e18) revert PositionHealthy();

        AssetState  storage ds = assetStates[debtAsset];
        UserBorrow  storage ub = userBorrows[borrower][debtAsset];
        uint256 totalDebt = _compoundedDebt(ub, ds.borrowIndex);

        uint256 maxRepay = (totalDebt * CLOSE_FACTOR) / 10000;
        if (repayAmount > maxRepay) revert ExceedsCloseFactor();

        AssetConfig storage cc = assetConfigs[collateralAsset];
        if (!cc.isSupported) revert AssetNotSupported();

        // USD value of repayAmount (oracle returns 8-decimal price)
        uint256 debtPrice       = oracle.getAssetPrice(debtAsset);
        uint256 collateralPrice = oracle.getAssetPrice(collateralAsset);
        uint8   debtDec         = assetConfigs[debtAsset].decimals;

        // repayValueUSD in 8-decimal precision
        uint256 repayValueUSD = (repayAmount * debtPrice) / (10 ** debtDec);

        // seizedCollateral = repayValueUSD * (1 + bonus) / collateralPrice
        uint256 bonusFactor = 10000 + cc.liquidationBonus;
        uint256 seizedCollateral = (repayValueUSD * bonusFactor * (10 ** cc.decimals))
                                 / (collateralPrice * 10000);

        // Cap at available collateral (dedicated + supplied)
        uint256 availableCollateral = userCollateral[borrower][collateralAsset]
            + _sharesToAsset(collateralAsset, userShares[borrower][collateralAsset]);

        if (seizedCollateral > availableCollateral) {
            seizedCollateral = availableCollateral;
        }

        // Deduct from dedicated collateral first, then from supply shares
        uint256 fromDedicated = userCollateral[borrower][collateralAsset];
        if (seizedCollateral <= fromDedicated) {
            userCollateral[borrower][collateralAsset] -= seizedCollateral;
        } else {
            uint256 remainder = seizedCollateral - fromDedicated;
            userCollateral[borrower][collateralAsset] = 0;
            // Convert remainder to shares and burn
            accrueInterest(collateralAsset);
            uint256 sharesToBurn = _assetToShares(collateralAsset, remainder);
            if (sharesToBurn > userShares[borrower][collateralAsset]) {
                sharesToBurn = userShares[borrower][collateralAsset];
            }
            userShares[borrower][collateralAsset]      -= sharesToBurn;
            assetStates[collateralAsset].totalShares   -= sharesToBurn;
        }

        // Update debt
        ub.principal   = totalDebt - repayAmount;
        ub.borrowIndex = ds.borrowIndex;
        ds.totalBorrowed -= repayAmount;

        IERC20(debtAsset).safeTransferFrom(msg.sender, address(this), repayAmount);
        IERC20(collateralAsset).safeTransfer(msg.sender, seizedCollateral);

        emit Liquidated(borrower, msg.sender, collateralAsset, debtAsset, repayAmount, seizedCollateral);
    }


    // ─── View functions ───────────────────────────────────────────────────────

    /**
     * @notice Compounded borrow balance for a user on a specific asset.
     */
    function getBorrowBalance(address user, address asset) public view returns (uint256) {
        UserBorrow storage ub = userBorrows[user][asset];
        if (ub.principal == 0) return 0;
        // Simulate pending index
        AssetState  storage s = assetStates[asset];
        AssetConfig storage c = assetConfigs[asset];
        uint256 elapsed = block.timestamp - s.lastAccruedTime;
        uint256 currentIndex = s.borrowIndex;
        if (elapsed > 0 && s.totalBorrowed > 0) {
            uint256 cash = IERC20(asset).balanceOf(address(this));
            uint256 rate = _borrowRate(c, s.totalBorrowed, cash);
            currentIndex += (s.borrowIndex * rate * elapsed) / (365 days * 1e18);
        }
        return _compoundedDebt(ub, currentIndex);
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
    function getPosition(address user) external view returns (
        uint256 totalCollateralUSD,
        uint256 totalBorrowUSD,
        uint256 healthFactor
    ) {
        (totalCollateralUSD, , totalBorrowUSD) = _positionValues(user);
        healthFactor = _healthFactor(user);
    }

    /**
     * @notice Current borrow APY for an asset (1e18 scale).
     */
    function getBorrowRate(address asset) external view returns (uint256) {
        AssetState  storage s = assetStates[asset];
        AssetConfig storage c = assetConfigs[asset];
        uint256 cash = IERC20(asset).balanceOf(address(this));
        return _borrowRate(c, s.totalBorrowed, cash);
    }

    /**
     * @notice Current supply APY for an asset (1e18 scale).
     */
    function getSupplyRate(address asset) external view returns (uint256) {
        AssetState  storage s = assetStates[asset];
        AssetConfig storage c = assetConfigs[asset];
        uint256 cash = IERC20(asset).balanceOf(address(this));
        if (s.totalBorrowed == 0) return 0;
        uint256 total = cash + s.totalBorrowed;
        uint256 u     = (s.totalBorrowed * 1e18) / total;
        uint256 borrowRate = _borrowRate(c, s.totalBorrowed, cash);
        return (borrowRate * u * (10000 - c.reserveFactor)) / (1e18 * 10000);
    }

    /**
     * @notice Utilization rate for an asset (1e18 scale).
     */
    function getUtilization(address asset) external view returns (uint256) {
        AssetState storage s = assetStates[asset];
        if (s.totalBorrowed == 0) return 0;
        uint256 cash  = IERC20(asset).balanceOf(address(this));
        uint256 total = cash + s.totalBorrowed;
        return (s.totalBorrowed * 1e18) / total;
    }

    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }


    // ─── Owner: withdraw reserves ─────────────────────────────────────────────

    function withdrawReserves(address asset, uint256 amount) external onlyOwner nonReentrant {
        accrueInterest(asset);
        AssetState storage s = assetStates[asset];
        if (amount > s.totalReserves) revert InsufficientReserves();
        s.totalReserves -= amount;
        IERC20(asset).safeTransfer(msg.sender, amount);
        emit ReservesWithdrawn(asset, amount);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _compoundedDebt(UserBorrow storage ub, uint256 currentIndex)
        internal view returns (uint256)
    {
        if (ub.principal == 0 || ub.borrowIndex == 0) return 0;
        return (ub.principal * currentIndex) / ub.borrowIndex;
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
    function _positionValues(address user) internal view returns (
        uint256 collateralThresholdUSD,
        uint256 collateralLtvUSD,
        uint256 totalBorrowUSD
    ) {
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            AssetConfig storage c = assetConfigs[asset];
            uint256 price = oracle.getAssetPrice(asset);

            // Collateral: dedicated deposits + supply positions
            uint256 collAmt = userCollateral[user][asset]
                + _sharesToAsset(asset, userShares[user][asset]);

            if (collAmt > 0) {
                uint256 valueUSD = (collAmt * price) / (10 ** c.decimals);
                collateralThresholdUSD += (valueUSD * c.liquidationThreshold) / 10000;
                collateralLtvUSD       += (valueUSD * c.ltv) / 10000;
            }

            // Borrows
            uint256 debt = getBorrowBalance(user, asset);
            if (debt > 0) {
                totalBorrowUSD += (debt * price) / (10 ** c.decimals);
            }
        }
    }

    function _healthFactor(address user) internal view returns (uint256) {
        (uint256 collThreshUSD, , uint256 borrowUSD) = _positionValues(user);
        if (borrowUSD == 0) return type(uint256).max;
        return (collThreshUSD * 1e18) / borrowUSD;
    }
}
