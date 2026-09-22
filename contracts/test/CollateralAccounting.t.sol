// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VitaelLendingPool.t.sol";

contract CollateralAccountingTest is VitaelLendingPoolTest {
    function testSupplierCannotUseCollateralWhenLoanConsumesCash() public {
        vm.prank(alice);
        pool.supply(address(usdc), 1000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(usdc), 1000e6);
        pool.depositCollateral(address(eurc), 2000e6);
        pool.borrow(address(usdc), 1000e6);
        vm.stopPrank();
        uint256 shares = pool.userShares(alice, address(usdc));
        vm.prank(alice);
        vm.expectRevert(VitaelLendingPool.InsufficientLiquidity.selector);
        pool.withdraw(address(usdc), shares);
        assertEq(pool.totalCollateral(address(usdc)), 1000e6);
    }

    function testReservesCannotUseCollateralWhenLoanConsumesCash() public {
        vm.prank(alice);
        pool.supply(address(usdc), 1000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(usdc), 1000e6);
        pool.depositCollateral(address(eurc), 10000e6);
        pool.borrow(address(usdc), 1000e6);
        vm.stopPrank();
        vm.warp(block.timestamp + 30 days);
        pool.accrueInterest(address(usdc));
        (, uint256 reserves,,,) = pool.assetStates(address(usdc));
        assertGt(reserves, 0);
        vm.expectRevert(VitaelLendingPool.InsufficientLiquidity.selector);
        pool.withdrawReserves(address(usdc), reserves);
        assertEq(usdc.balanceOf(address(pool)), 1000e6);
    }

    function testDedicatedLiquidationPreservesUnrelatedSupplierClaim() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        cirBtc.mint(alice, 1e7);
        vm.startPrank(alice);
        cirBtc.approve(address(pool), type(uint256).max);
        pool.supply(address(cirBtc), 1e7);
        vm.stopPrank();
        vm.startPrank(bob);
        pool.depositCollateral(address(cirBtc), 1e7);
        pool.borrow(address(usdc), 4000e6);
        vm.stopPrank();
        btcFeed.updatePrice(40000_00000000);
        vm.prank(liquidator);
        pool.liquidate(bob, address(usdc), address(cirBtc), 1000e6);
        assertEq(pool.totalCollateral(address(cirBtc)), 7250000);
        assertEq(pool.userCollateral(bob, address(cirBtc)), 7250000);
        assertEq(pool.getSupplyBalance(alice, address(cirBtc)), 1e7);
        assertEq(pool.getAvailableLiquidity(address(cirBtc)), 1e7);
    }

    function testLiquidationUpdatesCustodyWithoutChangingOtherSupply() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.startPrank(bob);
        pool.supply(address(cirBtc), 5e6);
        pool.depositCollateral(address(cirBtc), 5e6);
        pool.borrow(address(usdc), 4000e6);
        vm.stopPrank();
        btcFeed.updatePrice(20000_00000000);
        vm.prank(liquidator);
        pool.liquidate(bob, address(usdc), address(cirBtc), 1000e6);
        assertEq(pool.totalCollateral(address(cirBtc)), 0);
        assertEq(pool.userCollateral(bob, address(cirBtc)), 0);
        assertEq(pool.getSupplyBalance(bob, address(cirBtc)), 4500000);
        assertEq(pool.getAvailableLiquidity(address(cirBtc)), 4500000);
    }

    function testCollateralWithdrawalCannotInflateSupplyDuringHealthCheck() public {
        vm.startPrank(bob);
        pool.supply(address(usdc), 1000e6);
        pool.depositCollateral(address(usdc), 1000e6);
        vm.stopPrank();
        eurc.mint(alice, 2000e6);
        vm.startPrank(alice);
        eurc.approve(address(pool), type(uint256).max);
        pool.supply(address(eurc), 2000e6);
        vm.stopPrank();
        vm.startPrank(bob);
        pool.borrow(address(eurc), 1000e6);
        vm.expectRevert(VitaelLendingPool.HealthFactorTooLow.selector);
        pool.withdrawCollateral(address(usdc), 1000e6);
        vm.stopPrank();
        assertEq(pool.totalCollateral(address(usdc)), 1000e6);
    }

    function testFuzzCollateralRoundTripPreservesSupply(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 10000e6);
        vm.prank(alice);
        pool.supply(address(usdc), 1000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(usdc), amount);
        assertEq(pool.getSupplyBalance(alice, address(usdc)), 1000e6);
        assertEq(pool.totalCollateral(address(usdc)), amount);
        pool.withdrawCollateral(address(usdc), amount);
        vm.stopPrank();
        assertEq(pool.totalCollateral(address(usdc)), 0);
        assertEq(pool.getAvailableLiquidity(address(usdc)), 1000e6);
    }

    function testCollateralCannotBeWithdrawnBySupplier() public {
        vm.prank(alice);
        pool.supply(address(usdc), 100e6);
        vm.prank(bob);
        pool.depositCollateral(address(usdc), 100e6);
        assertEq(pool.getSupplyBalance(alice, address(usdc)), 100e6);
        uint256 shares = pool.userShares(alice, address(usdc));
        vm.prank(alice);
        pool.withdraw(address(usdc), shares);
        assertEq(usdc.balanceOf(address(pool)), 100e6);
        vm.prank(bob);
        pool.withdrawCollateral(address(usdc), 100e6);
        assertEq(usdc.balanceOf(bob), 10_000e6);
    }

    function testBorrowCannotSpendDedicatedCollateral() public {
        vm.prank(alice);
        pool.depositCollateral(address(usdc), 1000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 1000e6);
        vm.expectRevert(VitaelLendingPool.InsufficientLiquidity.selector);
        pool.borrow(address(usdc), 100e6);
        vm.stopPrank();
    }

    function testCollateralDoesNotChangeRatesOrPendingInterest() public {
        vm.prank(alice);
        pool.supply(address(usdc), 1000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 2000e6);
        pool.borrow(address(usdc), 500e6);
        vm.stopPrank();
        vm.warp(block.timestamp + 30 days);
        uint256 debt = pool.getBorrowBalance(bob, address(usdc));
        uint256 supply = pool.getSupplyBalance(alice, address(usdc));
        uint256 rate = pool.getBorrowRate(address(usdc));
        uint256 utilization = pool.getUtilization(address(usdc));
        vm.prank(bob);
        pool.depositCollateral(address(usdc), 1000e6);
        assertEq(pool.getBorrowBalance(bob, address(usdc)), debt);
        assertEq(pool.getSupplyBalance(alice, address(usdc)), supply);
        assertEq(pool.getBorrowRate(address(usdc)), rate);
        assertEq(pool.getUtilization(address(usdc)), utilization);
    }
}
