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
