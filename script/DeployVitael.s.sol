// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelLendingPool.sol";
import "../src/vUSDC.sol";
import "../src/VitaelOracle.sol";
import "../src/MockV3Aggregator.sol";
import "../src/StorkPriceFeed.sol";
import "../src/LendingConfig.sol";

contract DeployVitael is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        bool useMock = vm.envOr("USE_MOCK_FEEDS", false);

        vm.startBroadcast(deployerPrivateKey);

        VitaelOracle oracle = new VitaelOracle();
        console.log("VitaelOracle deployed at:", address(oracle));

        address usdcFeed = _resolveFeed(useMock, LendingConfig.STORK_USDCUSD, 1 * 1e8);
        address eurcFeed = _resolveFeed(useMock, LendingConfig.STORK_EURUSD, 108 * 1e6);
        address btcFeed  = _resolveFeed(useMock, LendingConfig.STORK_BTCUSD, 60000 * 1e8);

        oracle.addPriceFeed(LendingConfig.USDC, usdcFeed);
        oracle.addPriceFeed(LendingConfig.EURC, eurcFeed);
        oracle.addPriceFeed(LendingConfig.CIRBTC, btcFeed);
        console.log("USDC feed:", usdcFeed);
        console.log("EURC feed:", eurcFeed);
        console.log("cirBTC feed:", btcFeed);

        vUSDC vUsdc = new vUSDC();
        console.log("vUSDC deployed at:", address(vUsdc));

        VitaelLendingPool pool = new VitaelLendingPool(
            LendingConfig.USDC, address(vUsdc), address(oracle)
        );
        console.log("VitaelLendingPool deployed at:", address(pool));

        vUsdc.transferOwnership(address(pool));

        // Arc-native collateral (borrow USDC against these)
        pool.addCollateral(LendingConfig.EURC, 8000, 8500, 500, 6);
        pool.addCollateral(LendingConfig.CIRBTC, 7000, 7500, 1000, 8);
        pool.addCollateral(LendingConfig.USDC, 8500, 9000, 500, 6);

        console.log("EURC:", LendingConfig.EURC);
        console.log("cirBTC:", LendingConfig.CIRBTC);
        console.log("USDC (collateral):", LendingConfig.USDC);

        vm.stopBroadcast();
    }

    function _resolveFeed(bool useMock, bytes32 storkId, int256 mockPrice)
        internal
        returns (address)
    {
        if (useMock) {
            MockV3Aggregator mock = new MockV3Aggregator(8, mockPrice);
            return address(mock);
        }
        return address(new StorkPriceFeed(LendingConfig.STORK_AGGREGATOR, storkId));
    }
}
