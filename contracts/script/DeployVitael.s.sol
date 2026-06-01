// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelLendingPool.sol";
import "../src/VitaelOracle.sol";
import "../src/MockV3Aggregator.sol";
import "../src/StorkPriceFeed.sol";
import "../src/LendingConfig.sol";

/**
 * @title DeployVitael
 * @notice Deploy VitaelLendingPool (multi-asset) on Arc Testnet.
 *
 * Usage:
 *   # Live Stork feeds:
 *   forge script script/DeployVitael.s.sol --rpc-url arc_testnet --broadcast --slow -vvvv
 *
 *   # Mock feeds (local / CI):
 *   USE_MOCK_FEEDS=true forge script script/DeployVitael.s.sol --rpc-url arc_testnet --broadcast -vvvv
 */
contract DeployVitael is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        bool useMock = vm.envOr("USE_MOCK_FEEDS", false);

        vm.startBroadcast(deployerKey);

        // 1. Oracle
        VitaelOracle oracle = new VitaelOracle();
        console.log("VitaelOracle:", address(oracle));

        // 2. Price feeds — all three via Stork (EURC/USD is supported)
        address usdcFeed = _feed(useMock, LendingConfig.STORK_USDCUSD, 1_00000000); // $1.00
        address eurcFeed = _feed(useMock, LendingConfig.STORK_EURCUSD, 1_08000000); // $1.08
        address btcFeed = _feed(useMock, LendingConfig.STORK_BTCUSD, 60000_00000000); // $60 000

        oracle.addPriceFeed(LendingConfig.USDC, usdcFeed);
        oracle.addPriceFeed(LendingConfig.EURC, eurcFeed);
        oracle.addPriceFeed(LendingConfig.CIRBTC, btcFeed);
        console.log("USDC feed  :", usdcFeed);
        console.log("EURC feed  :", eurcFeed);
        console.log("cirBTC feed:", btcFeed);

        // 3. Lending pool
        VitaelLendingPool pool = new VitaelLendingPool(address(oracle));
        console.log("VitaelLendingPool:", address(pool));

        // 4. Register assets
        //    addAsset(asset, decimals, ltv, liqThreshold, liqBonus,
        //             baseRate, optimalUtil, slope1, slope2, reserveFactor)
        pool.addAsset(LendingConfig.USDC, 6, 9000, 9200, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        pool.addAsset(LendingConfig.EURC, 6, 8500, 8800, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        pool.addAsset(LendingConfig.CIRBTC, 8, 7000, 7500, 1000, 2e16, 8e17, 4e16, 75e16, 1000);

        console.log("Assets registered: USDC, EURC, cirBTC");
        console.log("---");
        console.log("NEXT_PUBLIC_LENDING_POOL=", address(pool));
        console.log("NEXT_PUBLIC_ORACLE=", address(oracle));

        vm.stopBroadcast();
    }

    function _feed(bool useMock, bytes32 storkId, int256 mockPrice) internal returns (address) {
        if (useMock) return address(new MockV3Aggregator(8, mockPrice));
        return address(new StorkPriceFeed(LendingConfig.STORK_AGGREGATOR, storkId));
    }
}
