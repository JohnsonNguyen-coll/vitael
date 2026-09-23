# Vitael Smart Contracts

Smart contracts for the Vitael DeFi protocol on Arc Testnet.

## Overview

Vitael is a multi-asset lending and DEX protocol featuring:
- **Multi-Asset Lending Pool**: Supply USDC, EURC, or cirBTC to earn yield
- **Over-Collateralized Borrowing**: Borrow against your collateral with health factor monitoring
- **Kinked Interest Rate Model**: Dynamic rates based on pool utilization
- **Liquidation System**: Automated liquidations with bonuses for liquidators
- **DEX (Uniswap V2 style)**: Swap tokens and provide liquidity
- **Oracle Integration**: Stork oracle for cirBTC, mock feeds for stablecoins

## Deployed Contracts (Arc Testnet)

The addresses below are historical deployments. The current pool and vault source changes require new deployments; this repository update does not migrate existing positions.

## Lending accounting and liquidation

- Lending cash is tracked by `accountedCash` / `getAvailableLiquidity`. Dedicated collateral and unsolicited transfers do not increase supplier claims, collateral valuation or lending liquidity. `getUnaccountedBalance` reports unsolicited tokens; there is currently no recovery function.
- Only exact-transfer, non-rebasing assets are supported. Inbound transfers must deliver the entire requested amount or revert. Asset registration checks actual decimals, risk parameter bounds and utilization bounds; updating a market first accrues its existing rate.
- `userDebtShares` and `totalDebtShares` are authoritative for debt. `userBorrows` remains a last-action snapshot for compatibility; use `getBorrowBalance` for current debt. Rounding dust is accounted as reserves.
- Use `previewSupply`, `previewRedeem` and `previewWithdraw` for exact share conversions. Supply rounds down and rejects zero shares; asset-denominated seizure/withdrawal requirements round shares up. `exchangeRate` is a scaled display value.
- `quoteLiquidation` returns actual payment, collateral and supply shares to burn. Payment is capped by available collateral and its market cash. The close-factor limit is 50%, rounded up for debt dust; requests above it revert. Same-asset liquidation is supported. Quotes require fresh feeds and can change before execution.
- `getAccountShortfall` returns collateral value, debt value and positive shortfall in 8-decimal USD; liquidation emits `AccountShortfall` when a deficit remains. Residual debt remains recorded and continues accruing. No debt forgiveness or automatic loss allocation is implemented.

Shortfall values use oracle prices and accounting claims, not guaranteed proceeds. Illiquidity, bonuses and token dust can reduce recoveries further. Supplier asset values still include outstanding debt at face value, including unrecovered debt. Resolving this economic risk and updating frontend/MCP/indexer integrations remain release requirements. These changes are not evidence of mainnet readiness or an independent audit.

## Historical testnet addresses

### Lending Protocol
- **VitaelLendingPool**: `0xEa282eea5bC90905C15Df05Ca43eeA967BcDe49f`

### Price Feeds
- **USDC Feed** (Mock): `0xCB33a6cD...` - Fixed at $1.00
- **EURC Feed** (Mock): `0x0F12E271...` - Fixed at $1.08
- **cirBTC Feed** (Stork): `0x5288559510...` - Live price

### DEX
- **VitaelFactory**: TBD
- **VitaelRouter**: TBD

## Project Structure

```
contracts/
├── src/                    # Smart contract source files
│   ├── VitaelLendingPool.sol
│   ├── StorkPriceFeed.sol
│   └── dex/               # DEX contracts
├── test/                  # Foundry tests
├── script/                # Deployment scripts
├── lib/                   # Dependencies (forge-std, etc.)
├── broadcast/             # Deployment artifacts
├── cache/                 # Build cache
├── out/                   # Compiled contracts
└── foundry.toml          # Foundry configuration
```

## Setup

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Git

### Installation

```bash
# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Run tests with verbosity
forge test -vvv
```

## Testing

```bash
# Run all tests
forge test

# Run specific test file
forge test --match-path test/VitaelLendingPool.t.sol

# Run with gas report
forge test --gas-report

# Run with coverage
forge coverage
```

## Deployment

### Oracle configuration for the current source

`addPriceFeed` and `setPriceFeed` now take `(asset, feed, maxAgeSeconds)`.
Set `ORACLE_USDC_MAX_AGE`, `ORACLE_EURC_MAX_AGE`, and
`ORACLE_CIRBTC_MAX_AGE` for the assets configured by your script. Values must
be positive and chosen from the verified feed heartbeat and risk policy;
there is no default. Feed prices are normalized from 0–18 decimals to 8 and
rejected when timestamps or rounds are invalid or the configured age expires.

Updated patch scripts target the new oracle ABI, not already-deployed legacy
oracles. The current pool/oracle/vault changes require a fresh deployment.
Borrowing and withdrawals with debt now enforce LTV using final balances;
liquidation still uses the liquidation threshold. Read
[`MAINNET_READINESS.md`](../MAINNET_READINESS.md) before production deployment.

### Deploy to Arc Testnet

```bash
# Set environment variables in .env
PRIVATE_KEY=your_private_key
ARC_RPC_URL=https://rpc.testnet.arc.network

# Deploy lending pool
forge script script/DeployVitael.s.sol:DeployVitael --rpc-url $ARC_RPC_URL --broadcast --slow -vvvv

# Deploy DEX
forge script script/DeployVitaelDEX.s.sol:DeployVitaelDEX --rpc-url $ARC_RPC_URL --broadcast --slow -vvvv
```

## Key Features

### Lending Pool
- **Share-based accounting**: No vToken, balances tracked via shares
- **Multi-asset support**: USDC, EURC, cirBTC
- **Dynamic interest rates**: Kinked model with 80% optimal utilization
- **Health factor monitoring**: Real-time collateral health tracking
- **Liquidation system**: Up to 50% liquidation with 5-10% bonus

### Asset Parameters

| Asset  | Max LTV | Liq. Threshold | Liq. Bonus | Decimals |
|--------|---------|----------------|------------|----------|
| USDC   | 90%     | 92%            | 5%         | 6        |
| EURC   | 85%     | 88%            | 5%         | 6        |
| cirBTC | 70%     | 75%            | 10%        | 8        |

### Interest Rate Model

- **Base rate**: 2% APY at 0% utilization
- **Kink**: 80% utilization
- **Below kink**: Gradual increase to 6% APY
- **Above kink**: Steep increase to 81% APY at 100% utilization
- **Reserve factor**: 10% of interest goes to protocol

## Security

⚠️ **Testnet Only**: These contracts are deployed on Arc Testnet for demonstration purposes. They have not been audited and should not be used with real funds.

## License

MIT
