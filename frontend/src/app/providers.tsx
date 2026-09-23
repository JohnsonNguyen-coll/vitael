"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { CCTP_CHAINS, arcMainnet } from "../lib/cctpMainnet";
import { arcTransport } from "../lib/arcTransport";
import "@rainbow-me/rainbowkit/styles.css";
export { arcMainnet };

const config = getDefaultConfig({
  appName: "Vitael Lending Protocol",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  chains: [arcMainnet, ...Object.values(CCTP_CHAINS).filter(c => c.chainId !== arcMainnet.id).map(c => c.chain)],
  transports: {
    ...Object.fromEntries(Object.values(CCTP_CHAINS).map(c => [c.chainId, http(c.rpc)])),
    [arcMainnet.id]: arcTransport(),
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
