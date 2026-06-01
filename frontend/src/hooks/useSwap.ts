"use client";

import { useState, useCallback } from "react";
import { useWalletClient } from "wagmi";

// ─── Types ────────────────────────────────────────────────────────────────────
export type SwapStep =
  | "idle"
  | "signing"
  | "done"
  | "error";

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
  idle:    "Ready",
  signing: "Swapping via Circle Swap Kit...",
  done:    "Swap complete ✓",
  error:   "Error",
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

      // Circle Swap Kit phải chạy server-side (gọi Circle API bị CORS từ browser)
      // Gọi qua API route — server dùng private key để ký và broadcast
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIn, tokenOut, amountIn, chain: "Arc_Testnet" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Swap failed");

      set("done", {
        result: {
          tokenIn:     data.tokenIn,
          tokenOut:    data.tokenOut,
          amountIn:    data.amountIn,
          amountOut:   data.amountOut,
          txHash:      data.txHash,
          explorerUrl: data.explorerUrl,
          fees:        data.fees ?? [],
        },
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set("error", { error: msg });
    }
  }, [walletClient, set]);

  const reset = useCallback(() => {
    setState({ step: "idle", stepLabel: STEP_LABELS.idle, result: null, error: null });
  }, []);

  return { state, swap, reset };
}
