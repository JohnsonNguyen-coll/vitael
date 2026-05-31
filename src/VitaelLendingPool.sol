// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./vUSDC.sol";
import "./VitaelOracle.sol";

/**
 * @title VitaelLendingPool
 * @notice Core lending & borrowing contract for Vitael Lending Protocol.
 */
contract VitaelLendingPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    struct CollateralConfig {
        bool isSupported;
        uint256 ltv;                  // Loan-to-Value in basis points (e.g. 7500 = 75%)
        uint256 liquidationThreshold; // Liquidation threshold in basis points (e.g. 8000 = 80%)
        uint256 liquidationBonus;     // Liquidation bonus in basis points (e.g. 500 = 5% bonus)
        uint256 decimals;             // Token decimals
    }

    // Underlying USDC (6 decimals)
    IERC20 public immutable usdc;
    // Interest bearing vUSDC (6 decimals)
    vUSDC public immutable vUsdc;
    // Price Oracle
    VitaelOracle public immutable oracle;

    // Collateral token address => Config
    mapping(address => CollateralConfig) public collateralConfigs;
    address[] public supportedCollaterals;

    // User Collateral: User => Collateral Token => Amount
    mapping(address => mapping(address => uint256)) public userCollateral;

    // Cumulative parameters
    uint256 public totalBorrowedUSDC; // Compounded total USDC borrowed
    uint256 public totalReservesUSDC; // Accumulated protocol reserves

    uint256 public borrowIndex;       // Cumulative borrow index (scaled 1e18)
    uint256 public lastAccruedTime;   // Last timestamp interest was accrued

    // Compounded borrow state: User => Borrowed Principal
    mapping(address => uint256) public userBorrowedPrincipal;
    // User Borrow Index: User => Cumulative borrow index at last borrow/repay/update
    mapping(address => uint256) public userBorrowIndex;

    // Constant parameters (in 18 decimals / bps)
    uint256 public constant BASE_RATE = 2 * 1e16;           // 2% base interest rate (1e18 scale)
    uint256 public constant OPTIMAL_UTILIZATION = 8 * 1e17;  // 80% optimal utilization (1e18 scale)
    uint256 public constant SLOPE_1 = 4 * 1e16;              // 4% slope 1 (1e18 scale)
    uint256 public constant SLOPE_2 = 75 * 1e16;            // 75% slope 2 (1e18 scale)
    uint256 public constant RESERVE_FACTOR = 1000;          // 10% reserve factor in basis points (10000 bps = 100%)
    uint256 public constant CLOSE_FACTOR = 5000;            // 50% max liquidation close factor (10000 bps = 100%)

    // Events
    event Supplied(address indexed user, uint256 amount, uint256 vAmount);
    event Withdrawn(address indexed user, uint256 amount, uint256 vAmount);
    event CollateralDeposited(address indexed user, address indexed token, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(
        address indexed borrower,
        address indexed liquidator,
        uint256 repaidAmount,
        address collateralToken,
        uint256 seizedCollateral
    );
    event InterestAccrued(uint256 timeElapsed, uint256 borrowRate, uint256 borrowIndex);
    event ReservesWithdrawn(address indexed owner, uint256 amount);

    // Custom Errors
    error ZeroAmount();
    error CollateralNotSupported();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error HealthFactorTooLow();
    error PositionHealthy();
    error RepayAmountExceedsDebt();
    error LiquidationAmountExceedsCloseFactor();
    error InsufficientReserves();

    constructor(
        address _usdc,
        address _vUsdc,
        address _oracle
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        vUsdc = vUSDC(_vUsdc);
        oracle = VitaelOracle(_oracle);

        borrowIndex = 1e18;
        lastAccruedTime = block.timestamp;
    }

    /**
     * @notice Add support for a collateral token.
     */
    function addCollateral(
        address token,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus,
        uint256 decimals
    ) external onlyOwner {
        if (!collateralConfigs[token].isSupported) {
            supportedCollaterals.push(token);
        }
        collateralConfigs[token] = CollateralConfig({
            isSupported: true,
            ltv: ltv,
            liquidationThreshold: liquidationThreshold,
            liquidationBonus: liquidationBonus,
            decimals: decimals
        });
    }

    /**
     * @notice Accrues interest on borrowed and supplied USDC based on utilization rate.
     */
    function accrueInterest() public {
        uint256 timeElapsed = block.timestamp - lastAccruedTime;
        if (timeElapsed == 0) return;

        if (totalBorrowedUSDC == 0) {
            lastAccruedTime = block.timestamp;
            return;
        }

        uint256 cash = usdc.balanceOf(address(this));
        uint256 totalSupply = cash + totalBorrowedUSDC;

        uint256 u = (totalBorrowedUSDC * 1e18) / totalSupply;
        uint256 borrowRate;

        if (u < OPTIMAL_UTILIZATION) {
            borrowRate = BASE_RATE + (u * SLOPE_1) / OPTIMAL_UTILIZATION;
        } else {
            borrowRate = BASE_RATE + SLOPE_1 + ((u - OPTIMAL_UTILIZATION) * SLOPE_2) / (1e18 - OPTIMAL_UTILIZATION);
        }

        uint256 interestPaid = (totalBorrowedUSDC * borrowRate * timeElapsed) / (365 days * 1e18);
        uint256 reserveShare = (interestPaid * RESERVE_FACTOR) / 10000;

        totalBorrowedUSDC += interestPaid;
        totalReservesUSDC += reserveShare;

        borrowIndex = borrowIndex + (borrowIndex * borrowRate * timeElapsed) / (365 days * 1e18);
        lastAccruedTime = block.timestamp;

        emit InterestAccrued(timeElapsed, borrowRate, borrowIndex);
    }

    /**
     * @notice Predicts the borrow index and total borrows dynamically for view functions.
     */
    function getLatestState() public view returns (uint256 currentBorrowIndex, uint256 currentTotalBorrowed) {
        uint256 timeElapsed = block.timestamp - lastAccruedTime;
        if (timeElapsed == 0 || totalBorrowedUSDC == 0) {
            return (borrowIndex, totalBorrowedUSDC);
        }
        uint256 cash = usdc.balanceOf(address(this));
        uint256 totalSupply = cash + totalBorrowedUSDC;

        uint256 u = (totalBorrowedUSDC * 1e18) / totalSupply;
        uint256 borrowRate;

        if (u < OPTIMAL_UTILIZATION) {
            borrowRate = BASE_RATE + (u * SLOPE_1) / OPTIMAL_UTILIZATION;
        } else {
            borrowRate = BASE_RATE + SLOPE_1 + ((u - OPTIMAL_UTILIZATION) * SLOPE_2) / (1e18 - OPTIMAL_UTILIZATION);
        }

        uint256 interestPaid = (totalBorrowedUSDC * borrowRate * timeElapsed) / (365 days * 1e18);
        uint256 nextTotalBorrowed = totalBorrowedUSDC + interestPaid;
        uint256 nextBorrowIndex = borrowIndex + (borrowIndex * borrowRate * timeElapsed) / (365 days * 1e18);
        return (nextBorrowIndex, nextTotalBorrowed);
    }

    /**
     * @notice Get current exchange rate of vUSDC to USDC.
     */
    function getExchangeRate() public view returns (uint256) {
        uint256 vUsdcSupply = vUsdc.totalSupply();
        if (vUsdcSupply == 0) return 1e18; // 1:1 initial exchange rate (scaled to 1e18)

        (, uint256 currentTotalBorrowed) = getLatestState();

        uint256 timeElapsed = block.timestamp - lastAccruedTime;
        uint256 pendingReserves = 0;
        if (timeElapsed > 0 && totalBorrowedUSDC > 0) {
            uint256 cash = usdc.balanceOf(address(this));
            uint256 totalSupply = cash + totalBorrowedUSDC;
            uint256 u = (totalBorrowedUSDC * 1e18) / totalSupply;
            uint256 borrowRate;
            if (u < OPTIMAL_UTILIZATION) {
                borrowRate = BASE_RATE + (u * SLOPE_1) / OPTIMAL_UTILIZATION;
            } else {
                borrowRate = BASE_RATE + SLOPE_1 + ((u - OPTIMAL_UTILIZATION) * SLOPE_2) / (1e18 - OPTIMAL_UTILIZATION);
            }
            uint256 interestPaid = (totalBorrowedUSDC * borrowRate * timeElapsed) / (365 days * 1e18);
            pendingReserves = (interestPaid * RESERVE_FACTOR) / 10000;
        }

        uint256 currentReserves = totalReservesUSDC + pendingReserves;
        uint256 cashBalance = usdc.balanceOf(address(this));
        uint256 totalSupplied = cashBalance + currentTotalBorrowed - currentReserves;

        return (totalSupplied * 1e18) / vUsdcSupply;
    }

    /**
     * @notice Supply USDC to earn interest and receive vUSDC.
     */
    function supply(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        accrueInterest();

        uint256 rate = getExchangeRate();
        uint256 vAmount = (amount * 1e18) / rate;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        vUsdc.mint(msg.sender, vAmount);

        emit Supplied(msg.sender, amount, vAmount);
    }

    /**
     * @notice Withdraw supplied USDC by burning vUSDC.
     */
    function withdraw(uint256 vAmount) external nonReentrant whenNotPaused {
        if (vAmount == 0) revert ZeroAmount();
        accrueInterest();

        uint256 rate = getExchangeRate();
        uint256 amount = (vAmount * rate) / 1e18;

        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        vUsdc.burn(msg.sender, vAmount);

        // Verify that the user still has a safe position if they have active loans
        if (userBorrowedPrincipal[msg.sender] > 0) {
            if (getHealthFactor(msg.sender) < 1e18) revert HealthFactorTooLow();
        }

        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount, vAmount);
    }

    /**
     * @notice Deposit collateral (e.g. WETH, WBTC) to borrow USDC against.
     */
    function depositCollateral(address token, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (!collateralConfigs[token].isSupported) revert CollateralNotSupported();

        userCollateral[msg.sender][token] += amount;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw deposited collateral.
     */
    function withdrawCollateral(address token, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (userCollateral[msg.sender][token] < amount) revert InsufficientCollateral();

        userCollateral[msg.sender][token] -= amount;

        // Verify safety of remaining position
        if (userBorrowedPrincipal[msg.sender] > 0) {
            if (getHealthFactor(msg.sender) < 1e18) revert HealthFactorTooLow();
        }

        IERC20(token).safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, token, amount);
    }

    /**
     * @notice Borrow USDC.
     */
    function borrow(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        accrueInterest();

        if (usdc.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        uint256 currentDebt = getCompoundedBorrowBalance(msg.sender);
        uint256 newPrincipal = currentDebt + amount;

        userBorrowedPrincipal[msg.sender] = newPrincipal;
        userBorrowIndex[msg.sender] = borrowIndex;

        totalBorrowedUSDC += amount;

        // Verify position health
        if (getHealthFactor(msg.sender) < 1e18) revert HealthFactorTooLow();

        usdc.safeTransfer(msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    /**
     * @notice Repay borrowed USDC.
     */
    function repay(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        accrueInterest();

        uint256 currentDebt = getCompoundedBorrowBalance(msg.sender);
        if (amount > currentDebt) revert RepayAmountExceedsDebt();

        uint256 newPrincipal = currentDebt - amount;

        userBorrowedPrincipal[msg.sender] = newPrincipal;
        userBorrowIndex[msg.sender] = borrowIndex;

        totalBorrowedUSDC -= amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit Repaid(msg.sender, amount);
    }

    /**
     * @notice Liquidate a position with Health Factor < 1.
     */
    function liquidate(
        address borrower,
        address collateralToken,
        uint256 repayAmount
    ) external nonReentrant whenNotPaused {
        if (repayAmount == 0) revert ZeroAmount();
        accrueInterest();

        uint256 healthFactor = getHealthFactor(borrower);
        if (healthFactor >= 1e18) revert PositionHealthy();

        uint256 totalDebt = getCompoundedBorrowBalance(borrower);
        uint256 maxRepay = (totalDebt * CLOSE_FACTOR) / 10000;
        if (repayAmount > maxRepay) revert LiquidationAmountExceedsCloseFactor();

        CollateralConfig memory config = collateralConfigs[collateralToken];
        if (!config.isSupported) revert CollateralNotSupported();

        // Calculate USD value of repayAmount (repayAmount is USDC with 6 decimals)
        // Oracle price is in 8 decimals (USDC price usually $1 = 1e8)
        uint256 usdcPrice = oracle.getAssetPrice(address(usdc));
        uint256 repayValueUSD = (repayAmount * usdcPrice) / 1e6; // Scale down 6 decimals (USD value has 8 decimals)

        // Seize amount = (repayValueUSD * (1 + liquidationBonus)) / collateralPrice
        uint256 collateralPrice = oracle.getAssetPrice(collateralToken);
        uint256 bonusFactor = 10000 + config.liquidationBonus; // e.g. 10500 for 5% bonus

        // Tính seized amount với đúng decimals
        uint256 seizedCollateral = (repayValueUSD * bonusFactor * (10 ** config.decimals)) 
                                 / (collateralPrice * 10000);

        if (seizedCollateral > userCollateral[borrower][collateralToken]) {
            seizedCollateral = userCollateral[borrower][collateralToken];
        }

        userCollateral[borrower][collateralToken] -= seizedCollateral;
        
        // Cập nhật lại nợ sau khi bị thanh lý
        uint256 newPrincipal = totalDebt - repayAmount;
        userBorrowedPrincipal[borrower] = newPrincipal;
        userBorrowIndex[borrower] = borrowIndex;

        totalBorrowedUSDC -= repayAmount;

        // Transfers
        usdc.safeTransferFrom(msg.sender, address(this), repayAmount);
        IERC20(collateralToken).safeTransfer(msg.sender, seizedCollateral);

        emit Liquidated(borrower, msg.sender, repayAmount, collateralToken, seizedCollateral);
    }

    /**
     * @notice Returns the compounded borrow balance of a user (including pending interest).
     */
    function getCompoundedBorrowBalance(address user) public view returns (uint256) {
        uint256 principal = userBorrowedPrincipal[user];
        if (principal == 0) return 0;
        (uint256 currentBorrowIndex, ) = getLatestState();
        return (principal * currentBorrowIndex) / userBorrowIndex[user];
    }

    /**
     * @notice Computes safety metric. HF >= 1e18 is healthy.
     */
    function getHealthFactor(address user) public view returns (uint256) {
        uint256 borrowBalanceUSD = 0;
        uint256 collateralThresholdValueUSD = 0;

        // 1. Calculate borrow balance in USD (8 decimals)
        uint256 borrowBalance = getCompoundedBorrowBalance(user);
        if (borrowBalance == 0) return type(uint256).max; // Infinite HF for no borrows

        uint256 usdcPrice = oracle.getAssetPrice(address(usdc));
        borrowBalanceUSD = (borrowBalance * usdcPrice) / 1e6;

        // 2. Sum collateral threshold value in USD (8 decimals)
        for (uint256 i = 0; i < supportedCollaterals.length; i++) {
            address token = supportedCollaterals[i];
            uint256 amount = userCollateral[user][token];
            if (amount > 0) {
                CollateralConfig memory config = collateralConfigs[token];
                uint256 price = oracle.getAssetPrice(token);
                uint256 collateralValueUSD = (amount * price) / (10 ** config.decimals);
                collateralThresholdValueUSD += (collateralValueUSD * config.liquidationThreshold) / 10000;
            }
        }

        return (collateralThresholdValueUSD * 1e18) / borrowBalanceUSD;
    }

    /**
     * @notice Allows owner to withdraw protocol reserves.
     */
    function withdrawReserves(uint256 amount) external onlyOwner nonReentrant {
        accrueInterest();
        if (amount > totalReservesUSDC) revert InsufficientReserves();
        totalReservesUSDC -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit ReservesWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Pauses contract activity (emergency stop).
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses contract activity.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
