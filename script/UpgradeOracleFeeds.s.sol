// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelOracle.sol";
import "../src/StorkPriceFeed.sol";
import "../src/LendingConfig.sol";

/// @notice Point an existing VitaelOracle at Stork-backed feeds (no pool redeploy).
/// @dev Requires oracle owner key. Set ORACLE in .env to 0x9bbe6cfa1ce9dcefd45bebbf925e8a6a0c047c49
contract UpgradeOracleFeeds is Script {
    function run() external {
        address oracleAddr = vm.envAddress("ORACLE");
        address weth = vm.envAddress("WETH");
        address wbtc = vm.envAddress("WBTC");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        VitaelOracle oracle = VitaelOracle(oracleAddr);

        address owner = oracle.owner();
        console.log("Oracle owner:", owner);
        console.log("Broadcast from:", deployer);
        require(owner == deployer, "PRIVATE_KEY must be oracle owner");

        vm.startBroadcast(pk);

        StorkPriceFeed usdcFeed = new StorkPriceFeed(
            LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_USDCUSD
        );
        StorkPriceFeed wethFeed = new StorkPriceFeed(
            LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_ETHUSD
        );
        StorkPriceFeed wbtcFeed = new StorkPriceFeed(
            LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_BTCUSD
        );

        console.log("Stork USDC feed:", address(usdcFeed));
        console.log("Stork WETH feed:", address(wethFeed));
        console.log("Stork WBTC feed:", address(wbtcFeed));

        // addPriceFeed overwrites existing mapping entries (same as setPriceFeed on newer oracle)
        oracle.addPriceFeed(LendingConfig.USDC, address(usdcFeed));
        oracle.addPriceFeed(weth, address(wethFeed));
        oracle.addPriceFeed(wbtc, address(wbtcFeed));

        console.log("Oracle feeds updated to Stork on", oracleAddr);

        vm.stopBroadcast();
    }
}
