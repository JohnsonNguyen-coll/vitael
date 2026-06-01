// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VitaelFactory.sol";
import "./VitaelPair.sol";
import "./VitaelRouter.sol";

/// @title VitaelQuoter — read-only price/amount quotes for Vitael DEX V2
/// @notice All functions are view — no state changes, safe to call from frontend
contract VitaelQuoter {
    address public immutable factory;
    address public immutable router;

    constructor(address _factory, address _router) {
        factory = _factory;
        router = _router;
    }

    // ─── Single-hop quotes ────────────────────────────────────────────────────

    /// @notice Quote: how much tokenOut for amountIn of tokenIn?
    function quoteExactInput(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut)
    {
        address pair = VitaelFactory(factory).getPair(tokenIn, tokenOut);
        require(pair != address(0), "VitaelQuoter: PAIR_NOT_FOUND");
        (uint112 r0, uint112 r1,) = VitaelPair(pair).getReserves();
        (address t0,) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
        (uint256 rIn, uint256 rOut) = tokenIn == t0 ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        amountOut = VitaelRouter(router).getAmountOut(amountIn, rIn, rOut);
    }

    /// @notice Quote: how much tokenIn needed to get exact amountOut of tokenOut?
    function quoteExactOutput(address tokenIn, address tokenOut, uint256 amountOut)
        external
        view
        returns (uint256 amountIn)
    {
        address pair = VitaelFactory(factory).getPair(tokenIn, tokenOut);
        require(pair != address(0), "VitaelQuoter: PAIR_NOT_FOUND");
        (uint112 r0, uint112 r1,) = VitaelPair(pair).getReserves();
        (address t0,) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
        (uint256 rIn, uint256 rOut) = tokenIn == t0 ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        amountIn = VitaelRouter(router).getAmountIn(amountOut, rIn, rOut);
    }

    // ─── Multi-hop quotes ─────────────────────────────────────────────────────

    /// @notice Quote multi-hop exact input
    function quoteExactInputMultihop(address[] calldata path, uint256 amountIn)
        external
        view
        returns (uint256[] memory amounts)
    {
        amounts = VitaelRouter(router).getAmountsOut(amountIn, path);
    }

    /// @notice Quote multi-hop exact output
    function quoteExactOutputMultihop(address[] calldata path, uint256 amountOut)
        external
        view
        returns (uint256[] memory amounts)
    {
        amounts = VitaelRouter(router).getAmountsIn(amountOut, path);
    }

    // ─── Pool info ────────────────────────────────────────────────────────────

    struct PoolInfo {
        address pair;
        uint112 reserve0;
        uint112 reserve1;
        address token0;
        address token1;
        uint256 totalSupply;
        uint256 protocolFees0;
        uint256 protocolFees1;
    }

    /// @notice Get full pool info for a token pair
    function getPoolInfo(address tokenA, address tokenB) external view returns (PoolInfo memory info) {
        address pair = VitaelFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "VitaelQuoter: PAIR_NOT_FOUND");
        VitaelPair p = VitaelPair(pair);
        (uint112 r0, uint112 r1,) = p.getReserves();
        info = PoolInfo({
            pair: pair,
            reserve0: r0,
            reserve1: r1,
            token0: p.token0(),
            token1: p.token1(),
            totalSupply: p.totalSupply(),
            protocolFees0: p.protocolFees0(),
            protocolFees1: p.protocolFees1()
        });
    }

    /// @notice Get spot price: how many tokenOut per 1 unit of tokenIn (scaled by 1e18)
    function getSpotPrice(address tokenIn, address tokenOut) external view returns (uint256 price) {
        address pair = VitaelFactory(factory).getPair(tokenIn, tokenOut);
        require(pair != address(0), "VitaelQuoter: PAIR_NOT_FOUND");
        (uint112 r0, uint112 r1,) = VitaelPair(pair).getReserves();
        (address t0,) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
        (uint256 rIn, uint256 rOut) = tokenIn == t0 ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        price = (rOut * 1e18) / rIn;
    }

    /// @notice Get LP token balance and underlying token amounts for a user
    function getLPPosition(address tokenA, address tokenB, address user)
        external
        view
        returns (uint256 lpBalance, uint256 amount0, uint256 amount1)
    {
        address pair = VitaelFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "VitaelQuoter: PAIR_NOT_FOUND");
        VitaelPair p = VitaelPair(pair);
        lpBalance = p.balanceOf(user);
        uint256 supply = p.totalSupply();
        if (supply == 0 || lpBalance == 0) return (lpBalance, 0, 0);
        (uint112 r0, uint112 r1,) = p.getReserves();
        amount0 = (lpBalance * uint256(r0)) / supply;
        amount1 = (lpBalance * uint256(r1)) / supply;
    }
}
