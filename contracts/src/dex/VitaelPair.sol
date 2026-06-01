// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./VitaelFactory.sol";

/// @title VitaelPair — AMM pair with protocol fee routing to Treasury
/// @notice Swap fee = 0.3% total. protocolFeeBps portion goes to Treasury, rest stays for LPs.
contract VitaelPair is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    address public factory;
    address public token0;
    address public token1;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    // Accumulated protocol fees (claimable by treasury)
    uint256 public protocolFees0;
    uint256 public protocolFees1;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);
    event ProtocolFeeCollected(uint256 fee0, uint256 fee1, address treasury);

    constructor() ERC20("Vitael LP", "VLP") {
        factory = msg.sender;
    }

    function initialize(address _token0, address _token1) external {
        require(msg.sender == factory, "VitaelPair: FORBIDDEN");
        token0 = _token0;
        token1 = _token1;
    }

    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    function _update(uint256 balance0, uint256 balance1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "VitaelPair: OVERFLOW");
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = uint32(block.timestamp);
        emit Sync(reserve0, reserve1);
    }

    // ─── Mint (Add Liquidity) ─────────────────────────────────────────────────

    function mint(address to) external nonReentrant returns (uint256 liquidity) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - _reserve0;
        uint256 amount1 = balance1 - _reserve1;

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0xdead), MINIMUM_LIQUIDITY);
        } else {
            liquidity = Math.min((amount0 * _totalSupply) / _reserve0, (amount1 * _totalSupply) / _reserve1);
        }
        require(liquidity > 0, "VitaelPair: INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);
        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);
    }

    // ─── Burn (Remove Liquidity) ──────────────────────────────────────────────

    function burn(address to) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 liquidity = balanceOf(address(this));

        uint256 _totalSupply = totalSupply();
        amount0 = (liquidity * balance0) / _totalSupply;
        amount1 = (liquidity * balance1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "VitaelPair: INSUFFICIENT_LIQUIDITY_BURNED");

        _burn(address(this), liquidity);
        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);
        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
        emit Burn(msg.sender, amount0, amount1, to);
    }

    // ─── Swap ─────────────────────────────────────────────────────────────────

    /// @notice Execute swap. Router sends input tokens first, then calls this.
    /// @dev Total fee = 0.3%. Protocol portion (protocolFeeBps/1000 of input) goes to treasury.
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata) external nonReentrant {
        require(amount0Out > 0 || amount1Out > 0, "VitaelPair: INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1, "VitaelPair: INSUFFICIENT_LIQUIDITY");
        require(to != token0 && to != token1, "VitaelPair: INVALID_TO");

        // CEI: send output first
        if (amount0Out > 0) IERC20(token0).safeTransfer(to, amount0Out);
        if (amount1Out > 0) IERC20(token1).safeTransfer(to, amount1Out);

        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "VitaelPair: INSUFFICIENT_INPUT_AMOUNT");

        // k invariant with 0.3% fee
        uint256 balance0Adjusted = balance0 * 1000 - amount0In * 3;
        uint256 balance1Adjusted = balance1 * 1000 - amount1In * 3;
        require(
            balance0Adjusted * balance1Adjusted >= uint256(_reserve0) * uint256(_reserve1) * 1_000_000, "VitaelPair: K"
        );

        // Route protocol fee portion to treasury
        _collectProtocolFee(amount0In, amount1In);

        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    /// @dev Accumulate protocol fees; treasury pulls them via collectFees()
    function _collectProtocolFee(uint256 amount0In, uint256 amount1In) private {
        uint256 feeBps = VitaelFactory(factory).protocolFeeBps();
        if (feeBps == 0) return;
        if (amount0In > 0) protocolFees0 += (amount0In * feeBps) / 10_000;
        if (amount1In > 0) protocolFees1 += (amount1In * feeBps) / 10_000;
    }

    /// @notice Push accumulated protocol fees to treasury. Callable by anyone.
    function collectProtocolFees() external nonReentrant {
        address treas = VitaelFactory(factory).treasury();
        require(treas != address(0), "VitaelPair: NO_TREASURY");

        uint256 fee0 = protocolFees0;
        uint256 fee1 = protocolFees1;
        if (fee0 == 0 && fee1 == 0) return;

        protocolFees0 = 0;
        protocolFees1 = 0;

        if (fee0 > 0) IERC20(token0).safeTransfer(treas, fee0);
        if (fee1 > 0) IERC20(token1).safeTransfer(treas, fee1);

        // Update reserves after fee transfer
        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
        emit ProtocolFeeCollected(fee0, fee1, treas);
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    function skim(address to) external nonReentrant {
        IERC20(token0).safeTransfer(to, IERC20(token0).balanceOf(address(this)) - reserve0);
        IERC20(token1).safeTransfer(to, IERC20(token1).balanceOf(address(this)) - reserve1);
    }

    function sync() external nonReentrant {
        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
    }
}
