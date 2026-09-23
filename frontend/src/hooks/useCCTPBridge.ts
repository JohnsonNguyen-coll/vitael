"use client";

import { useState, useCallback } from "react";
import { useWalletClient, useSwitchChain, useConfig } from "wagmi";
import { pad, encodeFunctionData, parseUnits, type Hash, createPublicClient, http } from "viem";
import { getWalletClient } from "@wagmi/core";
import { CCTP_CHAINS as CONTRACTS, IRIS_API, type CctpChain as SupportedChain } from "../lib/cctpMainnet";
import { parseWalletError } from "../lib/walletErrors";
import { calculateBridgeFee } from "../lib/cctpFees";

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
  waiting_attestation:  "Waiting for destination confirmation...",
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
  const config                 = useConfig();

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
      if (!src || !dst || src.domain === dst.domain) throw new Error("Select two different mainnet chains");
      // ── 1. Switch to source chain ──────────────────────────────────────────
      set("switching_chain", {
        srcExplorer: src.explorer,
        dstExplorer: dst.explorer,
        dstName:     dst.name,
      });
      await switchChainAsync({ chainId: src.chainId });
      
      // Re-fetch wallet client for the new chain to ensure it's synced
      const freshWalletClient = await getWalletClient(config, { chainId: src.chainId });
      if (!freshWalletClient) throw new Error("Failed to get wallet client for source chain");

      const account = freshWalletClient.account?.address;
      if (!account) throw new Error("No account found in wallet client");
      const to = recipient ?? account;

      // Create a dedicated public client for this specific chain
      const publicClient = getPublicClientForChain(src.chainId);

      if (await publicClient.getChainId() !== src.chainId) throw new Error("Source RPC is on the wrong network");
      // ── 2. Fetch forwarding fees from Iris API ─────────────────────────────
      set("fetching_fees");
      const feeRes = await fetch(
        `${IRIS_API}/v2/burn/USDC/fees/${src.domain}/${dst.domain}?forward=true`
      );
      if (!feeRes.ok) throw new Error("Failed to fetch CCTP fees");

      type FeeItem = { finalityThreshold: number; minimumFee: number; forwardFee: { med: number } };
      const fees: FeeItem[] = await feeRes.json();
      console.log("[Bridge] Raw fees from Circle API:", JSON.stringify(fees, null, 2));
      
      const feeData = fees.find(f => f.finalityThreshold === 1000);
      if (!feeData) throw new Error("Fast-transfer fees not available");
      
      console.log("[Bridge] Selected fee data:", feeData);

      const amount = parseUnits(amountHuman, 6); // USDC 6 decimals
      
      // NOTE: According to Circle docs, fees are in basis points (1 = 0.01%)
      // - minimumFee: basis points (e.g., 1 = 0.01% of amount)
      // - forwardFee.med: ABSOLUTE value in USDC atomic units (NOT basis points!)
      //   Example: forwardFee.med = 200000 means 0.2 USDC fixed fee
      
      const { forwardFee, protocolFee, maxFee } = calculateBridgeFee(amount, feeData);
      const totalBurn = amount; // User-entered amount is the total debit; fees are deducted.

      console.log("[Bridge] Fee calculation:", {
        amountHuman,
        amount: amount.toString(),
        forwardFeeRaw: feeData.forwardFee.med,
        forwardFee: forwardFee.toString(),
        forwardFeeUSDC: (Number(forwardFee) / 1_000_000).toFixed(6),
        minimumFeeRaw: feeData.minimumFee,
        protocolFee: protocolFee.toString(),
        protocolFeeUSDC: (Number(protocolFee) / 1_000_000).toFixed(6),
        maxFee: maxFee.toString(),
        maxFeeUSDC: (Number(maxFee) / 1_000_000).toFixed(6),
        totalBurn: totalBurn.toString(),
        totalBurnUSDC: (Number(totalBurn) / 1_000_000).toFixed(6),
      });

      // ── 3. Approve USDC ────────────────────────────────────────────────────
      set("approving");
      console.log("[Bridge] Starting approve step");
      console.log("[Bridge] Approving", totalBurn.toString(), "USDC to", src.tokenMessenger);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const approveTx = await (freshWalletClient as any).sendTransaction({
        account: account as `0x${string}`,
        to:      src.usdc,
        data:    encodeFunctionData({
          abi:          ERC20_ABI,
          functionName: "approve",
          args:         [src.tokenMessenger, totalBurn],
        }),
      });
      
      console.log("[Bridge] Approve tx sent:", approveTx);
      console.log("[Bridge] Explorer:", src.explorer + approveTx);
      setState(prev => ({ ...prev, approveTx }));

      // Wait for approval - try allowance polling first, fallback to receipt if RPC is slow
      console.log("[Bridge] Waiting for approval to take effect...");
      
      let allowanceConfirmed = false;
      let rpcFailed = false;
      
      // Try polling allowance for up to 20 seconds
      for (let i = 0; i < 8; i++) { // 8 attempts * 2.5s = 20s
        await sleep(2500);
        
        try {
          const currentAllowance = await Promise.race([
            publicClient.readContract({
              address: src.usdc,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [account as `0x${string}`, src.tokenMessenger],
            }),
            // Timeout after 5 seconds
            new Promise<bigint>((_, reject) => 
              setTimeout(() => reject(new Error('RPC timeout')), 5000)
            ),
          ]);
          
          console.log(`[Bridge] Allowance: ${currentAllowance.toString()} / ${totalBurn.toString()}`);
          
          if (currentAllowance >= totalBurn) {
            console.log("[Bridge] ✓ Allowance confirmed!");
            allowanceConfirmed = true;
            break;
          }
        } catch (err) {
          console.warn("[Bridge] RPC error:", err);
          if (i >= 2) { // After 3 failed attempts (~7.5s), switch strategy
            console.log("[Bridge] RPC unreliable, falling back to receipt waiting...");
            rpcFailed = true;
            break;
          }
        }
      }
      
      // Fallback: Wait for transaction receipt if RPC is unreliable
      if (!allowanceConfirmed && rpcFailed) {
        try {
          console.log("[Bridge] Waiting for approve tx receipt...");
          const approveReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: approveTx,
            confirmations: 1,
            timeout: 45_000, // 45 seconds
          });
          
          if (approveReceipt.status === 'success') {
            console.log("[Bridge] ✓ Approve confirmed via receipt at block:", approveReceipt.blockNumber);
            allowanceConfirmed = true;
          } else {
            throw new Error("Approve transaction failed");
          }
        } catch (waitErr) {
          console.warn("[Bridge] Receipt wait also failed:", waitErr);
          // Continue anyway, burn tx will fail if approve didn't work
        }
      }
      
      if (!allowanceConfirmed) throw new Error("Approval is not confirmed. Check the approval transaction before retrying.");

      console.log("[Bridge] Moving to burn step");

      // ── 4. depositForBurnWithHook ──────────────────────────────────────────
      set("burning", { approveTx });
      const mintRecipient = pad(to, { size: 32 });
      const zeroCaller    = pad("0x0", { size: 32 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const burnTx = await (freshWalletClient as any).sendTransaction({
        account: account as `0x${string}`,
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
      const burnReceipt = await publicClient.waitForTransactionReceipt({ hash: burnTx, timeout: 180_000 });
      if (burnReceipt.status !== "success") throw new Error("Burn transaction reverted");
      const forwardTx = await confirmBridgeMint(src.domain, dst.domain, burnTx);

      set("done", { forwardTx });

    } catch (err: unknown) {
      const { message, cancelled } = parseWalletError(err);
      set(cancelled ? "cancelled" : "error", { error: message });
    }
  }, [walletClient, config, switchChainAsync, set]);

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

// Create public client for a specific chain
function getPublicClientForChain(chainId: number) {
  const config = Object.values(CONTRACTS).find(c => c.chainId === chainId);
  if (!config) throw new Error(`Unsupported mainnet chain ${chainId}`);
  return createPublicClient({ chain: config.chain, transport: http(config.rpc) });
}

// Poll Iris API until forwardTxHash appears
async function pollForForwardTx(srcDomain: number, burnTxHash: Hash): Promise<Hash> {
  console.log("[Bridge] Polling Circle Iris API for attestation...");
  console.log("[Bridge] Burn tx:", burnTxHash);
  
  // Try immediately first, then poll with delay
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(
        `${IRIS_API}/v2/messages/${srcDomain}?transactionHash=${burnTxHash}`
      );
      
      if (!res.ok) {
        console.log(`[Bridge] Iris API returned ${res.status}, retrying...`);
        await sleep(3000);
        continue;
      }
      
      const data = await res.json();
      const fwd  = data?.messages?.[0]?.forwardTxHash as Hash | undefined;
      
      if (fwd) {
        console.log("[Bridge] ✓ Attestation received! Forward tx:", fwd);
        return fwd;
      }
      
      // Log progress every 10 attempts (30 seconds)
      if (i % 10 === 0 && i > 0) {
        console.log(`[Bridge] Still waiting for attestation... (${i * 3}s elapsed)`);
      }
      
    } catch (err) {
      console.warn("[Bridge] Iris API error:", err);
    }
    
    // Wait before next attempt (except on first iteration)
    if (i === 0) {
      await sleep(2000); // Quick retry on first attempt
    } else {
      await sleep(3000); // 3 second interval after that
    }
  }
  
  throw new Error("Bridge is still pending. Check the source transaction in the explorer; do not burn again for the same transfer.");
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Shared by the bridge page and the agent transaction flow.
export async function confirmBridgeMint(sourceDomain: number, destinationDomain: number, burnTx: Hash): Promise<Hash> {
  const destination = Object.values(CONTRACTS).find(c => c.domain === destinationDomain);
  if (!destination) throw new Error("Unsupported bridge destination");
  const forwardTx = await pollForForwardTx(sourceDomain, burnTx);
  const client = getPublicClientForChain(destination.chainId);
  if (await client.getChainId() !== destination.chainId) throw new Error("Destination RPC is on the wrong network");
  const receipt = await client.waitForTransactionReceipt({ hash: forwardTx, timeout: 180_000 });
  if (receipt.status !== "success") throw new Error("Destination mint transaction reverted");
  return forwardTx;
}
