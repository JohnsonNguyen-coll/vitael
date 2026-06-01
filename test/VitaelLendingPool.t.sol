// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/VitaelLendingPool.sol";
import "../src/vUSDC.sol";
import "../src/VitaelOracle.sol";
import "../src/MockERC20.sol";
import "../src/MockV3Aggregator.sol";

contract VitaelLendingPoolTest is Test {
    VitaelLendingPool public pool;
    vUSDC public vUsdc;
    VitaelOracle public oracle;

    MockERC20 public usdc;
    MockERC20 public eurc;
    MockERC20 public cirBtc;

    MockV3Aggregator public usdcFeed;
    MockV3Aggregator public eurcFeed;
    MockV3Aggregator public btcFeed;

    address public alice = address(0x1);
    address public bob = address(0x2);
    address public liquidator = address(0x3);

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        eurc = new MockERC20("Euro Coin", "EURC", 6);
        cirBtc = new MockERC20("Circle BTC", "cirBTC", 8);

        oracle = new VitaelOracle();
        vUsdc = new vUSDC();

        usdcFeed = new MockV3Aggregator(8, 1 * 1e8);
        eurcFeed = new MockV3Aggregator(8, 108 * 1e6);
        btcFeed = new MockV3Aggregator(8, 60000 * 1e8);

        pool = new VitaelLendingPool(address(usdc), address(vUsdc), address(oracle));
        vUsdc.transferOwnership(address(pool));

        oracle.addPriceFeed(address(usdc), address(usdcFeed));
        oracle.addPriceFeed(address(eurc), address(eurcFeed));
        oracle.addPriceFeed(address(cirBtc), address(btcFeed));

        pool.addCollateral(address(eurc), 8000, 8500, 500, 6);
        pool.addCollateral(address(cirBtc), 7000, 7500, 1000, 8);
        pool.addCollateral(address(usdc), 8500, 9000, 500, 6);

        usdc.mint(alice, 10000 * 1e6);
        usdc.mint(bob, 10000 * 1e6);
        usdc.mint(liquidator, 20000 * 1e6);
        eurc.mint(bob, 10000 * 1e6);
        cirBtc.mint(bob, 1 * 1e8);

        vm.startPrank(alice);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(pool), type(uint256).max);
        eurc.approve(address(pool), type(uint256).max);
        cirBtc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(liquidator);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();
    }

    function testSupply() public {
        vm.startPrank(alice);
        pool.supply(1000 * 1e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 9000 * 1e6);
        assertEq(usdc.balanceOf(address(pool)), 1000 * 1e6);
        assertEq(vUsdc.balanceOf(alice), 1000 * 1e6);
    }

    function testWithdraw() public {
        vm.startPrank(alice);
        pool.supply(1000 * 1e6);
        vUsdc.approve(address(pool), type(uint256).max);
        pool.withdraw(1000 * 1e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 10000 * 1e6);
        assertEq(vUsdc.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(address(pool)), 0);
    }

    function testBorrowWithoutCollateralReverts() public {
        vm.prank(alice);
        pool.supply(5000 * 1e6);

        vm.startPrank(bob);
        vm.expectRevert(VitaelLendingPool.HealthFactorTooLow.selector);
        pool.borrow(100 * 1e6);
        vm.stopPrank();
    }

    function testDepositCollateralAndBorrow() public {
        vm.prank(alice);
        pool.supply(5000 * 1e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 5555 * 1e6);

        pool.borrow(2000 * 1e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(bob), 12000 * 1e6);
        assertEq(pool.getCompoundedBorrowBalance(bob), 2000 * 1e6);
        assertEq(pool.getHealthFactor(bob), 2.55 * 1e18);
    }

    function testRepay() public {
        vm.prank(alice);
        pool.supply(5000 * 1e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 5555 * 1e6);
        pool.borrow(2000 * 1e6);
        pool.repay(1000 * 1e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(bob), 11000 * 1e6);
        assertEq(pool.getCompoundedBorrowBalance(bob), 1000 * 1e6);
    }

    function testInterestAccrual() public {
        vm.prank(alice);
        pool.supply(5000 * 1e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 10000 * 1e6);
        pool.borrow(4000 * 1e6);
        vm.stopPrank();

        uint256 initialBorrowBalance = pool.getCompoundedBorrowBalance(bob);
        vm.warp(block.timestamp + 365 days);
        pool.accrueInterest();

        uint256 compoundedBorrowBalance = pool.getCompoundedBorrowBalance(bob);
        assertTrue(compoundedBorrowBalance > initialBorrowBalance);
        assertApproxEqAbs(compoundedBorrowBalance, 4240 * 1e6, 2 * 1e6);
    }

    function testLiquidation() public {
        vm.prank(alice);
        pool.supply(5000 * 1e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(cirBtc), 1 * 1e7);
        pool.borrow(4500 * 1e6);
        vm.stopPrank();

        assertTrue(pool.getHealthFactor(bob) >= 1e18);

        btcFeed.updatePrice(40000 * 1e8);
        assertTrue(pool.getHealthFactor(bob) < 1e18);

        uint256 repayAmount = 1000 * 1e6;
        uint256 initialLiquidatorBtc = cirBtc.balanceOf(liquidator);

        vm.startPrank(liquidator);
        pool.liquidate(bob, address(cirBtc), repayAmount);
        vm.stopPrank();

        uint256 seized = cirBtc.balanceOf(liquidator) - initialLiquidatorBtc;
        assertEq(seized, 2625000);
        assertEq(pool.getCompoundedBorrowBalance(bob), 3500 * 1e6);
    }
}
