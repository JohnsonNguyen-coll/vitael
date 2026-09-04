// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MockERC20.sol";
import "../src/MockV3Aggregator.sol";
import "../src/VitaelOracle.sol";
import "../src/VitaelLendingPool.sol";
import "../src/vaults/VitaelUSDCVault.sol";

contract VaultHandler is Test {
    MockERC20 public immutable usdc;
    VitaelUSDCVault public immutable vault;

    constructor(MockERC20 usdc_, VitaelUSDCVault vault_) {
        usdc = usdc_;
        vault = vault_;
        usdc.mint(address(this), 1_000_000e6);
        usdc.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        uint256 max = vault.maxDeposit(address(this));
        if (max == 0) return;
        uint256 available = max < usdc.balanceOf(address(this)) ? max : usdc.balanceOf(address(this));
        if (available < vault.MIN_DEPOSIT()) return;
        amount = bound(amount, vault.MIN_DEPOSIT(), available);
        vault.deposit(amount, address(this));
    }

    function redeem(uint256 shares) external {
        uint256 max = vault.maxRedeem(address(this));
        if (max == 0) return;
        vault.redeem(bound(shares, 1, max), address(this), address(this));
    }
}

contract VitaelUSDCVaultTest is Test {
    MockERC20 internal usdc;
    MockERC20 internal eurc;
    VitaelLendingPool internal pool;
    VitaelUSDCVault internal vault;

    address internal alice = address(0xA11CE);
    address internal borrower = address(0xB0B);

    function setUp() public virtual {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        eurc = new MockERC20("Euro Coin", "EURC", 6);

        VitaelOracle oracle = new VitaelOracle();
        oracle.addPriceFeed(address(usdc), address(new MockV3Aggregator(8, 1e8)));
        oracle.addPriceFeed(address(eurc), address(new MockV3Aggregator(8, 1e8)));

        pool = new VitaelLendingPool(address(oracle));
        pool.addAsset(address(usdc), 6, 9000, 9200, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        pool.addAsset(address(eurc), 6, 8500, 8800, 500, 2e16, 8e17, 4e16, 75e16, 1000);

        vault = new VitaelUSDCVault(IERC20(address(usdc)), pool, 10_000e6);
        usdc.mint(alice, 20_000e6);
        eurc.mint(borrower, 20_000e6);

        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(borrower);
        eurc.approve(address(pool), type(uint256).max);
    }

    function testDepositInvestsAndMintsShares() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1_000e6, alice);

        assertEq(shares, 1_000e9);
        assertEq(vault.balanceOf(alice), shares);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(pool.getSupplyBalance(address(vault), address(usdc)), 1_000e6);
        assertEq(vault.totalAssets(), 1_000e6);
    }

    function testInterestRaisesShareValue() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);

        vm.startPrank(borrower);
        pool.depositCollateral(address(eurc), 2_000e6);
        pool.borrow(address(usdc), 500e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        assertGt(vault.totalAssets(), 1_000e6);
        assertGt(vault.convertToAssets(vault.balanceOf(alice)), 1_000e6);
    }

    function testWithdrawPullsFromLending() public {
        vm.startPrank(alice);
        vault.deposit(1_000e6, alice);
        vault.withdraw(400e6, alice, alice);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 19_400e6);
        assertApproxEqAbs(vault.totalAssets(), 600e6, 1);
    }

    function testDepositCapAndShutdown() public {
        vault.setDepositCap(500e6);
        vm.prank(alice);
        vault.deposit(500e6, alice);
        assertEq(vault.maxDeposit(alice), 0);

        vault.setShutdown(true);
        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(1e6, alice);

        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice);
        assertEq(vault.balanceOf(alice), 0);
    }

    function testEmergencyWithdrawalKeepsUserAccounting() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);
        uint256 sharesBefore = vault.balanceOf(alice);

        vault.emergencyWithdraw(pool.userShares(address(vault), address(usdc)));

        assertTrue(vault.shutdown());
        assertEq(vault.balanceOf(alice), sharesBefore);
        assertEq(pool.userShares(address(vault), address(usdc)), 0);
        assertApproxEqAbs(usdc.balanceOf(address(vault)), 1_000e6, 1);
    }

    function testFuzzDepositThenRedeem(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), vault.MIN_DEPOSIT(), 10_000e6);
        vm.startPrank(alice);
        uint256 shares = vault.deposit(amount, alice);
        uint256 assets = vault.redeem(shares, alice, alice);
        vm.stopPrank();

        assertApproxEqAbs(assets, amount, 1);
        assertEq(vault.balanceOf(alice), 0);
    }
}

contract VitaelUSDCVaultInvariantTest is VitaelUSDCVaultTest {
    VaultHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new VaultHandler(usdc, vault);
        targetContract(address(handler));
    }

    function invariantAssetsEqualIdlePlusStrategy() public view {
        uint256 expected = usdc.balanceOf(address(vault)) + pool.getSupplyBalance(address(vault), address(usdc));
        assertEq(vault.totalAssets(), expected);
    }

    function invariantSharesCannotClaimMoreThanAssets() public view {
        assertLe(vault.previewRedeem(vault.totalSupply()), vault.totalAssets());
    }

    function invariantDepositCapIsRespected() public view {
        assertLe(vault.totalAssets(), vault.depositCap());
    }
}
