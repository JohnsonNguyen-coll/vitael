// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MockERC20.sol";
import "../src/dex/VitaelFactory.sol";
import "../src/dex/VitaelRouter.sol";

contract VitaelDEXTest is Test {
    MockERC20 token0;
    MockERC20 token1;
    VitaelFactory factory;
    VitaelRouter router;
    VitaelPair pair;
    address treasury = address(0xBEEF);
    address trader = address(0x1234);
    uint256 constant INITIAL = 1_000_000e6;

    function setUp() public {
        MockERC20 a = new MockERC20("A", "A", 6);
        MockERC20 b = new MockERC20("B", "B", 6);
        factory = new VitaelFactory(address(this), treasury);
        router = new VitaelRouter(address(factory));
        pair = VitaelPair(factory.createPair(address(a), address(b)));
        token0 = MockERC20(pair.token0());
        token1 = MockERC20(pair.token1());
        token0.mint(address(this), 10 * INITIAL);
        token1.mint(address(this), 10 * INITIAL);
        token0.mint(trader, 10 * INITIAL);
        token1.mint(trader, 10 * INITIAL);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        pair.approve(address(router), type(uint256).max);
        vm.startPrank(trader);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        vm.stopPrank();
        router.addLiquidity(address(token0), address(token1), INITIAL, INITIAL, 0, 0, address(this), block.timestamp);
    }

    function _swap(uint256 amount, bool reverse) internal {
        address[] memory path = new address[](2);
        path[0] = reverse ? address(token1) : address(token0);
        path[1] = reverse ? address(token0) : address(token1);
        vm.prank(trader);
        router.swapExactTokensForTokens(amount, 0, path, trader, block.timestamp);
    }

    function testFeesExcludedFromReserves() public {
        _swap(10000e6, false);
        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertEq(pair.protocolFees0(), 10e6);
        assertEq(uint256(r0) + pair.protocolFees0(), token0.balanceOf(address(pair)));
        assertEq(uint256(r1) + pair.protocolFees1(), token1.balanceOf(address(pair)));
    }

    function testCollectFeesPreservesReserves() public {
        _swap(10000e6, false);
        _swap(10000e6, true);
        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 fee0 = pair.protocolFees0();
        uint256 fee1 = pair.protocolFees1();
        pair.collectProtocolFees();
        (uint112 after0, uint112 after1,) = pair.getReserves();
        assertEq(after0, r0);
        assertEq(after1, r1);
        assertEq(token0.balanceOf(treasury), fee0);
        assertEq(token1.balanceOf(treasury), fee1);
    }

    function testPausedPairRejectsSwap() public {
        uint256 amount = 10000e6;
        uint256 out = router.getAmountOut(amount, INITIAL, INITIAL);
        token0.transfer(address(pair), amount);
        factory.pause();
        vm.expectRevert(bytes("VitaelPair: PAUSED"));
        pair.swap(0, out, trader, "");
    }

    function testAddLiquidityChecksBothMinimums() public {
        vm.expectRevert(bytes("VitaelRouter: INSUFFICIENT_A_AMOUNT"));
        router.addLiquidity(address(token0), address(token1), 100e6, 200e6, 101e6, 0, address(this), block.timestamp);
    }

    function testExactOutputSwapWithPendingFees() public {
        _swap(10000e6, false);
        address[] memory path = new address[](2);
        path[0] = address(token1);
        path[1] = address(token0);
        uint256 before0 = token0.balanceOf(trader);
        vm.prank(trader);
        router.swapTokensForExactTokens(100e6, 200e6, path, trader, block.timestamp);
        assertEq(token0.balanceOf(trader) - before0, 100e6);
        _assertAccounting();
    }

    function testSwapSlippageAndDeadlineRollback() public {
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);
        uint256 balance = token0.balanceOf(trader);
        vm.startPrank(trader);
        vm.expectRevert(bytes("VitaelRouter: INSUFFICIENT_OUTPUT_AMOUNT"));
        router.swapExactTokensForTokens(100e6, 100e6, path, trader, block.timestamp);
        vm.expectRevert(bytes("VitaelRouter: EXPIRED"));
        router.swapExactTokensForTokens(100e6, 0, path, trader, block.timestamp - 1);
        vm.stopPrank();
        assertEq(token0.balanceOf(trader), balance);
        _assertAccounting();
    }

    function testAddLiquidityChecksMinimumBOnOtherBranch() public {
        vm.expectRevert(bytes("VitaelRouter: INSUFFICIENT_B_AMOUNT"));
        router.addLiquidity(address(token0), address(token1), 200e6, 100e6, 0, 101e6, address(this), block.timestamp);
    }

    function testInitialLiquidityChecksMinimums() public {
        MockERC20 other = new MockERC20("Other", "O", 6);
        other.mint(address(this), INITIAL);
        other.approve(address(router), type(uint256).max);
        vm.expectRevert(bytes("VitaelRouter: INSUFFICIENT_A_AMOUNT"));
        router.addLiquidity(address(token0), address(other), 100e6, 100e6, 101e6, 0, address(this), block.timestamp);
        assertEq(factory.getPair(address(token0), address(other)), address(0));
    }

    function testBurnCannotWithdrawTreasuryFees() public {
        _swap(10000e6, false);
        _swap(10000e6, true);
        uint256 fee0 = pair.protocolFees0();
        uint256 fee1 = pair.protocolFees1();
        uint256 liquidity = pair.balanceOf(address(this));
        uint256 supply = pair.totalSupply();
        uint256 expected0 = liquidity * (token0.balanceOf(address(pair)) - fee0) / supply;
        uint256 expected1 = liquidity * (token1.balanceOf(address(pair)) - fee1) / supply;
        (uint256 amount0, uint256 amount1) =
            router.removeLiquidity(address(token0), address(token1), liquidity, 0, 0, address(this), block.timestamp);
        assertEq(amount0, expected0);
        assertEq(amount1, expected1);
        pair.collectProtocolFees();
        assertEq(token0.balanceOf(treasury), fee0);
        assertEq(token1.balanceOf(treasury), fee1);
    }

    function testMintAndBurnWithPendingFees() public {
        _swap(10000e6, false);
        uint256 fees = pair.protocolFees0();
        (uint256 amount0, uint256 amount1, uint256 liquidity) =
            router.addLiquidity(address(token0), address(token1), 1000e6, 1000e6, 0, 0, address(this), block.timestamp);
        (uint256 returned0, uint256 returned1) =
            router.removeLiquidity(address(token0), address(token1), liquidity, 0, 0, address(this), block.timestamp);
        assertApproxEqAbs(returned0, amount0, 2);
        assertApproxEqAbs(returned1, amount1, 2);
        assertEq(pair.protocolFees0(), fees);
        _assertAccounting();
    }

    function testSkimAndSyncCannotExposeProtocolFees() public {
        _swap(10000e6, false);
        uint256 fee = pair.protocolFees0();
        uint256 before0 = token0.balanceOf(trader);
        token0.transfer(address(pair), 100e6);
        pair.skim(trader);
        assertEq(token0.balanceOf(trader) - before0, 100e6);
        pair.sync();
        pair.skim(trader);
        assertEq(token0.balanceOf(trader) - before0, 100e6);
        assertEq(pair.protocolFees0(), fee);
        _assertAccounting();
    }

    function testPauseBlocksRouterAndUnpauseRestoresSwap() public {
        factory.pause();
        uint256 balance = token0.balanceOf(trader);
        vm.expectRevert(bytes("VitaelPair: PAUSED"));
        _swap(10000e6, false);
        assertEq(token0.balanceOf(trader), balance);
        factory.unpause();
        _swap(10000e6, false);
        _assertAccounting();
    }

    function testPauseAllowsExitAndFeeCollection() public {
        _swap(10000e6, false);
        factory.pause();
        router.removeLiquidity(
            address(token0), address(token1), pair.balanceOf(address(this)), 0, 0, address(this), block.timestamp
        );
        pair.collectProtocolFees();
        assertEq(token0.balanceOf(treasury), 10e6);
    }

    function testFeeChangesOnlyAffectNewSwaps() public {
        _swap(10000e6, false);
        assertEq(pair.protocolFees0(), 10e6);
        factory.setProtocolFee(0);
        _swap(10000e6, false);
        assertEq(pair.protocolFees0(), 10e6);
        factory.setProtocolFee(10);
        _swap(10000e6, false);
        assertEq(pair.protocolFees0(), 20e6);
        _assertAccounting();
    }

    function testReserveOverflowRevertsInsteadOfTruncating() public {
        token0.mint(address(pair), uint256(type(uint112).max) - INITIAL);
        pair.sync();
        (uint112 r0,,) = pair.getReserves();
        assertEq(r0, type(uint112).max);
        token0.mint(address(pair), 1);
        vm.expectRevert(bytes("VitaelPair: OVERFLOW"));
        pair.sync();
        (r0,,) = pair.getReserves();
        assertEq(r0, type(uint112).max);
    }

    function testFuzzSwapAccounting(uint96 rawAmount, bool reverse, uint8 rawFee) public {
        uint256 amount = bound(uint256(rawAmount), 1e6, 100000e6);
        factory.setProtocolFee(bound(uint256(rawFee), 0, 10));
        (uint112 before0, uint112 before1,) = pair.getReserves();
        _swap(amount, reverse);
        (uint112 after0, uint112 after1,) = pair.getReserves();
        assertGe(uint256(after0) * after1, uint256(before0) * before1);
        _assertAccounting();
        pair.collectProtocolFees();
        _assertAccounting();
    }

    function _assertAccounting() internal view {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertEq(uint256(r0) + pair.protocolFees0(), token0.balanceOf(address(pair)));
        assertEq(uint256(r1) + pair.protocolFees1(), token1.balanceOf(address(pair)));
    }
}
