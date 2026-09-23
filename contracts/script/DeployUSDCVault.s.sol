// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/VitaelLendingPool.sol";
import "../src/vaults/VitaelUSDCVault.sol";

contract DeployUSDCVault is Script {
    function run() external {
        require(block.chainid == vm.envUint("DEPLOY_CHAIN_ID"), "Wrong deployment chain");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address lendingPool = vm.envAddress("LENDING_POOL_ADDRESS");
        uint256 depositCap = vm.envOr("VAULT_DEPOSIT_CAP", uint256(10_000e6));

        require(IERC20Metadata(usdc).decimals() == 6, "Wrong USDC decimals");
        require(lendingPool.code.length > 0, "Missing lending pool");
        (bool supported,,,,,,,,,) = VitaelLendingPool(lendingPool).assetConfigs(usdc);
        require(supported, "Pool does not support USDC");
        require(address(VitaelLendingPool(lendingPool).oracle()) == vm.envAddress("ORACLE_ADDRESS"), "Wrong pool oracle");
        VitaelLendingPool(lendingPool).oracle().getAssetPrice(usdc);
        vm.startBroadcast(deployerKey);
        VitaelUSDCVault vault =
            new VitaelUSDCVault(IERC20(usdc), VitaelLendingPool(lendingPool), depositCap);
        vm.stopBroadcast();

        console.log("VitaelUSDCVault:", address(vault));
        console.log("Deposit cap:", depositCap);
        console.log("NEXT_PUBLIC_USDC_VAULT=", address(vault));
    }
}
