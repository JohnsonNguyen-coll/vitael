// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IStork.sol";
import "./VitaelOracle.sol";

/// @notice Chainlink-compatible feed (8 decimals) backed by Stork on Arc Testnet.
/// @dev Stork quantizedValue uses 18 decimals (fixed-point int192).
///      We scale down to 8 decimals to match Chainlink convention.
///      timestampNs is nanoseconds — we convert to seconds for updatedAt
///      so downstream staleness checks work correctly.
contract StorkPriceFeed is AggregatorV3Interface {
    IStork public immutable stork;
    bytes32 public immutable priceId;

    constructor(address storkAggregator, bytes32 storkPriceId) {
        stork = IStork(storkAggregator);
        priceId = storkPriceId;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function description() external pure returns (string memory) {
        return "Vitael Stork price feed";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function _scaledAnswer() internal view returns (int256) {
        int192 raw = stork.getTemporalNumericValueUnsafeV1(priceId).quantizedValue;
        require(raw > 0, "invalid price");
        // Stork: 18-decimal fixed-point → divide by 1e10 to get 8-decimal Chainlink price
        return int256(raw) / int256(1e10);
    }

    /// @dev Convert Stork nanosecond timestamp to seconds for Chainlink-compatible updatedAt.
    function _nsToSeconds(uint64 timestampNs) internal pure returns (uint256) {
        return uint256(timestampNs) / 1e9;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        StorkStructs.TemporalNumericValue memory v = stork.getTemporalNumericValueUnsafeV1(priceId);
        require(v.quantizedValue > 0, "invalid price");
        int256 scaled = int256(v.quantizedValue) / int256(1e10);
        uint256 ts    = _nsToSeconds(v.timestampNs);
        // Use lower 80 bits of timestampNs as a monotonic round ID
        roundId         = uint80(v.timestampNs);
        answer          = scaled;
        startedAt       = ts;
        updatedAt       = ts;   // seconds — safe for staleness checks
        answeredInRound = roundId;
    }

    function latestAnswer() external view returns (int256) {
        return _scaledAnswer();
    }

    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        StorkStructs.TemporalNumericValue memory v = stork.getTemporalNumericValueUnsafeV1(priceId);
        require(v.quantizedValue > 0, "invalid price");
        int256 scaled = int256(v.quantizedValue) / int256(1e10);
        uint256 ts    = _nsToSeconds(v.timestampNs);
        roundId         = _roundId;
        answer          = scaled;
        startedAt       = ts;
        updatedAt       = ts;
        answeredInRound = _roundId;
    }
}
