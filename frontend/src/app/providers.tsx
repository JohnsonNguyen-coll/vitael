"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, fallback, http } from "wagmi";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { type Chain, sepolia, arbitrumSepolia, baseSepolia, polygonAmoy, avalancheFuji, optimismSepolia } from "viem/chains";
import { arcTransport } from "../lib/arcTransport";
import "@rainbow-me/rainbowkit/styles.css";

// Arc Testnet chain definition
export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
} as const satisfies Chain;

const config = getDefaultConfig({
  appName: "Vitael Lending Protocol",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  chains: [
    arcTestnet,
    sepolia,
    arbitrumSepolia,
    baseSepolia,
    polygonAmoy,
    avalancheFuji,
    optimismSepolia,
  ],
  transports: {
    [arcTestnet.id]:         arcTransport(),
    [sepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", { timeout: 12_000, retryCount: 1 }),
      http("https://rpc.sepolia.org", { timeout: 12_000, retryCount: 1 }),
      http("https://sepolia.drpc.org", { timeout: 12_000, retryCount: 1 }),
    ]),
    [arbitrumSepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc", { timeout: 12_000, retryCount: 1 }),
      http("https://arbitrum-sepolia-rpc.publicnode.com", { timeout: 12_000, retryCount: 1 }),
    ]),
    [baseSepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org", { timeout: 12_000, retryCount: 1 }),
      http("https://base-sepolia-rpc.publicnode.com", { timeout: 12_000, retryCount: 1 }),
    ]),
    [polygonAmoy.id]: fallback([
      http(process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology", { timeout: 12_000, retryCount: 1 }),
      http("https://polygon-amoy-bor-rpc.publicnode.com", { timeout: 12_000, retryCount: 1 }),
    ]),
    [avalancheFuji.id]: fallback([
      http(process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc", { timeout: 12_000, retryCount: 1 }),
      http("https://avalanche-fuji-c-chain-rpc.publicnode.com", { timeout: 12_000, retryCount: 1 }),
    ]),
    [optimismSepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC_URL ?? "https://sepolia.optimism.io", { timeout: 12_000, retryCount: 1 }),
      http("https://optimism-sepolia-rpc.publicnode.com", { timeout: 12_000, retryCount: 1 }),
    ]),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          locale="en-US"
          theme={darkTheme({
            accentColor: "#A998FF",
            accentColorForeground: "#0D0E1E",
            borderRadius: "large",
            overlayBlur: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
