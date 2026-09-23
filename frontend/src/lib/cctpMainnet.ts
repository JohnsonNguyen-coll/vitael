import { defineChain } from "viem";
import { mainnet, arbitrum, base, polygon, avalanche, optimism } from "viem/chains";

// Circle mainnet deployments: developers.circle.com/cctp/references/contract-addresses
// Native USDC: developers.circle.com/stablecoins/usdc-contract-addresses
export const IRIS_API = "https://iris-api.circle.com";
export const CCTP_TOKEN_MESSENGER = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d" as const;
export const arcMainnet = defineChain({
  id: 5042, name: "Arc", nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
});
export const CCTP_CHAINS = {
  Ethereum: { name: "Ethereum", chain: mainnet, chainId: 1, domain: 0, usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const, tokenMessenger: CCTP_TOKEN_MESSENGER, explorer: "https://etherscan.io/tx/", rpc: process.env.NEXT_PUBLIC_CCTP_ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com" },
  Arbitrum: { name: "Arbitrum", chain: arbitrum, chainId: 42161, domain: 3, usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const, tokenMessenger: CCTP_TOKEN_MESSENGER, explorer: "https://arbiscan.io/tx/", rpc: process.env.NEXT_PUBLIC_CCTP_ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc" },
  Base: { name: "Base", chain: base, chainId: 8453, domain: 6, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const, tokenMessenger: CCTP_TOKEN_MESSENGER, explorer: "https://basescan.org/tx/", rpc: process.env.NEXT_PUBLIC_CCTP_BASE_RPC_URL || "https://mainnet.base.org" },
  Polygon: { name: "Polygon", chain: polygon, chainId: 137, domain: 7, usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as const, tokenMessenger: CCTP_TOKEN_MESSENGER, explorer: "https://polygonscan.com/tx/", rpc: process.env.NEXT_PUBLIC_CCTP_POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com" },
  Avalanche: { name: "Avalanche", chain: avalanche, chainId: 43114, domain: 1, usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" as const, tokenMessenger: CCTP_TOKEN_MESSENGER, explorer: "https://snowtrace.io/tx/", rpc: process.env.NEXT_PUBLIC_CCTP_AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc" },
  Optimism: { name: "Optimism", chain: optimism, chainId: 10, domain: 2, usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" as const, tokenMessenger: CCTP_TOKEN_MESSENGER, explorer: "https://optimistic.etherscan.io/tx/", rpc: process.env.NEXT_PUBLIC_CCTP_OPTIMISM_RPC_URL || "https://mainnet.optimism.io" },
  Arc: { name: "Arc", chain: arcMainnet, chainId: 5042, domain: 26, usdc: "0x3600000000000000000000000000000000000000" as const, tokenMessenger: CCTP_TOKEN_MESSENGER, explorer: "https://explorer.arc.io/tx/", rpc: process.env.NEXT_PUBLIC_CCTP_ARC_RPC_URL || "https://rpc.mainnet.arc.io" },
} as const;
export type CctpChain = keyof typeof CCTP_CHAINS;
