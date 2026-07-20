"use client";

import { Wallet } from "lucide-react";
import type { ReactNode } from "react";
import ClientOnly from "./ClientOnly";
import WalletConnectButton from "./WalletConnectButton";

export function WalletConnectPrompt({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <p className="text-sm text-[#8991AF] flex items-center gap-2">
        <Wallet className="w-4 h-4" />
        {message}
      </p>
      <WalletConnectButton />
    </div>
  );
}

/** Delays wallet-dependent UI until after mount (matches SSR fallback). */
export default function WalletActionGate({
  children,
  connectMessage,
}: {
  children: ReactNode;
  connectMessage: string;
}) {
  return (
    <ClientOnly fallback={<WalletConnectPrompt message={connectMessage} />}>
      {children}
    </ClientOnly>
  );
}
