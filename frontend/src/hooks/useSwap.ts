"use client";

import { useState, useCallback } from "react";
import { parseWalletError } from "../lib/walletErrors";
import { useWalletClient } from "wagmi";

// ─── Types ────────────────────────────────────────────────────────────────────
export type SwapStep =
  | "idle"
  | "signing"
  | "done"
  | "error"
  | "cancelled";

export interface SwapResult {
  tokenIn:     string;
  tokenOut:    string;
  amountIn:    string;
  amountOut:   string;
  txHash:      string;
  explorerUrl: string;
  fees:        { token: string; amount: string; type: string }[];
}

export interface SwapState {
  step:      SwapStep;
  stepLabel: string;
  result:    SwapResult | null;
  error:     string | null;
}

const STEP_LABELS: Record<SwapStep, string> = {
  idle:      "Ready",
  signing:   "Swapping via Circle Swap Kit...",
  done:      "Swap complete ✓",
  error:     "Error",
  cancelled: "Cancelled",
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSwap() {
  const { data: walletClient } = useWalletClient();

  const [state, setState] = useState<SwapState>({
    step: "idle", stepLabel: STEP_LABELS.idle, result: null, error: null,
  });

  const set = useCallback((step: SwapStep, extra?: Partial<SwapState>) => {
    setState(prev => ({ ...prev, step, stepLabel: STEP_LABELS[step], ...extra }));
  }, []);

  const swap = useCallback(async (
    tokenIn:  string,
    tokenOut: string,
    amountIn: string,
    _kitKey:  string,
  ) => {
    if (!walletClient) {
      set("error", { error: "Wallet not connected" });
      return;
    }

    try {
      set("signing");

      // Gọi qua API route để lấy calldata (không chứa private key)
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIn, tokenOut, amountIn, chain: "Arc_Testnet", userAddress: walletClient.account.address }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Swap failed");

      if (!data.unsignedTx) {
        throw new Error("API did not return a valid transaction payload");
      }

      set("signing", { stepLabel: "Please sign in your wallet..." });

      const txHash = await walletClient.sendTransaction({
        to: data.unsignedTx.to as `0x${string}`,
        data: data.unsignedTx.data as `0x${string}`,
        value: BigInt(data.unsignedTx.value || "0"),
      });

      set("done", {
        result: {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: "0", // we didn't quote exactly in this simplified flow
          txHash,
          explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
          fees: [],
        },
      });

    } catch (err: unknown) {
      const { message, cancelled } = parseWalletError(err);
      set(cancelled ? "cancelled" : "error", { error: message });
    }
  }, [walletClient, set]);

  const reset = useCallback(() => {
    setState({ step: "idle", stepLabel: STEP_LABELS.idle, result: null, error: null });
  }, []);

  return { state, swap, reset };
}
