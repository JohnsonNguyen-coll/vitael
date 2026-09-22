// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelOracle.sol";
import "../src/StorkPriceFeed.sol";
import "../src/LendingConfig.sol";

/**
 * @notice Point VitaelOracle at Stork feeds for Arc tokens (USDC, EURC, cirBTC).
 * @dev Set ORACLE, PRIVATE_KEY (oracle owner) in .env
 *
 * Usage:
 *   forge script script/UpgradeOracleFeeds.s.sol --rpc-url arc_testnet --broadcast --slow -vvvv
 */
contract UpgradeOracleFeeds is Script {
    function run() external {
        address oracleAddr = vm.envAddress("ORACLE");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        VitaelOracle oracle = VitaelOracle(oracleAddr);
        require(oracle.owner() == deployer, "PRIVATE_KEY must be oracle owner");

        vm.startBroadcast(pk);

        address usdcFeed = address(new StorkPriceFeed(LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_USDCUSD));
        address eurcFeed = address(new StorkPriceFeed(LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_EURCUSD));
        address btcFeed = address(new StorkPriceFeed(LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_BTCUSD));

        oracle.addPriceFeed(LendingConfig.USDC, usdcFeed, vm.envUint("ORACLE_USDC_MAX_AGE"));
        oracle.addPriceFeed(LendingConfig.EURC, eurcFeed, vm.envUint("ORACLE_EURC_MAX_AGE"));
        oracle.addPriceFeed(LendingConfig.CIRBTC, btcFeed, vm.envUint("ORACLE_CIRBTC_MAX_AGE"));

        console.log("USDC feed  :", usdcFeed);
        console.log("EURC feed  :", eurcFeed);
        console.log("cirBTC feed:", btcFeed);
        console.log("Oracle feeds updated on", oracleAddr);

        vm.stopBroadcast();
    }
}
