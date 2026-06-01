// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelLendingPool.sol";
import "../src/vUSDC.sol";
import "../src/VitaelOracle.sol";
import "../src/MockERC20.sol";
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

        address usdcFeed = _resolveUsdcFeed(useMock);
        oracle.addPriceFeed(LendingConfig.USDC, usdcFeed);
        console.log("USDC feed:", usdcFeed);

        vUSDC vUsdc = new vUSDC();
        console.log("vUSDC deployed at:", address(vUsdc));

        VitaelLendingPool pool = new VitaelLendingPool(
            LendingConfig.USDC, address(vUsdc), address(oracle)
        );
        console.log("VitaelLendingPool deployed at:", address(pool));

        vUsdc.transferOwnership(address(pool));

        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        MockERC20 wbtc = new MockERC20("Wrapped Bitcoin", "WBTC", 8);
        console.log("WETH:", address(weth));
        console.log("WBTC:", address(wbtc));

        address wethFeed = _resolveCollateralFeed(useMock, LendingConfig.STORK_ETHUSD, 3000 * 1e8);
        address wbtcFeed = _resolveCollateralFeed(useMock, LendingConfig.STORK_BTCUSD, 60000 * 1e8);
        oracle.addPriceFeed(address(weth), wethFeed);
        oracle.addPriceFeed(address(wbtc), wbtcFeed);
        console.log("WETH feed:", wethFeed);
        console.log("WBTC feed:", wbtcFeed);

        pool.addCollateral(address(weth), 8000, 8500, 500, 18);
        pool.addCollateral(address(wbtc), 7000, 7500, 1000, 8);

        vm.stopBroadcast();
    }

    function _resolveUsdcFeed(bool useMock) internal returns (address) {
        address envFeed = vm.envOr("USDC_FEED", address(0));
        if (envFeed != address(0)) return envFeed;
        if (useMock) {
            MockV3Aggregator mock = new MockV3Aggregator(8, 1 * 1e8);
            return address(mock);
        }
        return address(new StorkPriceFeed(LendingConfig.STORK_AGGREGATOR, LendingConfig.STORK_USDCUSD));
    }

    function _resolveCollateralFeed(bool useMock, bytes32 storkId, int256 mockPrice)
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
