// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VitaelLendingPool.t.sol";

contract MainnetRiskRegressionTest is VitaelLendingPoolTest {
    function testUnrelatedStaleFeedDoesNotBlockBorrow() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.prank(bob);
        pool.depositCollateral(address(eurc), 1000e6);
        vm.warp(block.timestamp + 2 hours);
        usdcFeed.updatePrice(1e8);
        eurcFeed.updatePrice(108000000);
        // BTC is stale, but this account has no BTC exposure.
        vm.prank(bob);
        pool.borrow(address(usdc), 100e6);
        assertEq(pool.getBorrowBalance(bob, address(usdc)), 100e6);
    }

    function testRejectBorrowAboveLtvBelowLiquidationThreshold() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 1000e6);
        // LTV: 918 USDC, liquidation threshold: 950.4 USDC.
        vm.expectRevert(VitaelLendingPool.BorrowLimitExceeded.selector);
        pool.borrow(address(usdc), 930e6);
        vm.stopPrank();
    }

    function testRejectStaleOraclePrice() public {
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(abi.encodeWithSelector(VitaelOracle.StalePrice.selector, address(usdc)));
        oracle.getAssetPrice(address(usdc));
    }

    function testNormalizeOracleDecimals() public {
        MockV3Aggregator feed = new MockV3Aggregator(18, 2e18);
        oracle.setPriceFeed(address(usdc), address(feed), 1 hours);
        assertEq(oracle.getAssetPrice(address(usdc)), 2e8);
    }

    function testBorrowAtLtvSucceedsAndOneUnitOverReverts() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 1000e6);
        pool.borrow(address(usdc), 918e6);
        vm.expectRevert(VitaelLendingPool.BorrowLimitExceeded.selector);
        pool.borrow(address(usdc), 1);
        vm.stopPrank();
        assertEq(pool.getBorrowBalance(bob, address(usdc)), 918e6);
    }

    function testSameAssetSupplyCannotInflateBorrowLimit() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.startPrank(bob);
        pool.supply(address(usdc), 1000e6);
        vm.expectRevert(VitaelLendingPool.BorrowLimitExceeded.selector);
        pool.borrow(address(usdc), 910e6);
        pool.borrow(address(usdc), 900e6);
        vm.stopPrank();
        assertEq(pool.getSupplyBalance(bob, address(usdc)), 1000e6);
    }

    function testCannotWithdrawDedicatedCollateralPastLtv() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 1000e6);
        pool.borrow(address(usdc), 900e6);
        vm.expectRevert(VitaelLendingPool.BorrowLimitExceeded.selector);
        pool.withdrawCollateral(address(eurc), 30e6);
        vm.stopPrank();
        assertEq(pool.userCollateral(bob, address(eurc)), 1000e6);
    }

    function testCannotWithdrawSupplyPastLtv() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.startPrank(bob);
        pool.supply(address(eurc), 1000e6);
        pool.borrow(address(usdc), 900e6);
        vm.expectRevert(VitaelLendingPool.BorrowLimitExceeded.selector);
        pool.withdraw(address(eurc), 30e6);
        vm.stopPrank();
        assertEq(pool.getSupplyBalance(bob, address(eurc)), 1000e6);
    }

    function testRepayStillWorksDuringOracleOutage() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 1000e6);
        pool.borrow(address(usdc), 900e6);
        vm.warp(block.timestamp + 2 hours);
        pool.repay(address(usdc), type(uint256).max);
        pool.withdrawCollateral(address(eurc), 1000e6);
        vm.stopPrank();
        assertEq(pool.getBorrowBalance(bob, address(usdc)), 0);
    }

    function testBorrowWithStaleFeedRevertsAndRollsBackTransfer() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);
        vm.prank(bob);
        pool.depositCollateral(address(eurc), 1000e6);
        vm.warp(block.timestamp + 2 hours);
        uint256 balance = usdc.balanceOf(bob);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(VitaelOracle.StalePrice.selector, address(usdc)));
        pool.borrow(address(usdc), 100e6);
        assertEq(usdc.balanceOf(bob), balance);
        assertEq(pool.getBorrowBalance(bob, address(usdc)), 0);
    }
}
