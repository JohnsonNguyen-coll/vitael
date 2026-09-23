// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../src/dex/VitaelTreasury.sol";
import "../src/dex/VitaelFactory.sol";
import "../src/dex/VitaelRouter.sol";
import "../src/dex/VitaelQuoter.sol";
import "../src/dex/VitaelPair.sol";

/// @notice Deploy the DEX using explicit network and token environment configuration.
contract DeployVitaelDEX is Script {
    function run() external {
        require(block.chainid == vm.envUint("DEPLOY_CHAIN_ID"), "Wrong deployment chain");
        address USDC = vm.envAddress("USDC_ADDRESS");
        address EURC = vm.envAddress("EURC_ADDRESS");
        address cirBTC = vm.envAddress("CIRBTC_ADDRESS");
        require(USDC != EURC && USDC != cirBTC && EURC != cirBTC, "Duplicate tokens");
        require(IERC20Metadata(USDC).decimals() == 6, "Wrong USDC decimals");
        require(IERC20Metadata(EURC).decimals() == 6, "Wrong EURC decimals");
        require(IERC20Metadata(cirBTC).decimals() == 8, "Wrong cirBTC decimals");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

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
        address usdcBtcPair = factory.createPair(USDC, cirBTC);
        address eurcBtcPair = factory.createPair(EURC, cirBTC);
        console.log("USDC/EURC pair:  ", usdcEurcPair);
        console.log("USDC/cirBTC pair:", usdcBtcPair);
        console.log("EURC/cirBTC pair:", eurcBtcPair);

        vm.stopBroadcast();

        console.log("\n=== VITAEL DEX V2 DEPLOYED ===");
        console.log("NEXT_PUBLIC_DEX_TREASURY=", address(treasury));
        console.log("NEXT_PUBLIC_DEX_FACTORY= ", address(factory));
        console.log("NEXT_PUBLIC_DEX_ROUTER=  ", address(router));
        console.log("NEXT_PUBLIC_DEX_QUOTER=  ", address(quoter));
        console.log("NEXT_PUBLIC_PAIR_USDC_EURC=  ", usdcEurcPair);
        console.log("NEXT_PUBLIC_PAIR_USDC_CIRBTC=", usdcBtcPair);
        console.log("NEXT_PUBLIC_PAIR_EURC_CIRBTC=", eurcBtcPair);
        console.log("Next: go to /pool and add liquidity via frontend");
    }
}
