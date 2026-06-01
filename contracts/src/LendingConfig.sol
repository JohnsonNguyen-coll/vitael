// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Shared Arc Testnet addresses for lending deploy / upgrade scripts.
library LendingConfig {
    /// @dev Native USDC on Arc Testnet (6 decimals)
    address internal constant USDC = 0x3600000000000000000000000000000000000000;
    /// @dev Circle Euro Coin on Arc Testnet (6 decimals)
    address internal constant EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    /// @dev Circle BTC on Arc Testnet (8 decimals)
    address internal constant CIRBTC = 0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF;

    /// @dev Stork aggregator on Arc Testnet — https://docs.stork.network/resources/contract-addresses/evm
    address internal constant STORK_AGGREGATOR = 0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62;

    // Asset IDs = keccak256(asset_id_string)
    // Verified: keccak256("USDCUSD") keccak256("EURCUSD") keccak256("BTCUSD")
    bytes32 internal constant STORK_USDCUSD = 0x7416a56f222e196d0487dce8a1a8003936862e7a15092a91898d69fa8bce290c;
    bytes32 internal constant STORK_EURCUSD = 0x64ffe1382a02f37d4e16872cde1e7379679aa83bba98d99036921942203afafb;
    bytes32 internal constant STORK_BTCUSD  = 0x7404e3d104ea7841c3d9e6fd20adfe99b4ad586bc08d8f3bd3afef894cf184de;
}
