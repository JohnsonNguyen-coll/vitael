// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelLendingPool.sol";
import "../src/VitaelOracle.sol";
import "../src/StorkPriceFeed.sol";
import "../src/LendingConfig.sol";

/**
 * @notice Register Arc tokens + Stork feeds on an existing pool/oracle.
 * @dev Set POOL, ORACLE, PRIVATE_KEY (pool owner) in .env
 *
 * Usage:
 *   forge script script/UpgradeArcCollateral.s.sol --rpc-url arc_testnet --broadcast --slow -vvvv
 */
contract UpgradeArcCollateral is Script {
    function run() external {
        address poolAddr = vm.envAddress("POOL");
        address oracleAddr = vm.envAddress("ORACLE");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        VitaelLendingPool pool = VitaelLendingPool(poolAddr);
        VitaelOracle oracle = VitaelOracle(oracleAddr);

        require(pool.owner() == deployer, "PRIVATE_KEY must be pool owner");
        require(oracle.owner() == deployer, "PRIVATE_KEY must be oracle owner");

        vm.startBroadcast(pk);

        address usdcFeed = address(new StorkPriceFeed(LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_USDCUSD));
        address eurcFeed = address(new StorkPriceFeed(LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_EURCUSD));
        address btcFeed = address(new StorkPriceFeed(LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_BTCUSD));

        oracle.addPriceFeed(LendingConfig.USDC, usdcFeed);
        oracle.addPriceFeed(LendingConfig.EURC, eurcFeed);
        oracle.addPriceFeed(LendingConfig.CIRBTC, btcFeed);

        pool.addAsset(LendingConfig.USDC, 6, 9000, 9200, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        pool.addAsset(LendingConfig.EURC, 6, 8500, 8800, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        pool.addAsset(LendingConfig.CIRBTC, 8, 7000, 7500, 1000, 2e16, 8e17, 4e16, 75e16, 1000);

        console.log("Feeds + assets registered on pool", poolAddr);
        console.log("USDC feed  :", usdcFeed);
        console.log("EURC feed  :", eurcFeed);
        console.log("cirBTC feed:", btcFeed);

        vm.stopBroadcast();
    }
}
