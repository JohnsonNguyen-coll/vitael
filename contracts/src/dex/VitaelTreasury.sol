// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VitaelTreasury — receives and manages all protocol fees from Vitael DEX
contract VitaelTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event FeeReceived(address indexed token, uint256 amount, address indexed from);
    event Withdrawn(address indexed token, uint256 amount, address indexed to);

    constructor(address _owner) Ownable(_owner) {}

    /// @notice Called by pairs/router to deposit fee tokens
    function receiveFee(address token, uint256 amount) external nonReentrant {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit FeeReceived(token, amount, msg.sender);
    }

    /// @notice Owner withdraws accumulated fees
    function withdraw(address token, uint256 amount, address to) external onlyOwner nonReentrant {
        require(to != address(0), "VitaelTreasury: ZERO_ADDRESS");
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, amount, to);
    }

    /// @notice Withdraw full balance of a token
    function withdrawAll(address token, address to) external onlyOwner nonReentrant {
        require(to != address(0), "VitaelTreasury: ZERO_ADDRESS");
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(bal > 0, "VitaelTreasury: ZERO_BALANCE");
        IERC20(token).safeTransfer(to, bal);
        emit Withdrawn(token, bal, to);
    }

    /// @notice View balance of any token held by treasury
    function balance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
