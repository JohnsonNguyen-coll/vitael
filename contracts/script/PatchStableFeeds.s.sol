// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelOracle.sol";
import "../src/MockV3Aggregator.sol";
import "../src/LendingConfig.sol";

/**
 * @title PatchStableFeeds
 * @notice Replace USDC and EURC Stork feeds with MockV3Aggregator on Arc Testnet.
 *
 * Stork only pushes BTC/USD on Arc Testnet — USDC/USD and EURC/USD return NotFound.
 * This script sets fixed-price mock feeds so the pool can function.
 *
 * Usage:
 *   ORACLE=0x514E944009CC86a62d2b44a9911D58fB03E8DcDd \
 *   forge script script/PatchStableFeeds.s.sol \
 *     --rpc-url arc_testnet --broadcast --slow -vvvv
 */
contract PatchStableFeeds is Script {
    function run() external {
        address oracleAddr = vm.envAddress("ORACLE");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        VitaelOracle oracle = VitaelOracle(oracleAddr);
        require(oracle.owner() == vm.addr(pk), "not owner");

        vm.startBroadcast(pk);

        // USDC = $1.00 (8 decimals)
        MockV3Aggregator usdcMock = new MockV3Aggregator(8, 1_00000000);
        // EURC = $1.08 (8 decimals) — approximate EUR/USD rate
        MockV3Aggregator eurcMock = new MockV3Aggregator(8, 1_08000000);

        oracle.addPriceFeed(LendingConfig.USDC, address(usdcMock));
        oracle.addPriceFeed(LendingConfig.EURC, address(eurcMock));

        console.log("USDC mock feed ($1.00):", address(usdcMock));
        console.log("EURC mock feed ($1.08):", address(eurcMock));
        console.log("cirBTC unchanged - Stork BTC/USD live");

        vm.stopBroadcast();
    }
}
