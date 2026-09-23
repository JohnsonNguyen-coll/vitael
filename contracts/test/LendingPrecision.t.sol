// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VitaelLendingPool.t.sol";

contract TaxedToken is MockERC20 {
    constructor() MockERC20("Taxed", "TAX", 6) {}

    function _update(address from, address to, uint256 amount) internal override {
        uint256 fee = from != address(0) && to != address(0) ? amount / 100 : 0;
        if (fee > 0) super._update(from, address(0), fee);
        super._update(from, to, amount - fee);
    }
}

contract LendingPrecisionTest is VitaelLendingPoolTest {
    function testDonationBeforeFirstSupplyCannotBeClaimed() public {
        vm.prank(alice);
        assertTrue(usdc.transfer(address(pool), 100e6));
        vm.startPrank(bob);
        pool.supply(address(usdc), 100e6);
        pool.withdraw(address(usdc), type(uint256).max);
        vm.stopPrank();
        assertEq(usdc.balanceOf(bob), 10000e6);
        assertEq(pool.getAvailableLiquidity(address(usdc)), 0);
        assertEq(pool.getUnaccountedBalance(address(usdc)), 100e6);
    }

    function testDonationDoesNotChangeRatesOrPendingDebt() public {
        _openBtcLoan();
        vm.warp(block.timestamp + 30 days);
        uint256 debt = pool.getBorrowBalance(bob, address(usdc));
        uint256 rate = pool.getBorrowRate(address(usdc));
        uint256 supply = pool.getSupplyBalance(alice, address(usdc));
        vm.prank(alice);
        assertTrue(usdc.transfer(address(pool), 1000e6));
        assertEq(pool.getBorrowBalance(bob, address(usdc)), debt);
        assertEq(pool.getBorrowRate(address(usdc)), rate);
        assertEq(pool.getSupplyBalance(alice, address(usdc)), supply);
    }

    function testShortfallIsReportedWithoutWritingOffDebt() public {
        _openBtcLoan();
        btcFeed.updatePrice(1000e8);
        (uint256 quoted, uint256 collateral,) = pool.quoteLiquidation(bob, address(usdc), address(cirBtc), 1000e6);
        uint256 beforeBalance = usdc.balanceOf(liquidator);
        vm.prank(liquidator);
        pool.liquidate(bob, address(usdc), address(cirBtc), 1000e6);
        assertEq(beforeBalance - usdc.balanceOf(liquidator), quoted);
        assertEq(pool.userCollateral(bob, address(cirBtc)), 1e7 - collateral);
        assertEq(pool.getBorrowBalance(bob, address(usdc)), 4000e6 - quoted);
        (uint256 collateralUSD, uint256 debtUSD, uint256 shortfallUSD) = pool.getAccountShortfall(bob);
        assertEq(shortfallUSD, debtUSD - collateralUSD);
        assertGt(shortfallUSD, 3900e8);
    }

    function testLiquidationBurnsSupplySharesUpward() public {
        vm.prank(alice);
        pool.supply(address(usdc), 1000e6);
        eurc.mint(alice, 10000e6);
        vm.startPrank(alice);
        eurc.approve(address(pool), type(uint256).max);
        pool.supply(address(eurc), 10000e6);
        vm.stopPrank();
        vm.startPrank(bob);
        pool.supply(address(usdc), 1000e6);
        pool.borrow(address(eurc), 800e6);
        vm.stopPrank();
        address other = address(0x987);
        eurc.mint(other, 1000e6);
        vm.startPrank(other);
        eurc.approve(address(pool), type(uint256).max);
        pool.depositCollateral(address(eurc), 1000e6);
        pool.borrow(address(usdc), 500e6);
        vm.stopPrank();
        vm.warp(block.timestamp + 365 days);
        usdcFeed.updatePrice(5e7);
        eurcFeed.updatePrice(108000000);
        eurc.mint(liquidator, 100e6);
        uint256 aliceBefore = pool.getSupplyBalance(alice, address(usdc));
        uint256 sharesBefore = pool.userShares(bob, address(usdc));
        (, uint256 seized, uint256 shares) = pool.quoteLiquidation(bob, address(eurc), address(usdc), 1);
        assertEq(shares, pool.previewWithdraw(address(usdc), seized));
        assertGt(shares, pool.previewSupply(address(usdc), seized));
        vm.prank(liquidator);
        pool.liquidate(bob, address(eurc), address(usdc), 1);
        assertEq(pool.userShares(bob, address(usdc)), sharesBefore - shares);
        assertGe(pool.getSupplyBalance(alice, address(usdc)), aliceBefore);
    }

    function testSubUsdUnitDebtStillRequiresCollateral() public {
        MockERC20 tiny = new MockERC20("Tiny", "TINY", 18);
        oracle.addPriceFeed(address(tiny), address(new MockV3Aggregator(8, 1e8)), 1 hours);
        pool.addAsset(address(tiny), 18, 7000, 7500, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        tiny.mint(alice, 1e18);
        vm.startPrank(alice);
        tiny.approve(address(pool), type(uint256).max);
        pool.supply(address(tiny), 1e18);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(VitaelLendingPool.HealthFactorTooLow.selector);
        pool.borrow(address(tiny), 1);
    }

    function testFeeOnTransferDepositRollsBack() public {
        TaxedToken taxed = new TaxedToken();
        pool.addAsset(address(taxed), 6, 7000, 7500, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        taxed.mint(alice, 100e6);
        vm.startPrank(alice);
        taxed.approve(address(pool), type(uint256).max);
        vm.expectRevert(VitaelLendingPool.UnsupportedTransfer.selector);
        pool.supply(address(taxed), 100e6);
        vm.expectRevert(VitaelLendingPool.UnsupportedTransfer.selector);
        pool.depositCollateral(address(taxed), 100e6);
        vm.stopPrank();
        assertEq(taxed.balanceOf(alice), 100e6);
        assertEq(pool.accountedCash(address(taxed)), 0);
        assertEq(pool.totalCollateral(address(taxed)), 0);
    }

    function testAssetUpdateAccruesOldRateAndRejectsInvalidConfig() public {
        _openBtcLoan();
        vm.warp(block.timestamp + 30 days);
        uint256 debt = pool.getBorrowBalance(bob, address(usdc));
        pool.addAsset(address(usdc), 6, 9000, 9200, 500, 0, 8e17, 0, 0, 1000);
        assertEq(pool.getBorrowBalance(bob, address(usdc)), debt);
        vm.expectRevert(VitaelLendingPool.InvalidAssetConfiguration.selector);
        pool.addAsset(address(usdc), 6, 9500, 9200, 500, 0, 8e17, 0, 0, 1000);
        vm.expectRevert(VitaelLendingPool.InvalidAssetConfiguration.selector);
        pool.addAsset(address(usdc), 18, 9000, 9200, 500, 0, 8e17, 0, 0, 1000);
    }

    function testDonationCannotDiluteNextSupplier() public {
        vm.startPrank(alice);
        pool.supply(address(usdc), 1);
        assertTrue(usdc.transfer(address(pool), 100e6));
        vm.stopPrank();
        vm.prank(bob);
        pool.supply(address(usdc), 100e6);
        assertGt(pool.userShares(bob, address(usdc)), 0);
        assertEq(pool.getSupplyBalance(bob, address(usdc)), 100e6);
    }

    function testDonationDoesNotIncreaseBorrowingCollateral() public {
        vm.startPrank(alice);
        pool.supply(address(usdc), 1000e6);
        assertTrue(usdc.transfer(address(pool), 1000e6));
        vm.stopPrank();
        assertEq(pool.getSupplyBalance(alice, address(usdc)), 1000e6);
    }

    function testAllBorrowersCanRepayWithoutPhantomDebt() public {
        vm.prank(alice);
        pool.supply(address(usdc), 1000e6);
        for (uint160 i = 1; i <= 3; i++) {
            address user = address(0x1000 + i);
            eurc.mint(user, 1e6);
            usdc.mint(user, 100);
            vm.startPrank(user);
            eurc.approve(address(pool), type(uint256).max);
            usdc.approve(address(pool), type(uint256).max);
            pool.depositCollateral(address(eurc), 1e6);
            pool.borrow(address(usdc), 19);
            vm.stopPrank();
        }
        vm.warp(block.timestamp + 365 days);
        for (uint160 i = 1; i <= 3; i++) {
            vm.prank(address(0x1000 + i));
            pool.repay(address(usdc), type(uint256).max);
        }
        (uint256 debt,,,,) = pool.assetStates(address(usdc));
        assertEq(debt, 0);
    }

    function testSupplyRejectsZeroSharesAfterInterest() public {
        vm.prank(alice);
        pool.supply(address(usdc), 2);
        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 1000e6);
        pool.borrow(address(usdc), 2);
        vm.stopPrank();
        vm.warp(block.timestamp + 365 days);
        vm.prank(alice);
        vm.expectRevert();
        pool.supply(address(usdc), 1);
    }

    function testLiquidatorOnlyPaysForAvailableCollateral() public {
        _openBtcLoan();
        btcFeed.updatePrice(1000e8);
        uint256 beforeBalance = usdc.balanceOf(liquidator);
        vm.prank(liquidator);
        pool.liquidate(bob, address(usdc), address(cirBtc), 1000e6);
        uint256 paid = beforeBalance - usdc.balanceOf(liquidator);
        assertLe(paid, 100e6); // All collateral is worth only $100, before bonus.
        assertGt(paid, 0);
    }

    function testLiquidationWithNoSelectedCollateralReverts() public {
        _openBtcLoan();
        btcFeed.updatePrice(1000e8);
        vm.prank(liquidator);
        vm.expectRevert();
        pool.liquidate(bob, address(usdc), address(eurc), 1000e6);
    }

    function testSameAssetLoanCanBeLiquidatedAfterInterest() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(usdc), 1000e6);
        pool.borrow(address(usdc), 900e6);
        vm.stopPrank();
        vm.warp(block.timestamp + 365 days);
        usdcFeed.updatePrice(1e8);
        assertLt(pool.getHealthFactor(bob), 1e18);
        vm.prank(liquidator);
        pool.liquidate(bob, address(usdc), address(usdc), 1e6);
    }

    function _openBtcLoan() internal {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(cirBtc), 1e7);
        pool.borrow(address(usdc), 4000e6);
        vm.stopPrank();
    }
}
