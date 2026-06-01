// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VitaelFactory.sol";
import "./VitaelPair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VitaelRouter — swap & liquidity entry point for Vitael DEX V2
/// @notice Token-only router (Arc uses USDC as gas, no ETH wrapping needed)
contract VitaelRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable factory;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "VitaelRouter: EXPIRED");
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "VitaelRouter: ZERO_FACTORY");
        factory = _factory;
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    function _pairFor(address tokenA, address tokenB) internal view returns (address pair) {
        pair = VitaelFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "VitaelRouter: PAIR_NOT_FOUND");
    }

    function _sortTokens(address tokenA, address tokenB)
        internal pure returns (address token0, address token1)
    {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    function _getReserves(address tokenA, address tokenB)
        internal view returns (uint256 reserveA, uint256 reserveB)
    {
        (address token0,) = _sortTokens(tokenA, tokenB);
        (uint112 r0, uint112 r1,) = VitaelPair(_pairFor(tokenA, tokenB)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (r0, r1) : (r1, r0);
    }

    // ─── AMM math ─────────────────────────────────────────────────────────────

    /// @notice Given exact input amount, compute output (0.3% fee)
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public pure returns (uint256 amountOut)
    {
        require(amountIn > 0, "VitaelRouter: INSUFFICIENT_INPUT");
        require(reserveIn > 0 && reserveOut > 0, "VitaelRouter: INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * 997;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee);
    }

    /// @notice Given exact output amount, compute required input (0.3% fee)
    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut)
        public pure returns (uint256 amountIn)
    {
        require(amountOut > 0, "VitaelRouter: INSUFFICIENT_OUTPUT");
        require(reserveIn > 0 && reserveOut > 0, "VitaelRouter: INSUFFICIENT_LIQUIDITY");
        amountIn = (reserveIn * amountOut * 1000) / ((reserveOut - amountOut) * 997) + 1;
    }

    /// @notice Compute output amounts for a multi-hop path
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        public view returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "VitaelRouter: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i; i < path.length - 1; i++) {
            (uint256 rIn, uint256 rOut) = _getReserves(path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], rIn, rOut);
        }
    }

    /// @notice Compute input amounts for a multi-hop path (exact output)
    function getAmountsIn(uint256 amountOut, address[] calldata path)
        public view returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "VitaelRouter: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint256 i = path.length - 1; i > 0; i--) {
            (uint256 rIn, uint256 rOut) = _getReserves(path[i - 1], path[i]);
            amounts[i - 1] = getAmountIn(amounts[i], rIn, rOut);
        }
    }

    // ─── Liquidity ────────────────────────────────────────────────────────────

    function _addLiquidity(
        address tokenA, address tokenB,
        uint256 amountADesired, uint256 amountBDesired,
        uint256 amountAMin, uint256 amountBMin
    ) internal returns (uint256 amountA, uint256 amountB) {
        if (VitaelFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            VitaelFactory(factory).createPair(tokenA, tokenB);
        }
        (uint256 reserveA, uint256 reserveB) = _getReserves(tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = (amountADesired * reserveB) / reserveA;
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "VitaelRouter: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = (amountBDesired * reserveA) / reserveB;
                require(amountAOptimal >= amountAMin, "VitaelRouter: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    /// @notice Add liquidity. Creates pair if it doesn't exist.
    function addLiquidity(
        address tokenA, address tokenB,
        uint256 amountADesired, uint256 amountBDesired,
        uint256 amountAMin, uint256 amountBMin,
        address to, uint256 deadline
    ) external ensure(deadline) nonReentrant returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) = _addLiquidity(
            tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin
        );
        address pair = _pairFor(tokenA, tokenB);
        IERC20(tokenA).safeTransferFrom(msg.sender, pair, amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, pair, amountB);
        liquidity = VitaelPair(pair).mint(to);
    }

    /// @notice Remove liquidity and receive back tokenA + tokenB
    function removeLiquidity(
        address tokenA, address tokenB,
        uint256 liquidity,
        uint256 amountAMin, uint256 amountBMin,
        address to, uint256 deadline
    ) external ensure(deadline) nonReentrant returns (uint256 amountA, uint256 amountB) {
        address pair = _pairFor(tokenA, tokenB);
        IERC20(pair).safeTransferFrom(msg.sender, pair, liquidity);
        (uint256 amount0, uint256 amount1) = VitaelPair(pair).burn(to);
        (address token0,) = _sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, "VitaelRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "VitaelRouter: INSUFFICIENT_B_AMOUNT");
    }

    // ─── Swap ─────────────────────────────────────────────────────────────────

    function _swap(uint256[] memory amounts, address[] memory path, address _to) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = _sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));
            address to = i < path.length - 2
                ? VitaelFactory(factory).getPair(output, path[i + 2])
                : _to;
            VitaelPair(VitaelFactory(factory).getPair(input, output))
                .swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    /// @notice Swap exact input → maximum output
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) nonReentrant returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "VitaelRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            VitaelFactory(factory).getPair(path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, to);
    }

    /// @notice Swap minimum input → exact output
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) nonReentrant returns (uint256[] memory amounts) {
        amounts = getAmountsIn(amountOut, path);
        require(amounts[0] <= amountInMax, "VitaelRouter: EXCESSIVE_INPUT_AMOUNT");
        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            VitaelFactory(factory).getPair(path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, to);
    }
}
