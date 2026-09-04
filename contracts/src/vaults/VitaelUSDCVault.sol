// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../VitaelLendingPool.sol";

/**
 * @title VitaelUSDCVault
 * @notice ERC-4626 USDC vault that earns the Vitael lending supply rate.
 * @dev Lending interest compounds into the pool exchange rate. The vault keeps
 *      any withdrawal surplus idle and includes both idle and invested USDC in
 *      its accounting.
 */
contract VitaelUSDCVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    VitaelLendingPool public immutable lendingPool;

    uint256 public depositCap;
    bool public shutdown;

    uint256 public constant MIN_DEPOSIT = 1e6;

    event DepositCapUpdated(uint256 oldCap, uint256 newCap);
    event ShutdownUpdated(bool shutdown);
    event EmergencyWithdrawal(uint256 poolShares, uint256 assetsRecovered);

    error VaultShutdown();
    error InvalidAddress();
    error AssetNotSupported();
    error InsufficientStrategyLiquidity();
    error DepositTooSmall();

    constructor(IERC20 asset_, VitaelLendingPool lendingPool_, uint256 depositCap_)
        ERC20("Vitael USDC Earn Vault", "vUSDC-EARN")
        ERC4626(asset_)
        Ownable(msg.sender)
    {
        if (address(asset_) == address(0) || address(lendingPool_) == address(0)) revert InvalidAddress();
        (bool supported,,,,,,,,,) = lendingPool_.assetConfigs(address(asset_));
        if (!supported) revert AssetNotSupported();

        lendingPool = lendingPool_;
        depositCap = depositCap_;
        IERC20(asset_).forceApprove(address(lendingPool_), type(uint256).max);
    }

    /** @notice Idle USDC plus the vault's interest-bearing lending position. */
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + lendingPool.getSupplyBalance(address(this), asset());
    }

    function maxDeposit(address) public view override returns (uint256) {
        if (shutdown || totalAssets() >= depositCap) return 0;
        return depositCap - totalAssets();
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return previewDeposit(maxDeposit(receiver));
    }

    /** @notice Assets that can currently be paid without exceeding pool cash. */
    function availableLiquidity() public view returns (uint256) {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        uint256 poolShares = lendingPool.userShares(address(this), asset());
        if (poolShares == 0) return idle;

        uint256 rate = lendingPool.exchangeRate(asset());
        uint256 poolCash = IERC20(asset()).balanceOf(address(lendingPool));
        uint256 liquidShares = (poolCash * 1e18) / rate;
        if (liquidShares > poolShares) liquidShares = poolShares;
        return idle + (liquidShares * rate) / 1e18;
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 claim = previewRedeem(balanceOf(owner));
        uint256 liquid = availableLiquidity();
        return claim < liquid ? claim : liquid;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 liquidShares = convertToShares(availableLiquidity());
        uint256 owned = balanceOf(owner);
        return owned < liquidShares ? owned : liquidShares;
    }

    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        if (assets < MIN_DEPOSIT) revert DepositTooSmall();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        if (previewMint(shares) < MIN_DEPOSIT) revert DepositTooSmall();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        return super.redeem(shares, receiver, owner);
    }

    function setDepositCap(uint256 newCap) external onlyOwner {
        uint256 oldCap = depositCap;
        depositCap = newCap;
        emit DepositCapUpdated(oldCap, newCap);
    }

    /** @notice Stops new deposits while keeping withdrawals available. */
    function setShutdown(bool value) external onlyOwner {
        shutdown = value;
        emit ShutdownUpdated(value);
    }

    /**
     * @notice Pull lending shares back to idle USDC during an incident.
     * @dev `poolShares` permits partial exits when borrowers consume pool cash.
     */
    function emergencyWithdraw(uint256 poolShares) external onlyOwner nonReentrant {
        shutdown = true;
        uint256 beforeBalance = IERC20(asset()).balanceOf(address(this));
        lendingPool.withdraw(asset(), poolShares);
        uint256 recovered = IERC20(asset()).balanceOf(address(this)) - beforeBalance;
        emit ShutdownUpdated(true);
        emit EmergencyWithdrawal(poolShares, recovered);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        if (shutdown) revert VaultShutdown();
        super._deposit(caller, receiver, assets, shares);
        lendingPool.supply(asset(), assets);
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
    {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < assets) _pullFromLending(assets - idle);
        if (IERC20(asset()).balanceOf(address(this)) < assets) revert InsufficientStrategyLiquidity();
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function _pullFromLending(uint256 assetsNeeded) internal {
        uint256 rate = lendingPool.exchangeRate(asset());
        uint256 shares = (assetsNeeded * 1e18 + rate - 1) / rate;
        uint256 ownedShares = lendingPool.userShares(address(this), asset());
        if (shares > ownedShares) shares = ownedShares;
        lendingPool.withdraw(asset(), shares);
    }

    /** @dev Extra share precision strengthens ERC-4626 virtual-share inflation protection. */
    function _decimalsOffset() internal pure override returns (uint8) {
        return 3;
    }
}
