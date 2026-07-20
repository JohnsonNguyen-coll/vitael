"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
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
    [sepolia.id]:            http("https://rpc2.sepolia.org"),
    [arbitrumSepolia.id]:    http("https://sepolia-rollup.arbitrum.io/rpc"),
    [baseSepolia.id]:        http("https://sepolia.base.org"),
    [polygonAmoy.id]:        http("https://rpc-amoy.polygon.technology"),
    [avalancheFuji.id]:      http("https://api.avax-test.network/ext/bc/C/rpc"),
    [optimismSepolia.id]:    http("https://sepolia.optimism.io"),
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
