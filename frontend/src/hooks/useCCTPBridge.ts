"use client";

import { useState, useCallback } from "react";
import { useWalletClient, useSwitchChain } from "wagmi";
import { pad, encodeFunctionData, parseUnits, type Hash } from "viem";
import { parseWalletError } from "../lib/walletErrors";

// ─── CCTP V2 Contract Addresses (Testnet) ────────────────────────────────────
// Source: https://developers.circle.com/cctp/evm-smart-contracts
const CONTRACTS = {
  // Ethereum Sepolia (domain 0)
  Ethereum_Sepolia: {
    chainId:          11155111,
    domain:           0,
    usdc:             "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`,
    tokenMessenger:   "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
    msgTransmitter:   "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
    explorer:         "https://sepolia.etherscan.io/tx/",
    name:             "Ethereum Sepolia",
  },
  // Arbitrum Sepolia (domain 3)
  Arbitrum_Sepolia: {
    chainId:          421614,
    domain:           3,
    usdc:             "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as `0x${string}`,
    tokenMessenger:   "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
    msgTransmitter:   "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
    explorer:         "https://sepolia.arbiscan.io/tx/",
    name:             "Arbitrum Sepolia",
  },
  // Base Sepolia (domain 6)
  Base_Sepolia: {
    chainId:          84532,
    domain:           6,
    usdc:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,
    tokenMessenger:   "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
    msgTransmitter:   "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
    explorer:         "https://sepolia.basescan.org/tx/",
    name:             "Base Sepolia",
  },
  // Polygon Amoy (domain 7)
  Polygon_Amoy_Testnet: {
    chainId:          80002,
    domain:           7,
    usdc:             "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as `0x${string}`,
    tokenMessenger:   "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
    msgTransmitter:   "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
    explorer:         "https://amoy.polygonscan.com/tx/",
    name:             "Polygon Amoy",
  },
  // Avalanche Fuji (domain 1)
  Avalanche_Fuji: {
    chainId:          43113,
    domain:           1,
    usdc:             "0x5425890298aed601595a70AB815c96711a31Bc65" as `0x${string}`,
    tokenMessenger:   "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
    msgTransmitter:   "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
    explorer:         "https://testnet.snowtrace.io/tx/",
    name:             "Avalanche Fuji",
  },
  // OP Sepolia (domain 2)
  OP_Sepolia: {
    chainId:          11155420,
    domain:           2,
    usdc:             "0x5fd84259d66Cd46123540766Be93DFE6D43130D7" as `0x${string}`,
    tokenMessenger:   "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
    msgTransmitter:   "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
    explorer:         "https://sepolia-optimism.etherscan.io/tx/",
    name:             "OP Sepolia",
  },
  // Arc Testnet (domain 26)
  Arc_Testnet: {
    chainId:          5042002,
    domain:           26,
    usdc:             "0x3600000000000000000000000000000000000000" as `0x${string}`,
    tokenMessenger:   "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
    msgTransmitter:   "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
    explorer:         "https://testnet.arcscan.app/tx/",
    name:             "Arc Testnet",
  },
} as const;

type SupportedChain = keyof typeof CONTRACTS;

// Iris API (Circle attestation service — sandbox)
const IRIS_API = "https://iris-api-sandbox.circle.com";

// Forwarding Service hook data — tells Circle to auto-mint on destination
const FORWARDING_HOOK =
  "0x636374702d666f72776172640000000000000000000000000000000000000000" as `0x${string}`;

// ─── ABIs (minimal) ───────────────────────────────────────────────────────────
const ERC20_ABI = [
  {
    type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function", name: "allowance", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const TOKEN_MESSENGER_ABI = [
  {
    type: "function", name: "depositForBurnWithHook", stateMutability: "nonpayable",
    inputs: [
      { name: "amount",                type: "uint256" },
      { name: "destinationDomain",     type: "uint32"  },
      { name: "mintRecipient",         type: "bytes32" },
      { name: "burnToken",             type: "address" },
      { name: "destinationCaller",     type: "bytes32" },
      { name: "maxFee",                type: "uint256" },
      { name: "minFinalityThreshold",  type: "uint32"  },
      { name: "hookData",              type: "bytes"   },
    ],
    outputs: [],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export type BridgeStep =
  | "idle"
  | "switching_chain"
  | "fetching_fees"
  | "approving"
  | "burning"
  | "waiting_attestation"
  | "done"
  | "error"
  | "cancelled";

export interface BridgeState {
  step:         BridgeStep;
  stepLabel:    string;
  progress:     number;
  approveTx:    Hash | null;
  burnTx:       Hash | null;
  forwardTx:    Hash | null;
  error:        string | null;
  srcExplorer:  string;   // source chain explorer (for approve + burn tx)
  dstExplorer:  string;   // destination chain explorer (for forwardTx / mint tx)
  dstName:      string;   // destination chain display name
}

const STEP_LABELS: Record<BridgeStep, string> = {
  idle:                 "Ready",
  switching_chain:      "Switching network...",
  fetching_fees:        "Fetching CCTP fees...",
  approving:            "Step 1/2 — Approve USDC (sign in wallet)",
  burning:              "Step 2/2 — Burn & Bridge (sign in wallet)",
  waiting_attestation:  "Waiting for Circle attestation (~2 min)...",
  done:                 "Bridge complete ✓",
  error:                "Error",
  cancelled:            "Cancelled",
};

const STEP_PROGRESS: Record<BridgeStep, number> = {
  idle: 0, switching_chain: 5, fetching_fees: 15,
  approving: 30, burning: 55, waiting_attestation: 75, done: 100, error: 0, cancelled: 0,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useCCTPBridge() {
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync }   = useSwitchChain();

  const [state, setState] = useState<BridgeState>({
    step: "idle", stepLabel: STEP_LABELS.idle, progress: 0,
    approveTx: null, burnTx: null, forwardTx: null, error: null,
    srcExplorer: "",
    dstExplorer: "",
    dstName:     "",
  });

  const set = useCallback((step: BridgeStep, extra?: Partial<BridgeState>) => {
    setState(prev => ({
      ...prev, step,
      stepLabel: STEP_LABELS[step],
      progress:  STEP_PROGRESS[step],
      ...extra,
    }));
  }, []);
  const bridge = useCallback(async (
    fromChainKey: SupportedChain,
    toChainKey:   SupportedChain,
    amountHuman:  string,          // e.g. "1.5"
    recipient?:   `0x${string}`,   // defaults to connected wallet
  ) => {
    if (!walletClient) {
      set("error", { error: "Wallet not connected" });
      return;
    }

    const src = CONTRACTS[fromChainKey];
    const dst = CONTRACTS[toChainKey];

    try {
      // ── 1. Switch to source chain ──────────────────────────────────────────
      set("switching_chain", {
        srcExplorer: src.explorer,
        dstExplorer: dst.explorer,
        dstName:     dst.name,
      });
      await switchChainAsync({ chainId: src.chainId });

      // Re-get wallet client after chain switch (wagmi updates it)
      const account = walletClient.account.address;
      const to      = recipient ?? account;

      // ── 2. Fetch forwarding fees from Iris API ─────────────────────────────
      set("fetching_fees");
      const feeRes = await fetch(
        `${IRIS_API}/v2/burn/USDC/fees/${src.domain}/${dst.domain}?forward=true`
      );
      if (!feeRes.ok) throw new Error("Failed to fetch CCTP fees");

      type FeeItem = { finalityThreshold: number; minimumFee: number; forwardFee: { med: number } };
      const fees: FeeItem[] = await feeRes.json();
      const feeData = fees.find(f => f.finalityThreshold === 1000);
      if (!feeData) throw new Error("Fast-transfer fees not available");

      const amount      = parseUnits(amountHuman, 6);                          // USDC 6 decimals
      const forwardFee  = BigInt(feeData.forwardFee.med);
      const protocolFee = (amount * BigInt(Math.round(feeData.minimumFee * 100))) / BigInt(1_000_000);
      const maxFee      = forwardFee + protocolFee;
      const totalBurn   = amount + maxFee;

      // ── 3. Approve USDC ────────────────────────────────────────────────────
      set("approving");
      const approveTx = await walletClient.sendTransaction({
        account,
        to:      src.usdc,
        data:    encodeFunctionData({
          abi:          ERC20_ABI,
          functionName: "approve",
          args:         [src.tokenMessenger, totalBurn],
        }),
      });
      setState(prev => ({ ...prev, approveTx }));

      // Wait for approval confirmation
      // We use a public client via fetch to avoid importing usePublicClient in a callback
      await waitForTx(src.chainId, approveTx);

      // ── 4. depositForBurnWithHook ──────────────────────────────────────────
      set("burning", { approveTx });
      const mintRecipient = pad(to, { size: 32 });
      const zeroCaller    = pad("0x0", { size: 32 });

      const burnTx = await walletClient.sendTransaction({
        account,
        to:      src.tokenMessenger,
        data:    encodeFunctionData({
          abi:          TOKEN_MESSENGER_ABI,
          functionName: "depositForBurnWithHook",
          args: [
            totalBurn,
            dst.domain,
            mintRecipient,
            src.usdc,
            zeroCaller,
            maxFee,
            1000,
            FORWARDING_HOOK,
          ],
        }),
      });
      setState(prev => ({ ...prev, burnTx }));

      // ── 5. Poll Iris for forwardTxHash ─────────────────────────────────────
      set("waiting_attestation", { burnTx });
      const forwardTx = await pollForForwardTx(src.domain, burnTx);

      set("done", { forwardTx });

    } catch (err: unknown) {
      const { message, cancelled } = parseWalletError(err);
      set(cancelled ? "cancelled" : "error", { error: message });
    }
  }, [walletClient, switchChainAsync, set]);

  const reset = useCallback(() => {
    setState({
      step: "idle", stepLabel: STEP_LABELS.idle, progress: 0,
      approveTx: null, burnTx: null, forwardTx: null, error: null,
      srcExplorer: "",
      dstExplorer: "",
      dstName:     "",
    });
  }, []);

  return { state, bridge, reset };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Poll a public RPC for tx receipt (no wagmi hook needed)
async function waitForTx(chainId: number, hash: Hash): Promise<void> {
  // Map chainId → RPC URL
  const rpcMap: Record<number, string> = {
    5042002:   "https://rpc.testnet.arc.network",           // Arc Testnet
    11155111:  "https://rpc.sepolia.org",                   // Ethereum Sepolia
    421614:    "https://sepolia-rollup.arbitrum.io/rpc",    // Arbitrum Sepolia
    84532:     "https://sepolia.base.org",                  // Base Sepolia
    80002:     "https://rpc-amoy.polygon.technology",       // Polygon Amoy
    43113:     "https://api.avax-test.network/ext/bc/C/rpc", // Avalanche Fuji
    11155420:  "https://sepolia.optimism.io",               // OP Sepolia
  };
  const rpc = rpcMap[chainId];
  if (!rpc) throw new Error(`No RPC configured for chainId ${chainId}`);

  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [hash],
      }),
    });
    const data = await res.json();
    if (data?.result?.status === "0x1") return;
    if (data?.result?.status === "0x0") throw new Error("Transaction reverted");
  }
  throw new Error("Transaction confirmation timeout");
}

// Poll Iris API until forwardTxHash appears
async function pollForForwardTx(srcDomain: number, burnTxHash: Hash): Promise<Hash> {
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    try {
      const res = await fetch(
        `${IRIS_API}/v2/messages/${srcDomain}?transactionHash=${burnTxHash}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      const fwd  = data?.messages?.[0]?.forwardTxHash as Hash | undefined;
      if (fwd) return fwd;
    } catch {
      // network hiccup — keep polling
    }
  }
  throw new Error("Attestation timeout — check ArcScan manually");
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
