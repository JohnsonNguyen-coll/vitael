// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelLendingPool.sol";
import "../src/VitaelOracle.sol";
import "../src/StorkPriceFeed.sol";
import "../src/LendingConfig.sol";

/// @notice Add Arc tokens (EURC, cirBTC, USDC) + Stork feeds to an existing pool/oracle.
/// @dev Set POOL, ORACLE, PRIVATE_KEY (pool owner) in .env
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

        StorkPriceFeed usdcFeed = new StorkPriceFeed(
            LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_USDCUSD
        );
        StorkPriceFeed eurcFeed = new StorkPriceFeed(
            LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_EURUSD
        );
        StorkPriceFeed btcFeed = new StorkPriceFeed(
            LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_BTCUSD
        );

        oracle.addPriceFeed(LendingConfig.USDC, address(usdcFeed));
        oracle.addPriceFeed(LendingConfig.EURC, address(eurcFeed));
        oracle.addPriceFeed(LendingConfig.CIRBTC, address(btcFeed));

        pool.addCollateral(LendingConfig.EURC, 8000, 8500, 500, 6);
        pool.addCollateral(LendingConfig.CIRBTC, 7000, 7500, 1000, 8);
        pool.addCollateral(LendingConfig.USDC, 8500, 9000, 500, 6);

        console.log("Stork feeds + Arc collateral registered on pool", poolAddr);

        vm.stopBroadcast();
    }
}
