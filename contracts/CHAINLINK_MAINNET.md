# Arc mainnet Chainlink integration

The mainnet deployment script registers Chainlink Standard proxies directly in VitaelOracle; it deploys no Stork adapter and requires no price pusher. Addresses and maximum ages come from environment variables. Existing testnet deployment and local environment files remain separate.

Sources:
- https://reference-data-directory.vercel.app/feeds-arc-mainnet.json (proxyAddress = Standard proxy; secondaryProxyAddress = SVR)
- https://github.com/smartcontractkit/documentation/blob/main/src/features/data/chains.ts
- https://docs.arc.io/arc/references/contract-addresses

All three feeds publish a 86400-second heartbeat and 0.5% deviation threshold. The example uses 90000 seconds (25 hours) as an operational freshness policy. Prices may be older than one hour without being stale under that policy. Review this tolerance when changing lending risk parameters. BTC/USD values cirBTC assuming one cirBTC represents one BTC; it does not detect a cirBTC depeg or enforce proof of reserves.

## Validation

On 2026-09-23, the live Arc mainnet fork test passed: all three feeds were readable by VitaelOracle and all three reverted after the freshness deadline. The eight existing oracle regression tests also passed (9 passed, 0 failed, 0 skipped). The full mainnet deployment script also simulated successfully on chain 5042, including registration of USDC, EURC and cirBTC, using a public test key and no broadcast. Addresses printed by that simulation are not deployed contracts. This verifies oracle integration, not a full application mainnet rollout.

## Read-only fork test (Git Bash, from contracts)

```bash
CHAINLINK_FORK_RPC_URL=https://rpc.mainnet.arc.io ~/.foundry/bin/forge.exe test --match-contract ChainlinkMainnetTest -vv
```

Without CHAINLINK_FORK_RPC_URL the network-dependent test is explicitly skipped. It deploys VitaelOracle locally on a fork, reads all three live feeds through the contract and verifies stale-price rejection after advancing time. No wallet or transaction is needed.

## Deployment preparation (Git Bash, from contracts)

Load the existing private key first, then the public mainnet configuration, so old testnet addresses cannot override the mainnet values:

```bash
set -a
source .env
source .env.mainnet.example
set +a
~/.foundry/bin/forge.exe script script/DeployVitaelMainnet.s.sol:DeployVitaelMainnet --rpc-url "$ARC_MAINNET_RPC_URL" -vvvv
```

This is a simulation. After reviewing a successful simulation, adding `--broadcast --slow` sends the deployment and costs gas. The script rejects other chain IDs and validates feed pairs, decimals, round completion and freshness before broadcasting. It prints the new pool and oracle addresses. No .env files are synchronized automatically.

The script deploys only the oracle and lending pool. Mainnet vault/DEX deployment and frontend, MCP and Railway network/token/contract configuration must be completed separately before the application is ready. In particular EURC and cirBTC addresses differ from testnet. Do not point a testnet frontend at a mainnet pool.

## Vault and DEX deployment

Both deployment scripts now require DEPLOY_CHAIN_ID and reject a different network before broadcasting. Token addresses come from the environment. On testnet set DEPLOY_CHAIN_ID=5042002 and the testnet token addresses explicitly.

After deploying the mainnet lending pool, fill LENDING_POOL_ADDRESS and ORACLE_ADDRESS in your private mainnet configuration. Load that configuration after the public example so its filled values override the blank placeholders. The vault verifies USDC support, expected oracle address and a fresh USDC price before deployment. It uses USDC_ADDRESS and LENDING_POOL_ADDRESS directly; legacy USDC/POOL aliases are no longer required or accepted.

With the environment loaded, simulate:

```bash
~/.foundry/bin/forge.exe script script/DeployUSDCVault.s.sol --rpc-url "$ARC_MAINNET_RPC_URL" -vvvv
~/.foundry/bin/forge.exe script script/DeployVitaelDEX.s.sol --rpc-url "$ARC_MAINNET_RPC_URL" -vvvv
```

Add --broadcast --slow only for real deployment. DEX creates treasury, factory, router, quoter and the USDC/EURC and USDC/cirBTC pairs. Pairs start with no liquidity. Use the printed addresses for frontend/MCP and the new factory for the Railway indexer. The vault prints NEXT_PUBLIC_USDC_VAULT. Mainnet frontend/network configuration and initial liquidity are separate subsequent steps.

Validation for the vault/DEX scripts (2026-09-23): 29 existing vault/DEX regression tests passed, including fuzz checks. The DEX script simulated successfully on Arc mainnet (5042), creating both pairs without broadcasting. The live fork vault test deploys a new pool and vault, verifies the vault asset/pool/cap, and checks its USDC allowance to that pool. The fork does not move real funds or prove deposit/withdraw operation on the live chain.
