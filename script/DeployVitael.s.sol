// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelLendingPool.sol";
import "../src/vUSDC.sol";
import "../src/VitaelOracle.sol";
import "../src/MockERC20.sol";
import "../src/MockV3Aggregator.sol";

contract DeployVitael is Script {
    // USDC system contract on Arc Testnet
    address public constant USDC_ADDRESS = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Oracle
        VitaelOracle oracle = new VitaelOracle();
        console.log("VitaelOracle deployed at:", address(oracle));

        // 2. Setup USDC Price Feed
        address usdcFeed = vm.envOr("USDC_FEED", address(0));
        if (usdcFeed == address(0)) {
            MockV3Aggregator mockFeed = new MockV3Aggregator(8, 1 * 1e8);
            usdcFeed = address(mockFeed);
            console.log("Deployed Mock USDC Price Feed at:", usdcFeed);
        }
        oracle.addPriceFeed(USDC_ADDRESS, usdcFeed);
        console.log("USDC Price Feed registered in Oracle");

        // 3. Deploy vUSDC (Interest-bearing token)
        vUSDC vUsdc = new vUSDC();
        console.log("vUSDC deployed at:", address(vUsdc));

        // 4. Deploy VitaelLendingPool
        VitaelLendingPool pool = new VitaelLendingPool(USDC_ADDRESS, address(vUsdc), address(oracle));
        console.log("VitaelLendingPool deployed at:", address(pool));

        // 5. Transfer vUSDC ownership to LendingPool
        vUsdc.transferOwnership(address(pool));
        console.log("vUSDC ownership transferred to LendingPool");

        // 6. Deploy Mock Collateral Tokens for testnet convenience
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        MockERC20 wbtc = new MockERC20("Wrapped Bitcoin", "WBTC", 8);
        console.log("Mock WETH deployed at:", address(weth));
        console.log("Mock WBTC deployed at:", address(wbtc));

        // 7. Setup Price Feeds for WETH and WBTC
        address wethFeed = vm.envOr("WETH_FEED", address(0));
        if (wethFeed == address(0)) {
            MockV3Aggregator mockFeed = new MockV3Aggregator(8, 3000 * 1e8);
            wethFeed = address(mockFeed);
            console.log("Deployed Mock WETH Price Feed at:", wethFeed);
        }
        oracle.addPriceFeed(address(weth), wethFeed);

        address wbtcFeed = vm.envOr("WBTC_FEED", address(0));
        if (wbtcFeed == address(0)) {
            MockV3Aggregator mockFeed = new MockV3Aggregator(8, 60000 * 1e8);
            wbtcFeed = address(mockFeed);
            console.log("Deployed Mock WBTC Price Feed at:", wbtcFeed);
        }
        oracle.addPriceFeed(address(wbtc), wbtcFeed);
        console.log("Price Feeds registered for WETH and WBTC");

        // 8. Add Collaterals to LendingPool
        pool.addCollateral(address(weth), 8000, 8500, 500, 18);  // LTV 80%, Liq Threshold 85%, Liq Bonus 5%
        pool.addCollateral(address(wbtc), 7000, 7500, 1000, 8);   // LTV 70%, Liq Threshold 75%, Liq Bonus 10%
        console.log("Collateral assets registered in LendingPool");

        vm.stopBroadcast();
    }
}
