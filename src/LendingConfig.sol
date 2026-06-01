// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Shared Arc Testnet addresses for lending deploy / upgrade scripts.
library LendingConfig {
    address internal constant USDC = 0x3600000000000000000000000000000000000000;

    /// @dev Stork aggregator on Arc Testnet — https://docs.stork.network/resources/contract-addresses/evm
    address internal constant STORK_AGGREGATOR = 0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62;

    // Asset IDs — https://docs.stork.network/resources/asset-id-registry
    bytes32 internal constant STORK_USDCUSD = 0x7416a56f222e196d0487dce8a1a8003936862e7a15092a91898d69fa8bce290c;
    bytes32 internal constant STORK_ETHUSD  = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;
    bytes32 internal constant STORK_BTCUSD  = 0x7404e3d104ea7841c3d9e6fd20adfe99b4ad586bc08d8f3bd3afef894cf184de;
}
