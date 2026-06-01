// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VitaelOracle.sol";
import "../src/StorkPriceFeed.sol";
import "../src/LendingConfig.sol";

/**
 * @title PatchEURCFeed
 * @notice Replace the broken EURC StorkPriceFeed (wrong asset ID 0x59102b37...)
 *         with the correct one: keccak256("EURCUSD") = 0x64ffe138...
 *
 * Run step 1 — deploy feed only (no oracle call):
 *   STEP=1 ORACLE=0x9bbe... forge script script/PatchEURCFeed.s.sol \
 *     --rpc-url arc_testnet --broadcast --slow -vvvv
 *
 * Run step 2 — point oracle at the new feed (set EURC_FEED to address from step 1):
 *   STEP=2 ORACLE=0x9bbe... EURC_FEED=0x<new_feed> \
 *     forge script script/PatchEURCFeed.s.sol \
 *     --rpc-url arc_testnet --broadcast --slow -vvvv
 *
 * Or run both in one shot (default, STEP not set):
 *   ORACLE=0x9bbe... forge script script/PatchEURCFeed.s.sol \
 *     --rpc-url arc_testnet --broadcast --slow -vvvv
 */
contract PatchEURCFeed is Script {
    function run() external {
        address oracleAddr = vm.envAddress("ORACLE");
        uint256 pk         = vm.envUint("PRIVATE_KEY");
        address deployer   = vm.addr(pk);
        uint256 step       = vm.envOr("STEP", uint256(0)); // 0 = both, 1 = deploy only, 2 = set only

        VitaelOracle oracle = VitaelOracle(oracleAddr);
        require(oracle.owner() == deployer, "PRIVATE_KEY must be oracle owner");

        vm.startBroadcast(pk);

        if (step == 0 || step == 1) {
            // Step 1: deploy new StorkPriceFeed with correct EURCUSD asset ID
            StorkPriceFeed newFeed = new StorkPriceFeed(
                LendingConfig.STORK_AGGREGATOR,
                LendingConfig.STORK_EURCUSD   // keccak256("EURCUSD") = 0x64ffe138...
            );
            console.log("New EURC StorkPriceFeed:", address(newFeed));
            console.log(">> Copy this address for STEP=2 if running separately");

            if (step == 0) {
                // Step 2 inline: update oracle immediately
                oracle.setPriceFeed(LendingConfig.EURC, address(newFeed));
                console.log("Oracle EURC feed updated to:", address(newFeed));
            }
        } else if (step == 2) {
            // Step 2 standalone: just update oracle with pre-deployed feed address
            address feedAddr = vm.envAddress("EURC_FEED");
            oracle.setPriceFeed(LendingConfig.EURC, feedAddr);
            console.log("Oracle EURC feed updated to:", feedAddr);
        }

        vm.stopBroadcast();
    }
}
