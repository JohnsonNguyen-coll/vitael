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
    MockERC20 public weth;
    MockERC20 public wbtc;

    MockV3Aggregator public usdcFeed;
    MockV3Aggregator public wethFeed;
    MockV3Aggregator public wbtcFeed;

    address public alice = address(0x1);
    address public bob = address(0x2);
    address public liquidator = address(0x3);

    function setUp() public {
        // Deploy Mock tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        wbtc = new MockERC20("Wrapped Bitcoin", "WBTC", 8);

        // Deploy Oracle and vUSDC
        oracle = new VitaelOracle();
        vUsdc = new vUSDC();

        // Deploy Mock Aggregators (8 decimals)
        usdcFeed = new MockV3Aggregator(8, 1 * 1e8);
        wethFeed = new MockV3Aggregator(8, 3000 * 1e8);
        wbtcFeed = new MockV3Aggregator(8, 60000 * 1e8);

        // Deploy Lending Pool
        pool = new VitaelLendingPool(address(usdc), address(vUsdc), address(oracle));

        // Transfer ownership of vUSDC to the pool so it can mint/burn
        vUsdc.transferOwnership(address(pool));

        // Add feeds to oracle
        oracle.addPriceFeed(address(usdc), address(usdcFeed));
        oracle.addPriceFeed(address(weth), address(wethFeed));
        oracle.addPriceFeed(address(wbtc), address(wbtcFeed));

        // Add Collateral configurations in the pool
        // WETH: LTV = 80%, Liquidation Threshold = 85%, Bonus = 5%
        pool.addCollateral(address(weth), 8000, 8500, 500, 18);
        // WBTC: LTV = 70%, Liquidation Threshold = 75%, Bonus = 10%
        pool.addCollateral(address(wbtc), 7000, 7500, 1000, 8);

        // Mint balances to test accounts
        usdc.mint(alice, 10000 * 1e6); // Alice has 10,000 USDC
        usdc.mint(bob, 10000 * 1e6);   // Bob has 10,000 USDC
        usdc.mint(liquidator, 20000 * 1e6); // Liquidator has 20,000 USDC
        weth.mint(bob, 10 * 1e18);     // Bob has 10 WETH
        wbtc.mint(bob, 1 * 1e8);       // Bob has 1 WBTC

        // Approvals
        vm.startPrank(alice);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(pool), type(uint256).max);
        weth.approve(address(pool), type(uint256).max);
        wbtc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(liquidator);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();
    }

    function testSupply() public {
        vm.startPrank(alice);
        pool.supply(1000 * 1e6); // Alice supplies 1,000 USDC
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
        // Alice supplies 5000 USDC to liquidity pool
        vm.prank(alice);
        pool.supply(5000 * 1e6);

        // Bob tries to borrow 100 USDC without collateral
        vm.startPrank(bob);
        vm.expectRevert(VitaelLendingPool.HealthFactorTooLow.selector);
        pool.borrow(100 * 1e6);
        vm.stopPrank();
    }

    function testDepositCollateralAndBorrow() public {
        // Alice supplies 5000 USDC
        vm.prank(alice);
        pool.supply(5000 * 1e6);

        vm.startPrank(bob);
        // Bob deposits 2 WETH ($6,000 value)
        pool.depositCollateral(address(weth), 2 * 1e18);

        // Bob borrows 2000 USDC ($2,000 value)
        // With 80% LTV on WETH ($6,000), Bob can borrow up to $4,800
        pool.borrow(2000 * 1e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(bob), 12000 * 1e6);
        assertEq(pool.getCompoundedBorrowBalance(bob), 2000 * 1e6);
        
        // HF should be: (6000 * 85%) / 2000 = 5100 / 2000 = 2.55 * 1e18
        assertEq(pool.getHealthFactor(bob), 2.55 * 1e18);
    }

    function testRepay() public {
        // Setup borrow position
        vm.prank(alice);
        pool.supply(5000 * 1e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(weth), 2 * 1e18);
        pool.borrow(2000 * 1e6);

        // Bob repays 1000 USDC
        pool.repay(1000 * 1e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(bob), 11000 * 1e6);
        assertEq(pool.getCompoundedBorrowBalance(bob), 1000 * 1e6);
    }

    function testInterestAccrual() public {
        // Alice supplies 5000 USDC
        vm.prank(alice);
        pool.supply(5000 * 1e6);

        // Bob deposits collateral and borrows 4000 USDC (80% utilization)
        vm.startPrank(bob);
        pool.depositCollateral(address(weth), 5 * 1e18); // $15,000 collateral
        pool.borrow(4000 * 1e6);
        vm.stopPrank();

        uint256 initialBorrowBalance = pool.getCompoundedBorrowBalance(bob);

        // Fast forward 365 days
        vm.warp(block.timestamp + 365 days);

        // Accrue interest manually or trigger it via another action
        pool.accrueInterest();

        uint256 compoundedBorrowBalance = pool.getCompoundedBorrowBalance(bob);
        assertTrue(compoundedBorrowBalance > initialBorrowBalance);
        
        // Let's verify interest rate calculation:
        // Cash = 1000 USDC, Borrows = 4000 USDC. TotalSupply = 5000 USDC.
        // U = 80%. Since U == OPTIMAL_UTILIZATION, borrowRate = BASE_RATE + SLOPE_1 = 2% + 4% = 6%.
        // 6% interest on 4000 USDC for 1 year = 240 USDC.
        // Compounded balance should be close to 4240 USDC.
        assertApproxEqAbs(compoundedBorrowBalance, 4240 * 1e6, 2 * 1e6); // allowing small rounding
    }

    function testLiquidation() public {
        // Alice supplies 5000 USDC
        vm.prank(alice);
        pool.supply(5000 * 1e6);

        // Bob deposits collateral and borrows max amount
        vm.startPrank(bob);
        pool.depositCollateral(address(weth), 2 * 1e18); // 2 WETH = $6,000. Limit = $4,800. Threshold = $5,100
        pool.borrow(4500 * 1e6); // Borrow $4,500
        vm.stopPrank();

        // Health factor is healthy: (6000 * 85%) / 4500 = 1.133
        assertTrue(pool.getHealthFactor(bob) >= 1e18);

        // Price of WETH drops from $3000 to $2000
        wethFeed.updatePrice(2000 * 1e8); // 2 WETH = $4,000. Threshold = $3,400. HF = 3400 / 4500 = 0.755
        assertTrue(pool.getHealthFactor(bob) < 1e18);

        // Liquidator liquidates position
        uint256 repayAmount = 1000 * 1e6; // Liquidator repays 1000 USDC
        uint256 initialLiquidatorWeth = weth.balanceOf(liquidator);

        vm.startPrank(liquidator);
        pool.liquidate(bob, address(weth), repayAmount);
        vm.stopPrank();

        uint256 finalLiquidatorWeth = weth.balanceOf(liquidator);
        uint256 seizedCollateral = finalLiquidatorWeth - initialLiquidatorWeth;

        // Seized collateral should be: ($1000 repaid * 1.05 bonus) / $2000 WETH price = 0.525 WETH
        assertEq(seizedCollateral, 0.525 * 1e18);
        assertEq(pool.getCompoundedBorrowBalance(bob), 3500 * 1e6);
    }
}
