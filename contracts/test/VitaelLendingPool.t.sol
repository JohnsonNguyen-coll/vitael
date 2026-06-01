// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/VitaelLendingPool.sol";
import "../src/VitaelOracle.sol";
import "../src/MockERC20.sol";
import "../src/MockV3Aggregator.sol";

/**
 * @title VitaelLendingPoolTest
 * @notice Full test suite: supply, withdraw, collateral, borrow, repay, liquidation.
 */
contract VitaelLendingPoolTest is Test {
    VitaelLendingPool pool;
    VitaelOracle      oracle;

    MockERC20 usdc;
    MockERC20 eurc;
    MockERC20 cirBtc;

    MockV3Aggregator usdcFeed;
    MockV3Aggregator eurcFeed;
    MockV3Aggregator btcFeed;

    address alice     = address(0xA1);
    address bob       = address(0xB0B);
    address liquidator = address(0x11);

    // ─── Setup ────────────────────────────────────────────────────────────────

    function setUp() public {
        usdc   = new MockERC20("USD Coin",    "USDC",   6);
        eurc   = new MockERC20("Euro Coin",   "EURC",   6);
        cirBtc = new MockERC20("Circle BTC",  "cirBTC", 8);

        usdcFeed = new MockV3Aggregator(8, 1_00000000);      // $1.00
        eurcFeed = new MockV3Aggregator(8, 1_08000000);      // $1.08
        btcFeed  = new MockV3Aggregator(8, 60000_00000000);  // $60 000

        oracle = new VitaelOracle();
        oracle.addPriceFeed(address(usdc),   address(usdcFeed));
        oracle.addPriceFeed(address(eurc),   address(eurcFeed));
        oracle.addPriceFeed(address(cirBtc), address(btcFeed));

        pool = new VitaelLendingPool(address(oracle));

        // USDC — stable
        pool.addAsset(address(usdc),   6, 9000, 9200, 500,  2e16, 8e17, 4e16, 75e16, 1000);
        // EURC — stable
        pool.addAsset(address(eurc),   6, 8500, 8800, 500,  2e16, 8e17, 4e16, 75e16, 1000);
        // cirBTC — volatile
        pool.addAsset(address(cirBtc), 8, 7000, 7500, 1000, 2e16, 8e17, 4e16, 75e16, 1000);

        // Mint tokens
        usdc.mint(alice,     10_000e6);
        usdc.mint(bob,       10_000e6);
        usdc.mint(liquidator,50_000e6);
        eurc.mint(bob,       10_000e6);
        cirBtc.mint(bob,     1e8);       // 1 BTC

        // Approvals
        vm.startPrank(alice);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(pool),   type(uint256).max);
        eurc.approve(address(pool),   type(uint256).max);
        cirBtc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(liquidator);
        usdc.approve(address(pool),   type(uint256).max);
        eurc.approve(address(pool),   type(uint256).max);
        cirBtc.approve(address(pool), type(uint256).max);
        vm.stopPrank();
    }

    // ─── Supply / Withdraw ────────────────────────────────────────────────────

    function testSupplyUsdc() public {
        vm.prank(alice);
        pool.supply(address(usdc), 1000e6);

        assertEq(usdc.balanceOf(alice), 9000e6);
        assertEq(usdc.balanceOf(address(pool)), 1000e6);
        assertApproxEqAbs(pool.getSupplyBalance(alice, address(usdc)), 1000e6, 1);
    }

    function testWithdrawUsdc() public {
        vm.startPrank(alice);
        pool.supply(address(usdc), 1000e6);
        uint256 shares = pool.userShares(alice, address(usdc));
        pool.withdraw(address(usdc), shares);
        vm.stopPrank();

        assertApproxEqAbs(usdc.balanceOf(alice), 10_000e6, 1);
        assertEq(pool.userShares(alice, address(usdc)), 0);
    }

    function testSupplyMultiAsset() public {
        vm.prank(alice);
        pool.supply(address(usdc), 1000e6);

        vm.startPrank(bob);
        pool.supply(address(eurc),   500e6);
        pool.supply(address(cirBtc), 1e7);   // 0.1 BTC
        vm.stopPrank();

        assertApproxEqAbs(pool.getSupplyBalance(bob, address(eurc)),   500e6, 1);
        assertApproxEqAbs(pool.getSupplyBalance(bob, address(cirBtc)), 1e7,   1);
    }

    // ─── Collateral ───────────────────────────────────────────────────────────

    function testDepositAndWithdrawCollateral() public {
        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 1000e6);
        assertEq(pool.userCollateral(bob, address(eurc)), 1000e6);

        pool.withdrawCollateral(address(eurc), 500e6);
        assertEq(pool.userCollateral(bob, address(eurc)), 500e6);
        vm.stopPrank();
    }

    // ─── Borrow / Repay ───────────────────────────────────────────────────────

    function testBorrowUsdcAgainstEurcCollateral() public {
        // Alice supplies USDC liquidity
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        // Bob deposits EURC collateral and borrows USDC
        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 5000e6);  // $5 400 value
        pool.borrow(address(usdc), 2000e6);              // borrow $2 000
        vm.stopPrank();

        assertEq(usdc.balanceOf(bob), 12_000e6);
        assertApproxEqAbs(pool.getBorrowBalance(bob, address(usdc)), 2000e6, 1);

        uint256 hf = pool.getHealthFactor(bob);
        // collThresh = 5000 * 1.08 * 0.88 = 4752 USD; borrow = 2000 USD → HF ≈ 2.376
        assertGt(hf, 2e18);
    }

    function testBorrowEurcAgainstBtcCollateral() public {
        // Alice supplies EURC liquidity
        vm.startPrank(alice);
        eurc.mint(alice, 10_000e6);
        eurc.approve(address(pool), type(uint256).max);
        pool.supply(address(eurc), 5000e6);
        vm.stopPrank();

        // Bob deposits cirBTC and borrows EURC
        vm.startPrank(bob);
        pool.depositCollateral(address(cirBtc), 1e7);  // 0.1 BTC = $6 000
        pool.borrow(address(eurc), 1000e6);             // borrow 1000 EURC ≈ $1 080
        vm.stopPrank();

        assertApproxEqAbs(pool.getBorrowBalance(bob, address(eurc)), 1000e6, 1);
        assertGt(pool.getHealthFactor(bob), 1e18);
    }

    function testBorrowWithoutCollateralReverts() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        vm.prank(bob);
        vm.expectRevert(VitaelLendingPool.HealthFactorTooLow.selector);
        pool.borrow(address(usdc), 100e6);
    }

    function testRepay() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 5000e6);
        pool.borrow(address(usdc), 2000e6);
        pool.repay(address(usdc), 1000e6);
        vm.stopPrank();

        assertApproxEqAbs(pool.getBorrowBalance(bob, address(usdc)), 1000e6, 1);
    }

    function testRepayFullWithMaxUint() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 5000e6);
        pool.borrow(address(usdc), 1000e6);
        pool.repay(address(usdc), type(uint256).max);
        vm.stopPrank();

        assertEq(pool.getBorrowBalance(bob, address(usdc)), 0);
    }

    // ─── Interest accrual ─────────────────────────────────────────────────────

    function testInterestAccrual() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 10_000e6);
        pool.borrow(address(usdc), 4000e6);
        vm.stopPrank();

        uint256 debtBefore = pool.getBorrowBalance(bob, address(usdc));
        vm.warp(block.timestamp + 365 days);
        pool.accrueInterest(address(usdc));
        uint256 debtAfter = pool.getBorrowBalance(bob, address(usdc));

        assertGt(debtAfter, debtBefore);
        // ~6% APY on 4000 USDC at 80% utilization → ~4240 USDC after 1 year
        assertApproxEqAbs(debtAfter, 4240e6, 5e6);
    }

    function testSupplyYieldAccrues() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 10_000e6);
        pool.borrow(address(usdc), 4000e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        pool.accrueInterest(address(usdc));

        uint256 supplyAfter = pool.getSupplyBalance(alice, address(usdc));
        assertGt(supplyAfter, 5000e6);
    }

    // ─── Liquidation ──────────────────────────────────────────────────────────

    function testLiquidation() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        // Bob deposits 0.1 BTC ($6 000) and borrows $4 000 USDC
        vm.startPrank(bob);
        pool.depositCollateral(address(cirBtc), 1e7);
        pool.borrow(address(usdc), 4000e6);
        vm.stopPrank();

        assertTrue(pool.getHealthFactor(bob) >= 1e18);

        // BTC price drops to $40 000 → collateral = $4 000, liqThresh 75% → $3 000 < $4 000 debt
        btcFeed.updatePrice(40000_00000000);
        assertTrue(pool.getHealthFactor(bob) < 1e18);

        uint256 repayAmt = 1000e6;
        uint256 btcBefore = cirBtc.balanceOf(liquidator);

        vm.prank(liquidator);
        pool.liquidate(bob, address(usdc), address(cirBtc), repayAmt);

        uint256 seized = cirBtc.balanceOf(liquidator) - btcBefore;
        // seized = (1000 * 1e8 * 1.10) / 40000 = 2 750 000 satoshi
        assertApproxEqAbs(seized, 2_750_000, 10_000);
        assertApproxEqAbs(pool.getBorrowBalance(bob, address(usdc)), 3000e6, 1);
    }

    function testLiquidateHealthyReverts() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 5000e6);
        pool.borrow(address(usdc), 1000e6);
        vm.stopPrank();

        vm.prank(liquidator);
        vm.expectRevert(VitaelLendingPool.PositionHealthy.selector);
        pool.liquidate(bob, address(usdc), address(eurc), 100e6);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    function testGetPosition() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 2000e6);
        pool.borrow(address(usdc), 500e6);
        vm.stopPrank();

        (uint256 collUSD, uint256 borrowUSD, uint256 hf) = pool.getPosition(bob);
        assertGt(collUSD, 0);
        assertGt(borrowUSD, 0);
        assertGt(hf, 1e18);
    }

    function testExchangeRateIncreasesOverTime() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 10_000e6);
        pool.borrow(address(usdc), 4000e6);
        vm.stopPrank();

        uint256 rateBefore = pool.exchangeRate(address(usdc));
        vm.warp(block.timestamp + 30 days);
        uint256 rateAfter = pool.exchangeRate(address(usdc));

        assertGt(rateAfter, rateBefore);
    }

    // ─── EURC price oracle (MockV3Aggregator) ────────────────────────────────

    function testEURCPriceChangeAffectsHealthFactor() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 1000e6);  // $1 080 at $1.08
        pool.borrow(address(usdc), 500e6);
        vm.stopPrank();

        uint256 hfBefore = pool.getHealthFactor(bob);

        // EURC price rises to $1.10 — collateral value increases
        eurcFeed.updatePrice(1_10000000);
        uint256 hfAfter = pool.getHealthFactor(bob);

        assertGt(hfAfter, hfBefore);
    }

    function testEURCPriceDropCanTriggerLiquidation() public {
        vm.prank(alice);
        pool.supply(address(usdc), 5000e6);

        // Bob deposits 1000 EURC ($1 080) and borrows $900 USDC (near max)
        vm.startPrank(bob);
        pool.depositCollateral(address(eurc), 1000e6);
        pool.borrow(address(usdc), 900e6);
        vm.stopPrank();

        assertTrue(pool.getHealthFactor(bob) >= 1e18);

        // EURC drops to $0.90 → collateral = $900, liqThresh 88% → $792 < $900 debt
        eurcFeed.updatePrice(90_000_000);
        assertTrue(pool.getHealthFactor(bob) < 1e18);

        vm.prank(liquidator);
        pool.liquidate(bob, address(usdc), address(eurc), 200e6);
        assertLt(pool.getBorrowBalance(bob, address(usdc)), 900e6);
    }
}
