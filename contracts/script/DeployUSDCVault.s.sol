// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/VitaelLendingPool.sol";
import "../src/vaults/VitaelUSDCVault.sol";

contract DeployUSDCVault is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envOr("USDC_ADDRESS", vm.envAddress("USDC"));
        address lendingPool = vm.envOr("LENDING_POOL_ADDRESS", vm.envAddress("POOL"));
        uint256 depositCap = vm.envOr("VAULT_DEPOSIT_CAP", uint256(10_000e6));

        vm.startBroadcast(deployerKey);
        VitaelUSDCVault vault =
            new VitaelUSDCVault(IERC20(usdc), VitaelLendingPool(lendingPool), depositCap);
        vm.stopBroadcast();

        console.log("VitaelUSDCVault:", address(vault));
        console.log("Deposit cap:", depositCap);
        console.log("NEXT_PUBLIC_USDC_VAULT=", address(vault));
    }
}
