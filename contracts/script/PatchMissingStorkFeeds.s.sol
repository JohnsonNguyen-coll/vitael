// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelOracle.sol";
import "../src/MockV3Aggregator.sol";
import "../src/LendingConfig.sol";

/// @notice Testnet workaround when Stork has no on-chain USDCUSD / EURUSD yet.
/// @dev Keeps cirBTC on Stork; sets mock Chainlink-style feeds for USDC + EURC.
/// Run: forge script script/PatchMissingStorkFeeds.s.sol --rpc-url $ARC_RPC --broadcast
contract PatchMissingStorkFeeds is Script {
    function run() external {
        address oracleAddr = vm.envAddress("ORACLE");
        VitaelOracle oracle = VitaelOracle(oracleAddr);

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        MockV3Aggregator usdcMock = new MockV3Aggregator(8, 1e8); // $1.00
        MockV3Aggregator eurcMock = new MockV3Aggregator(8, 108_000_000); // ~$1.08

        oracle.setPriceFeed(LendingConfig.USDC, address(usdcMock));
        oracle.setPriceFeed(LendingConfig.EURC, address(eurcMock));

        vm.stopBroadcast();

        console.log("USDC mock feed:", address(usdcMock));
        console.log("EURC mock feed:", address(eurcMock));
        console.log("cirBTC unchanged (Stork BTCUSD)");
    }
}
