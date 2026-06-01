// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IStork.sol";
import "./VitaelOracle.sol";

/// @notice Chainlink-compatible feed (8 decimals) backed by Stork on Arc Testnet.
/// @dev Stork quantized values use 18 decimals; VitaelLendingPool expects Chainlink-style 8 decimals.
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
        return int256(raw) / 1e10;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        StorkStructs.TemporalNumericValue memory v = stork.getTemporalNumericValueUnsafeV1(priceId);
        int256 scaled = int256(v.quantizedValue) / 1e10;
        require(scaled > 0, "invalid price");
        roundId = uint80(v.timestampNs);
        answer = scaled;
        startedAt = v.timestampNs;
        updatedAt = v.timestampNs;
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
        int256 scaled = int256(v.quantizedValue) / 1e10;
        require(scaled > 0, "invalid price");
        roundId = _roundId;
        answer = scaled;
        startedAt = v.timestampNs;
        updatedAt = v.timestampNs;
        answeredInRound = _roundId;
    }
}
