// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function getRoundData(
        uint80 _roundId
    ) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
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

    event FeedAdded(address indexed asset, address indexed feed);

    error AssetPriceNotSet(address asset);
    error InvalidPrice();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Thêm Chainlink feed cho asset (chỉ owner)
     */
    function addPriceFeed(address asset, address chainlinkFeed) external onlyOwner {
        priceFeeds[asset] = AggregatorV3Interface(chainlinkFeed);
        emit FeedAdded(asset, chainlinkFeed);
    }

    /// @notice Replace an existing feed (e.g. migrate mock → Stork).
    function setPriceFeed(address asset, address chainlinkFeed) external onlyOwner {
        priceFeeds[asset] = AggregatorV3Interface(chainlinkFeed);
        emit FeedAdded(asset, chainlinkFeed);
    }

    /**
     * @notice Lấy giá mới nhất (8 decimals, giống Chainlink)
     */
    function getAssetPrice(address asset) external view returns (uint256) {
        AggregatorV3Interface feed = priceFeeds[asset];
        if (address(feed) == address(0)) revert AssetPriceNotSet(asset);

        (, int256 price,,,) = feed.latestRoundData();

        if (price <= 0) revert InvalidPrice();
        return uint256(price); // Chainlink trả về 8 decimals
    }
}
