"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { type Chain, sepolia, arbitrumSepolia, baseSepolia, polygonAmoy, avalancheFuji, optimismSepolia } from "viem/chains";
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
  projectId: "YOUR_PROJECT_ID",
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
    [arcTestnet.id]:         http("https://rpc.testnet.arc.network"),
    [sepolia.id]:            http(),
    [arbitrumSepolia.id]:    http(),
    [baseSepolia.id]:        http(),
    [polygonAmoy.id]:        http(),
    [avalancheFuji.id]:      http(),
    [optimismSepolia.id]:    http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#00F5FF",
            accentColorForeground: "#0A1428",
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
