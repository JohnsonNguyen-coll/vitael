// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/dex/VitaelTreasury.sol";
import "../src/dex/VitaelFactory.sol";
import "../src/dex/VitaelRouter.sol";
import "../src/dex/VitaelQuoter.sol";
import "../src/dex/VitaelPair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploy full Vitael DEX V2 stack on Arc Testnet
contract DeployVitaelDEX is Script {
    // ── Arc Testnet token addresses ──────────────────────────────────────────
    address constant USDC   = 0x3600000000000000000000000000000000000000;
    address constant EURC   = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address constant cirBTC = 0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF;

    // Initial seed liquidity (adjust to your faucet balance)
    uint256 constant USDC_SEED = 50 * 1e6;  // 50 USDC
    uint256 constant EURC_SEED = 45 * 1e6;  // 45 EURC

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // ── 1. Deploy Treasury ───────────────────────────────────────────────
        VitaelTreasury treasury = new VitaelTreasury(deployer);
        console.log("VitaelTreasury:  ", address(treasury));

        // ── 2. Deploy Factory (points to treasury) ───────────────────────────
        VitaelFactory factory = new VitaelFactory(deployer, address(treasury));
        console.log("VitaelFactory:   ", address(factory));

        // ── 3. Deploy Router ─────────────────────────────────────────────────
        VitaelRouter router = new VitaelRouter(address(factory));
        console.log("VitaelRouter:    ", address(router));

        // ── 4. Deploy Quoter ─────────────────────────────────────────────────
        VitaelQuoter quoter = new VitaelQuoter(address(factory), address(router));
        console.log("VitaelQuoter:    ", address(quoter));

        // ── 5. Create pairs ──────────────────────────────────────────────────
        address usdcEurcPair  = factory.createPair(USDC, EURC);
        address usdcBtcPair   = factory.createPair(USDC, cirBTC);
        console.log("USDC/EURC pair:  ", usdcEurcPair);
        console.log("USDC/cirBTC pair:", usdcBtcPair);

        // ── 6. Seed USDC/EURC pool ───────────────────────────────────────────
        IERC20(USDC).approve(address(router), USDC_SEED);
        IERC20(EURC).approve(address(router), EURC_SEED);

        (uint256 a, uint256 b, uint256 lp) = router.addLiquidity(
            USDC, EURC,
            USDC_SEED, EURC_SEED,
            0, 0,
            deployer,
            block.timestamp + 600
        );
        console.log("Seeded USDC/EURC:");
        console.log("  USDC deposited:", a);
        console.log("  EURC deposited:", b);
        console.log("  LP tokens:     ", lp);

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────────
        console.log("\n======= VITAEL DEX V2 DEPLOYMENT =======");
        console.log("Chain:           Arc Testnet (5042002)");
        console.log("Deployer:        ", deployer);
        console.log("VitaelTreasury:  ", address(treasury));
        console.log("VitaelFactory:   ", address(factory));
        console.log("VitaelRouter:    ", address(router));
        console.log("VitaelQuoter:    ", address(quoter));
        console.log("USDC/EURC pair:  ", usdcEurcPair);
        console.log("USDC/cirBTC pair:", usdcBtcPair);
        console.log("=========================================");
        console.log("\nAdd to frontend/.env.local:");
        console.log("NEXT_PUBLIC_DEX_TREASURY=", address(treasury));
        console.log("NEXT_PUBLIC_DEX_FACTORY= ", address(factory));
        console.log("NEXT_PUBLIC_DEX_ROUTER=  ", address(router));
        console.log("NEXT_PUBLIC_DEX_QUOTER=  ", address(quoter));
        console.log("NEXT_PUBLIC_PAIR_USDC_EURC=  ", usdcEurcPair);
        console.log("NEXT_PUBLIC_PAIR_USDC_CIRBTC=", usdcBtcPair);
    }
}
