// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function getRoundData(uint80 _roundId)
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @title VitaelOracle
 * @notice Price oracle — Chainlink-compatible feeds (incl. Stork adapters on Arc Testnet).
 */
contract VitaelOracle is Ownable {
    mapping(address => AggregatorV3Interface) public priceFeeds;
    mapping(address => uint256) public maxPriceAge;

    event FeedAdded(address indexed asset, address indexed feed);
    event FeedMaxAgeUpdated(address indexed asset, uint256 maxAge);

    error AssetPriceNotSet(address asset);
    error InvalidPrice();
    error InvalidFeedConfiguration();
    error InvalidPriceTimestamp();
    error StalePrice(address asset);
    error IncompleteRound();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Thêm Chainlink feed cho asset (chỉ owner)
     */
    function addPriceFeed(address asset, address chainlinkFeed, uint256 maxAge) external onlyOwner {
        _setPriceFeed(asset, chainlinkFeed, maxAge);
    }

    /// @notice Replace an existing feed (e.g. migrate mock → Stork).
    function setPriceFeed(address asset, address chainlinkFeed, uint256 maxAge) external onlyOwner {
        _setPriceFeed(asset, chainlinkFeed, maxAge);
    }

    function _setPriceFeed(address asset, address chainlinkFeed, uint256 maxAge) internal {
        if (asset == address(0) || chainlinkFeed.code.length == 0 || maxAge == 0) {
            revert InvalidFeedConfiguration();
        }
        if (AggregatorV3Interface(chainlinkFeed).decimals() > 18) revert InvalidFeedConfiguration();
        priceFeeds[asset] = AggregatorV3Interface(chainlinkFeed);
        maxPriceAge[asset] = maxAge;
        emit FeedAdded(asset, chainlinkFeed);
        emit FeedMaxAgeUpdated(asset, maxAge);
    }

    /**
     * @notice Lấy giá mới nhất (8 decimals, giống Chainlink)
     */
    function getAssetPrice(address asset) external view returns (uint256) {
        AggregatorV3Interface feed = priceFeeds[asset];
        if (address(feed) == address(0)) revert AssetPriceNotSet(asset);

        (uint80 roundId, int256 price,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
        if (price <= 0) revert InvalidPrice();
        if (updatedAt == 0 || updatedAt > block.timestamp) revert InvalidPriceTimestamp();
        if (block.timestamp - updatedAt > maxPriceAge[asset]) revert StalePrice(asset);
        if (roundId == 0 || answeredInRound < roundId) revert IncompleteRound();

        uint8 feedDecimals = feed.decimals();
        if (feedDecimals > 18) revert InvalidFeedConfiguration();
        uint256 normalized = uint256(price);
        if (feedDecimals < 8) {
            uint256 factor = 10 ** (8 - feedDecimals);
            if (normalized > type(uint256).max / factor) revert InvalidPrice();
            normalized *= factor;
        } else if (feedDecimals > 8) {
            normalized /= 10 ** (feedDecimals - 8);
        }
        if (normalized == 0) revert InvalidPrice();
        return normalized;
    }
}
