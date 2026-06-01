// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal Stork interface (Arc Testnet aggregator).
interface IStork {
    function getTemporalNumericValueUnsafeV1(bytes32 id)
        external
        view
        returns (StorkStructs.TemporalNumericValue memory);
}

library StorkStructs {
    struct TemporalNumericValue {
        uint64 timestampNs;
        int192 quantizedValue;
    }
}
