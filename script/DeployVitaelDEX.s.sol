// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/dex/VitaelTreasury.sol";
import "../src/dex/VitaelFactory.sol";
import "../src/dex/VitaelRouter.sol";
import "../src/dex/VitaelQuoter.sol";
import "../src/dex/VitaelPair.sol";

/// @notice Deploy full Vitael DEX V2 stack on Arc Testnet
/// @dev Seed liquidity via frontend /pool page after deploy (Arc native USDC
///      has delegatecall logic that causes StackUnderflow in Foundry scripts)
contract DeployVitaelDEX is Script {
    address constant USDC   = 0x3600000000000000000000000000000000000000;
    address constant EURC   = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address constant cirBTC = 0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        VitaelTreasury treasury = new VitaelTreasury(deployer);
        console.log("VitaelTreasury:  ", address(treasury));

        VitaelFactory factory = new VitaelFactory(deployer, address(treasury));
        console.log("VitaelFactory:   ", address(factory));

        VitaelRouter router = new VitaelRouter(address(factory));
        console.log("VitaelRouter:    ", address(router));

        VitaelQuoter quoter = new VitaelQuoter(address(factory), address(router));
        console.log("VitaelQuoter:    ", address(quoter));

        address usdcEurcPair = factory.createPair(USDC, EURC);
        address usdcBtcPair  = factory.createPair(USDC, cirBTC);
        console.log("USDC/EURC pair:  ", usdcEurcPair);
        console.log("USDC/cirBTC pair:", usdcBtcPair);

        vm.stopBroadcast();

        console.log("\n=== VITAEL DEX V2 DEPLOYED ===");
        console.log("NEXT_PUBLIC_DEX_TREASURY=", address(treasury));
        console.log("NEXT_PUBLIC_DEX_FACTORY= ", address(factory));
        console.log("NEXT_PUBLIC_DEX_ROUTER=  ", address(router));
        console.log("NEXT_PUBLIC_DEX_QUOTER=  ", address(quoter));
        console.log("NEXT_PUBLIC_PAIR_USDC_EURC=  ", usdcEurcPair);
        console.log("NEXT_PUBLIC_PAIR_USDC_CIRBTC=", usdcBtcPair);
        console.log("Next: go to /pool and add liquidity via frontend");
    }
}
