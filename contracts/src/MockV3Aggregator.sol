// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./VitaelOracle.sol"; // imports AggregatorV3Interface

contract MockV3Aggregator is AggregatorV3Interface {
    int256 private _price;
    uint8 private _decimals;

    constructor(uint8 decimals_, int256 price_) {
        _decimals = decimals_;
        _price = price_;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external pure override returns (string memory) {
        return "MockV3Aggregator";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80) external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (0, _price, 0, 0, 0);
    }

    function latestRoundData() external view override returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        return (0, _price, 0, 0, 0);
    }

    function updatePrice(int256 newPrice) external {
        _price = newPrice;
    }
}
