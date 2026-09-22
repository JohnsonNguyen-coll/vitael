// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VitaelUSDCVault.t.sol";

contract VaultCollateralAccountingTest is VitaelUSDCVaultTest {
    function testVaultCannotCountOrWithdrawDedicatedCollateral() public {
        vm.prank(alice);
        vault.deposit(1000e6, alice);
        usdc.mint(borrower, 1000e6);
        vm.startPrank(borrower);
        usdc.approve(address(pool), type(uint256).max);
        pool.depositCollateral(address(usdc), 1000e6);
        pool.depositCollateral(address(eurc), 2000e6);
        pool.borrow(address(usdc), 500e6);
        vm.stopPrank();
        assertEq(vault.totalAssets(), 1000e6);
        assertEq(vault.availableLiquidity(), 500e6);
        assertEq(vault.maxWithdraw(alice), 500e6);
        vm.prank(alice);
        vault.withdraw(500e6, alice, alice);
        assertEq(usdc.balanceOf(address(pool)), 1000e6);
        assertEq(pool.totalCollateral(address(usdc)), 1000e6);
        assertEq(vault.maxWithdraw(alice), 0);
    }
}
