// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelLendingPool.sol";
import "../src/VitaelOracle.sol";

/// @notice Arc mainnet deployment using Chainlink Standard proxies configured in the environment.
contract DeployVitaelMainnet is Script {
    function run() external {
        require(block.chainid == 5042, "Expected Arc mainnet (5042)");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address eurc = vm.envAddress("EURC_ADDRESS");
        address btc = vm.envAddress("CIRBTC_ADDRESS");
        address usdcFeed = vm.envAddress("USDC_PRICE_FEED");
        address eurcFeed = vm.envAddress("EURC_PRICE_FEED");
        address btcFeed = vm.envAddress("CIRBTC_PRICE_FEED");
        uint256 usdcAge = vm.envUint("ORACLE_USDC_MAX_AGE");
        uint256 eurcAge = vm.envUint("ORACLE_EURC_MAX_AGE");
        uint256 btcAge = vm.envUint("ORACLE_CIRBTC_MAX_AGE");
        require(usdc != eurc && usdc != btc && eurc != btc, "Duplicate assets");
        require(IERC20Metadata(usdc).decimals() == 6, "Wrong USDC decimals");
        require(IERC20Metadata(eurc).decimals() == 6, "Wrong EURC decimals");
        require(IERC20Metadata(btc).decimals() == 8, "Wrong cirBTC decimals");
        _check(usdcFeed, "USDC / USD", usdcAge);
        _check(eurcFeed, "EURC / USD", eurcAge);
        _check(btcFeed, "BTC / USD", btcAge);
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // 1. Oracle
        VitaelOracle oracle = new VitaelOracle();
        console.log("VitaelOracle:", address(oracle));

        oracle.addPriceFeed(usdc, usdcFeed, usdcAge);
        oracle.addPriceFeed(eurc, eurcFeed, eurcAge);
        oracle.addPriceFeed(btc, btcFeed, btcAge);
        oracle.getAssetPrice(usdc);
        oracle.getAssetPrice(eurc);
        oracle.getAssetPrice(btc);
        console.log("USDC feed  :", usdcFeed);
        console.log("EURC feed  :", eurcFeed);
        console.log("cirBTC feed:", btcFeed);

        // 3. Lending pool
        VitaelLendingPool pool = new VitaelLendingPool(address(oracle));
        console.log("VitaelLendingPool:", address(pool));

        // 4. Register assets
        //    addAsset(asset, decimals, ltv, liqThreshold, liqBonus,
        //             baseRate, optimalUtil, slope1, slope2, reserveFactor)
        pool.addAsset(usdc, 6, 9000, 9200, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        pool.addAsset(eurc, 6, 8500, 8800, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        pool.addAsset(btc, 8, 7000, 7500, 1000, 2e16, 8e17, 4e16, 75e16, 1000);

        console.log("Assets registered: USDC, EURC, cirBTC");
        console.log("---");
        console.log("NEXT_PUBLIC_LENDING_POOL=", address(pool));
        console.log("NEXT_PUBLIC_ORACLE=", address(oracle));

        vm.stopBroadcast();
    }

    function _check(address feed, string memory expected, uint256 maxAge) internal view {
        require(maxAge > 0, "Missing max age");
        AggregatorV3Interface agg = AggregatorV3Interface(feed);
        require(agg.decimals() == 8, "Unexpected feed decimals");
        require(keccak256(bytes(agg.description())) == keccak256(bytes(expected)), "Wrong feed pair");
        (uint80 round, int256 answer,, uint256 updated, uint80 answered) = agg.latestRoundData();
        require(round > 0 && answered >= round && answer > 0, "Invalid feed round");
        require(updated > 0 && updated <= block.timestamp, "Invalid timestamp");
        require(block.timestamp - updated <= maxAge, "Stale feed");
    }
}
