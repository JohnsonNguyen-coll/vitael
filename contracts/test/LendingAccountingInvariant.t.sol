// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VitaelLendingPool.t.sol";

contract LendingAccountingHandler is Test {
    VitaelLendingPool public pool;
    MockERC20 public token;
    MockV3Aggregator public feed;
    address[3] public borrowers = [address(0x101), address(0x102), address(0x103)];

    constructor(VitaelLendingPool p, MockERC20 t, MockV3Aggregator f) {
        pool = p;
        token = t;
        feed = f;
        token.mint(address(this), 1_000_000e6);
        token.approve(address(pool), type(uint256).max);
        pool.supply(address(token), 100_000e6);
        for (uint256 i; i < 3; i++) {
            token.mint(borrowers[i], 1_000_000e6);
            vm.startPrank(borrowers[i]);
            token.approve(address(pool), type(uint256).max);
            pool.depositCollateral(address(token), 100_000e6);
            vm.stopPrank();
        }
    }

    function step(uint256 actorSeed, uint256 actionSeed, uint256 amountSeed, uint256 elapsed) external {
        vm.warp(block.timestamp + bound(elapsed, 0, 1 hours));
        feed.updatePrice(1e8);
        pool.accrueInterest(address(token));
        address actor = borrowers[actorSeed % 3];
        uint256 action = actionSeed % 5;
        uint256 amount = bound(amountSeed, 1, 100e6);
        if (action == 0) {
            // Keep these generated loans far below the collateral limit.
            if (pool.getBorrowBalance(actor, address(token)) > 10_000e6) return;
            vm.prank(actor);
            pool.borrow(address(token), amount);
        } else if (action == 1) {
            uint256 debt = pool.getBorrowBalance(actor, address(token));
            if (debt == 0) return;
            vm.prank(actor);
            pool.repay(address(token), Math.min(amount, debt));
        } else if (action == 2) {
            assertTrue(token.transfer(address(pool), amount));
        } else if (action == 3) {
            if (pool.previewSupply(address(token), amount) == 0) return;
            pool.supply(address(token), amount);
        } else {
            uint256 shares = Math.min(amount, pool.userShares(address(this), address(token)));
            if (shares == 0 || pool.previewRedeem(address(token), shares) == 0) return;
            pool.withdraw(address(token), shares);
        }
    }

    function settle() external {
        for (uint256 i; i < 3; i++) {
            uint256 debt = pool.getBorrowBalance(borrowers[i], address(token));
            if (debt == 0) continue;
            vm.prank(borrowers[i]);
            pool.repay(address(token), type(uint256).max);
        }
    }
}

contract LendingAccountingInvariantTest is Test {
    VitaelLendingPool pool;
    MockERC20 token;
    LendingAccountingHandler handler;

    function setUp() public {
        token = new MockERC20("USD", "USD", 6);
        MockV3Aggregator feed = new MockV3Aggregator(8, 1e8);
        VitaelOracle oracle = new VitaelOracle();
        oracle.addPriceFeed(address(token), address(feed), 1 hours);
        pool = new VitaelLendingPool(address(oracle));
        pool.addAsset(address(token), 6, 9000, 9200, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        handler = new LendingAccountingHandler(pool, token, feed);
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = LendingAccountingHandler.step.selector;
        targetSelector(FuzzSelector(address(handler), selectors));
        targetContract(address(handler));
    }

    function invariant_accountingConservesCashAndClaims() public view {
        address asset = address(token);
        assertEq(
            token.balanceOf(address(pool)),
            pool.accountedCash(asset) + pool.totalCollateral(asset) + pool.getUnaccountedBalance(asset)
        );
        uint256 shares;
        uint256 individualDebt;
        for (uint256 i; i < 3; i++) {
            shares += pool.userDebtShares(handler.borrowers(i), asset);
            individualDebt += pool.getBorrowBalance(handler.borrowers(i), asset);
        }
        assertEq(shares, pool.totalDebtShares(asset));
        (uint256 debt, uint256 reserves,,, uint256 supplyShares) = pool.assetStates(asset);
        assertGe(individualDebt, debt);
        assertLe(individualDebt - debt, 2);
        assertEq(pool.previewRedeem(asset, supplyShares), pool.accountedCash(asset) + debt - reserves);
    }

    function afterInvariant() public {
        handler.settle();
        (uint256 debt,,,,) = pool.assetStates(address(token));
        assertEq(debt, 0);
        assertEq(pool.totalDebtShares(address(token)), 0);
    }
}
