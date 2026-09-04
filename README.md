# Vitael Protocol

A multi-asset DeFi protocol on Arc Testnet featuring lending, borrowing, swapping, and liquidity provision.

## 🌟 Features

- **Multi-Asset Lending**: Supply USDC, EURC, or cirBTC to earn yield
- **USDC Earn Vault**: ERC-4626 vault that compounds Vitael lending yield into its share price
- **Over-Collateralized Borrowing**: Borrow against your collateral with real-time health monitoring
- **DEX & Liquidity Pools**: Uniswap V2-style AMM with 0.3% trading fees
- **CCTP Bridge**: Native USDC bridging via Circle's Cross-Chain Transfer Protocol
- **Oracle Integration**: Stork oracle for live cirBTC prices

## 📁 Project Structure

```
vitael/
├── contracts/          # Smart contracts (Foundry)
│   ├── src/           # Solidity source files
│   ├── test/          # Contract tests
│   ├── script/        # Deployment scripts
│   └── README.md      # Contract documentation
│
└── frontend/          # Next.js web application
    ├── src/           # React components & pages
    ├── public/        # Static assets
    └── README.md      # Frontend documentation
```

## 🚀 Quick Start

### Smart Contracts

```bash
cd contracts
forge install
forge build
forge test
```

See [contracts/README.md](contracts/README.md) for detailed contract documentation.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

After deploying `DeployUSDCVault.s.sol`, configure `NEXT_PUBLIC_USDC_VAULT` in the
frontend and `USDC_VAULT` in the MCP server with the deployed vault address.

See [frontend/README.md](frontend/README.md) for frontend setup and development.

## 🌐 Deployed on Arc Testnet

- **Network**: Arc Testnet
- **Chain ID**: 5042002
- **RPC**: https://rpc.testnet.arc.network
- **Explorer**: https://testnet.arcscan.app

### Contract Addresses

- **VitaelLendingPool**: `0xEa282eea5bC90905C15Df05Ca43eeA967BcDe49f`
- **VitaelUSDCVault**: `0x78C1a89ba59f14542b16e81E60363B7a71e31a4B` (10,000 USDC cap)
- **USDC Price Feed**: `0xCB33a6cD...` (Mock - $1.00)
- **EURC Price Feed**: `0x0F12E271...` (Mock - $1.08)
- **cirBTC Price Feed**: `0x5288559510...` (Stork live)

## 🎯 Supported Assets

| Asset  | Description    | Max LTV | Liq. Threshold | Liq. Bonus |
|--------|----------------|---------|----------------|------------|
| USDC   | USD Coin       | 90%     | 92%            | 5%         |
| EURC   | Euro Coin      | 85%     | 88%            | 5%         |
| cirBTC | Circle Bitcoin | 70%     | 75%            | 10%        |

## 🔧 Tech Stack

### Smart Contracts
- **Solidity** 0.8.28
- **Foundry** - Development framework
- **OpenZeppelin** - Security libraries
- **Stork Oracle** - Price feeds

### Frontend
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Wagmi v2** - Ethereum interactions
- **RainbowKit** - Wallet connection
- **Framer Motion** - Animations

## 📖 Documentation

- [Smart Contracts Documentation](contracts/README.md)
- [Frontend Documentation](frontend/README.md)
- [User Guide](https://vitael-app.vercel.app/docs) (Live docs on the app)

## 🧪 Testing

Get testnet tokens from [Circle Faucet](https://faucet.circle.com) for Arc Testnet.

## ⚠️ Disclaimer

This is a **testnet protocol** for demonstration purposes only. The contracts have not been audited. Do not use with real funds.

## 📄 License

MIT
