// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VitaelDEX.t.sol";

contract DEXHandler is Test {
    VitaelPair public pair;
    VitaelRouter public router;
    MockERC20 public token0;
    MockERC20 public token1;
    bool public ownershipViolation;

    constructor(VitaelPair pair_, VitaelRouter router_) {
        pair = pair_;
        router = router_;
        token0 = MockERC20(pair.token0());
        token1 = MockERC20(pair.token1());
        token0.mint(address(this), 1_000_000_000e6);
        token1.mint(address(this), 1_000_000_000e6);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        pair.approve(address(router), type(uint256).max);
    }

    function swap(uint256 rawAmount, bool reverse) external {
        address[] memory path = new address[](2);
        path[0] = reverse ? address(token1) : address(token0);
        path[1] = reverse ? address(token0) : address(token1);
        router.swapExactTokensForTokens(bound(rawAmount, 1e6, 100e6), 0, path, address(this), block.timestamp);
    }

    function mintBurn(uint256 rawAmount) external {
        uint256 amount = bound(rawAmount, 1e6, 100e6);
        (uint256 paid0, uint256 paid1, uint256 liquidity) =
            router.addLiquidity(address(token0), address(token1), amount, amount, 0, 0, address(this), block.timestamp);
        (uint256 received0, uint256 received1) =
            router.removeLiquidity(address(token0), address(token1), liquidity, 0, 0, address(this), block.timestamp);
        if (received0 > paid0 || received1 > paid1) ownershipViolation = true;
    }

    function collect() external {
        (uint112 before0, uint112 before1,) = pair.getReserves();
        pair.collectProtocolFees();
        (uint112 after0, uint112 after1,) = pair.getReserves();
        if (before0 != after0 || before1 != after1) ownershipViolation = true;
    }

    function skimAndSync(uint256 rawAmount) external {
        uint256 amount = bound(rawAmount, 1, 100e6);
        uint256 before0 = token0.balanceOf(address(this));
        uint256 before1 = token1.balanceOf(address(this));
        token0.transfer(address(pair), amount);
        token1.transfer(address(pair), amount);
        pair.skim(address(this));
        pair.sync();
        if (token0.balanceOf(address(this)) != before0 || token1.balanceOf(address(this)) != before1) {
            ownershipViolation = true;
        }
    }
}

contract VitaelDEXInvariantTest is Test {
    VitaelPair pair;
    DEXHandler handler;

    function setUp() public {
        MockERC20 token0 = new MockERC20("A", "A", 6);
        MockERC20 token1 = new MockERC20("B", "B", 6);
        VitaelFactory factory = new VitaelFactory(address(this), address(0xBEEF));
        VitaelRouter router = new VitaelRouter(address(factory));
        pair = VitaelPair(factory.createPair(address(token0), address(token1)));
        token0.mint(address(pair), 1_000_000e6);
        token1.mint(address(pair), 1_000_000e6);
        pair.mint(address(this));
        handler = new DEXHandler(pair, router);
        targetContract(address(handler));
    }

    function invariantFeesRemainSeparateFromLpAssets() public view {
        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertEq(uint256(r0) + pair.protocolFees0(), IERC20(pair.token0()).balanceOf(address(pair)));
        assertEq(uint256(r1) + pair.protocolFees1(), IERC20(pair.token1()).balanceOf(address(pair)));
        assertFalse(handler.ownershipViolation());
    }
}
