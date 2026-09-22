// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/VitaelOracle.sol";
import "../src/StorkPriceFeed.sol";

contract ControlledStork is IStork {
    function getTemporalNumericValueUnsafeV1(bytes32) external pure returns (StorkStructs.TemporalNumericValue memory) {
        return StorkStructs.TemporalNumericValue({timestampNs: 10000e9, quantizedValue: 60000e18});
    }
}

contract ControlledFeed {
    uint8 public decimals = 8;
    int256 public price = 1e8;
    uint256 public timestamp;
    uint80 public round = 1;
    uint80 public answered = 1;

    function configure(uint8 decimals_, int256 price_, uint256 timestamp_, uint80 round_, uint80 answered_) external {
        decimals = decimals_;
        price = price_;
        timestamp = timestamp_;
        round = round_;
        answered = answered_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (round, price, timestamp, timestamp, answered);
    }
}

contract VitaelOracleTest is Test {
    VitaelOracle oracle;
    ControlledFeed feed;
    address asset = address(0x123);

    function setUp() public {
        vm.warp(10000);
        oracle = new VitaelOracle();
        feed = new ControlledFeed();
        feed.configure(8, 1e8, block.timestamp, 1, 1);
        oracle.addPriceFeed(asset, address(feed), 1 hours);
    }

    function testAgeBoundaryAndRefresh() public {
        vm.warp(13600);
        assertEq(oracle.getAssetPrice(asset), 1e8);
        vm.warp(13601);
        vm.expectRevert(abi.encodeWithSelector(VitaelOracle.StalePrice.selector, asset));
        oracle.getAssetPrice(asset);
        feed.configure(8, 2e8, block.timestamp, 2, 2);
        assertEq(oracle.getAssetPrice(asset), 2e8);
    }

    function testStorkAdapterTimestampAndPrice() public {
        StorkPriceFeed adapter = new StorkPriceFeed(address(new ControlledStork()), bytes32(uint256(1)));
        oracle.setPriceFeed(asset, address(adapter), 1 hours);
        assertEq(oracle.getAssetPrice(asset), 60000e8);
        vm.warp(13601);
        vm.expectRevert(abi.encodeWithSelector(VitaelOracle.StalePrice.selector, asset));
        oracle.getAssetPrice(asset);
    }

    function testRejectZeroAndFutureTimestamps() public {
        feed.configure(8, 1e8, 0, 1, 1);
        vm.expectRevert(VitaelOracle.InvalidPriceTimestamp.selector);
        oracle.getAssetPrice(asset);
        feed.configure(8, 1e8, block.timestamp + 1, 1, 1);
        vm.expectRevert(VitaelOracle.InvalidPriceTimestamp.selector);
        oracle.getAssetPrice(asset);
    }

    function testRejectIncompleteRound() public {
        feed.configure(8, 1e8, block.timestamp, 2, 1);
        vm.expectRevert(VitaelOracle.IncompleteRound.selector);
        oracle.getAssetPrice(asset);
    }

    function testRejectNonPositiveAndRoundedToZeroPrices() public {
        feed.configure(8, 0, block.timestamp, 1, 1);
        vm.expectRevert(VitaelOracle.InvalidPrice.selector);
        oracle.getAssetPrice(asset);
        feed.configure(8, -1, block.timestamp, 1, 1);
        vm.expectRevert(VitaelOracle.InvalidPrice.selector);
        oracle.getAssetPrice(asset);
        feed.configure(18, 1, block.timestamp, 1, 1);
        vm.expectRevert(VitaelOracle.InvalidPrice.selector);
        oracle.getAssetPrice(asset);
    }

    function testNormalizeSixAndEighteenDecimals() public {
        feed.configure(6, 1234567, block.timestamp, 1, 1);
        assertEq(oracle.getAssetPrice(asset), 123456700);
        feed.configure(18, 1234567891234567890, block.timestamp, 1, 1);
        assertEq(oracle.getAssetPrice(asset), 123456789);
    }

    function testRejectInvalidConfigAndUnauthorizedUpdate() public {
        vm.expectRevert(VitaelOracle.InvalidFeedConfiguration.selector);
        oracle.setPriceFeed(asset, address(feed), 0);
        vm.expectRevert(VitaelOracle.InvalidFeedConfiguration.selector);
        oracle.setPriceFeed(asset, address(1234), 1 hours);
        feed.configure(19, 1e8, block.timestamp, 1, 1);
        vm.expectRevert(VitaelOracle.InvalidFeedConfiguration.selector);
        oracle.setPriceFeed(asset, address(feed), 1 hours);
        vm.prank(address(99));
        vm.expectRevert();
        oracle.setPriceFeed(asset, address(feed), 1 hours);
    }

    function testMaxAgeIsPerAsset() public {
        oracle.addPriceFeed(address(456), address(feed), 2 hours);
        vm.warp(13601);
        assertEq(oracle.getAssetPrice(address(456)), 1e8);
        vm.expectRevert(abi.encodeWithSelector(VitaelOracle.StalePrice.selector, asset));
        oracle.getAssetPrice(asset);
    }
}
