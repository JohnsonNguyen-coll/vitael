// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../src/dex/VitaelFactory.sol";

/// @notice Add the EURC/cirBTC pair to an existing factory; safe to rerun.
contract CreateEURCBTCPair is Script {
    function run() external {
        require(block.chainid == vm.envUint("DEPLOY_CHAIN_ID"), "Wrong deployment chain");
        address factoryAddress = vm.envAddress("DEX_FACTORY");
        require(factoryAddress.code.length > 0, "Missing factory");
        VitaelFactory factory = VitaelFactory(factoryAddress);
        address eurc = vm.envAddress("EURC_ADDRESS");
        address btc = vm.envAddress("CIRBTC_ADDRESS");
        require(eurc != btc, "Duplicate tokens");
        require(IERC20Metadata(eurc).decimals() == 6, "Wrong EURC decimals");
        require(IERC20Metadata(btc).decimals() == 8, "Wrong cirBTC decimals");
        address pair = factory.getPair(eurc, btc);
        if (pair == address(0)) {
            vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
            pair = factory.createPair(eurc, btc);
            vm.stopBroadcast();
        }
        console.log("NEXT_PUBLIC_PAIR_EURC_CIRBTC=", pair);
    }
}
