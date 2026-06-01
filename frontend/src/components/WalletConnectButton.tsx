"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import ClientOnly from "./ClientOnly";

const FALLBACK = (
  <div
    className="h-10 w-[9.5rem] rounded-xl bg-white/5 border border-white/10"
    aria-hidden
  />
);

export default function WalletConnectButton() {
  return (
    <ClientOnly fallback={FALLBACK}>
      <ConnectButton />
    </ClientOnly>
  );
}
