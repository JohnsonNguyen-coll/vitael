// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/dex/v3/VitaelTreasury.sol";
import "../src/dex/v3/VitaelFactory.sol";
import "../src/dex/v3/VitaelRouter.sol";
import "../src/dex/v3/VitaelQuoter.sol";
import "../src/dex/v3/VitaelNFTPositionManager.sol";

/// @title DeployVitaelDEX
/// @notice Deploys the full VitaelDEX V3 suite on Arc Network (Chain ID: 5042002)
contract DeployVitaelDEX is Script {
    // Arc Network token addresses (update before mainnet deploy)
    // These are placeholder addresses — replace with actual deployed token addresses
    address constant USDC  = 0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9;
    address constant EURC  = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // sqrtPriceX96 for price = 1.0 (1 USDC = 1 EURC)
    // sqrt(1) * 2^96 = 2^96 = 79228162514264337593543950336
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying VitaelDEX V3 on Arc Network (Chain ID: 5042002)");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy VitaelTreasury
        VitaelTreasury treasury = new VitaelTreasury(deployer);
        console.log("VitaelTreasury deployed at:", address(treasury));

        // 2. Deploy VitaelFactory
        VitaelFactory vitaelFactory = new VitaelFactory(address(treasury));
        console.log("VitaelFactory deployed at:", address(vitaelFactory));

        // 3. Deploy VitaelRouter
        VitaelRouter router = new VitaelRouter(address(vitaelFactory));
        console.log("VitaelRouter deployed at:", address(router));

        // 4. Deploy VitaelQuoter
        VitaelQuoter quoter = new VitaelQuoter(address(vitaelFactory));
        console.log("VitaelQuoter deployed at:", address(quoter));

        // 5. Deploy VitaelNFTPositionManager
        VitaelNFTPositionManager nftManager = new VitaelNFTPositionManager(address(vitaelFactory));
        console.log("VitaelNFTPositionManager deployed at:", address(nftManager));

        // 6. Create USDC/EURC pool at fee tier 3000 (0.3%)
        address poolAddress = vitaelFactory.createPool(USDC, EURC, 3000);
        console.log("USDC/EURC pool (0.3%) deployed at:", poolAddress);

        // 7. Initialize pool at price = 1.0 (1 USDC = 1 EURC)
        // sqrtPriceX96 = sqrt(1.0) * 2^96 = 79228162514264337593543950336
        IVitaelPool(poolAddress).initialize(SQRT_PRICE_1_1);
        console.log("Pool initialized at sqrtPriceX96:", SQRT_PRICE_1_1);

        vm.stopBroadcast();

        // 8. Log summary
        console.log("\n=== VitaelDEX V3 Deployment Summary ===");
        console.log("Network:                Arc Network (Chain ID: 5042002)");
        console.log("VitaelTreasury:        ", address(treasury));
        console.log("VitaelFactory:         ", address(vitaelFactory));
        console.log("VitaelRouter:          ", address(router));
        console.log("VitaelQuoter:          ", address(quoter));
        console.log("VitaelNFTPositionMgr:  ", address(nftManager));
        console.log("USDC/EURC Pool (0.3%): ", poolAddress);
        console.log("========================================");
    }
}
