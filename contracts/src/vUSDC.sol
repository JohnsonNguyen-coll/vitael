// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title vUSDC
 * @notice Interest-bearing token representing shares of supplied USDC in the Vitael Lending Protocol.
 * @dev Inherits standard ERC20 and ERC20Permit, using 6 decimals to match the underlying USDC token.
 */
contract vUSDC is ERC20, ERC20Permit, Ownable {
    constructor()
        ERC20("Vitael Interest Bearing USDC", "vUSDC")
        ERC20Permit("Vitael Interest Bearing USDC")
        Ownable(msg.sender)
    {}

    /**
     * @notice Overrides decimals to match USDC (6 decimals).
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @notice Mint vUSDC to a receiver. Only owner (VitaelLendingPool) can call.
     * @param to The address of the receiver.
     * @param amount The amount of vUSDC to mint.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Burn vUSDC from a holder. Only owner (VitaelLendingPool) can call.
     * @param from The address of the holder.
     * @param amount The amount of vUSDC to burn.
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}
