"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { AlertTriangle } from "lucide-react";
import { arcTestnet } from "../app/providers";

export default function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isArcTestnet = chainId === arcTestnet.id;

  if (!isConnected) {
    return <>{children}</>;
  }

  if (!isArcTestnet) {
    return (
      <div className="glass-panel rounded-3xl p-8 max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Wrong Network</h2>
            <p className="text-[#8991AF] mb-6">
              This feature is only available on <span className="text-[#A998FF] font-semibold">Arc Testnet</span>.
              <br />
              Please switch your network to continue.
            </p>
          </div>
          <button
            onClick={() => switchChain({ chainId: arcTestnet.id })}
            className="app-button app-button-primary px-8 py-3"
          >
            Switch to Arc Testnet
          </button>
          <p className="text-xs text-[#8991AF] mt-2">
            Current network: <span className="text-white">{chainId}</span>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
