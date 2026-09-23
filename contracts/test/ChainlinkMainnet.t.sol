// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../src/VitaelOracle.sol";
import "../src/vaults/VitaelUSDCVault.sol";

contract ChainlinkMainnetTest is Test {
    function testFork_VaultConnectsToNewPool() public {
        string memory rpc = vm.envOr("CHAINLINK_FORK_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        assertEq(block.chainid, 5042);
        address usdc = 0x3600000000000000000000000000000000000000;
        VitaelOracle oracle = new VitaelOracle();
        oracle.addPriceFeed(usdc, 0x84EA90AC252Dc437031461836DB5164219147905, 90000);
        VitaelLendingPool pool = new VitaelLendingPool(address(oracle));
        pool.addAsset(usdc, 6, 9000, 9200, 500, 2e16, 8e17, 4e16, 75e16, 1000);
        VitaelUSDCVault vault = new VitaelUSDCVault(IERC20(usdc), pool, 10_000e6);
        assertEq(vault.asset(), usdc);
        assertEq(address(vault.lendingPool()), address(pool));
        assertEq(vault.depositCap(), 10_000e6);
        assertEq(IERC20(usdc).allowance(address(vault), address(pool)), type(uint256).max);
        assertGt(oracle.getAssetPrice(usdc), 0);
    }

    function testFork_MainnetPricesAndStaleness() public {
        string memory rpc = vm.envOr("CHAINLINK_FORK_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        assertEq(block.chainid, 5042);
        address[3] memory feeds = [
            address(0x84EA90AC252Dc437031461836DB5164219147905),
            address(0x361b95c10b76Ca3f35C686d423e43A951755Bf23),
            address(0xa109B535C70C8Be9995be64Bb6751AcDB27e03De)
        ];
        VitaelOracle oracle = new VitaelOracle();
        for (uint256 i; i < feeds.length; i++) {
            address asset = address(uint160(i + 1));
            oracle.addPriceFeed(asset, feeds[i], 90000);
            (, int256 answer,,,) = AggregatorV3Interface(feeds[i]).latestRoundData();
            assertEq(AggregatorV3Interface(feeds[i]).decimals(), 8);
            assertGt(answer, 0);
            assertEq(oracle.getAssetPrice(asset), uint256(answer));
        }
        vm.warp(block.timestamp + 90001);
        for (uint256 i; i < feeds.length; i++) {
            address asset = address(uint160(i + 1));
            vm.expectRevert(abi.encodeWithSelector(VitaelOracle.StalePrice.selector, asset));
            oracle.getAssetPrice(asset);
        }
    }
}
