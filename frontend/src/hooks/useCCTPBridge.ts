"use client";

import { useState, useCallback } from "react";
import { useWalletClient, useSwitchChain, useConfig } from "wagmi";
import { pad, encodeFunctionData, parseUnits, type Hash, createPublicClient, http } from "viem";
import { getWalletClient } from "@wagmi/core";
import { sepolia, arbitrumSepolia, baseSepolia, polygonAmoy, avalancheFuji, optimismSepolia } from "viem/chains";
import { arcTestnet } from "../app/providers";
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
  waiting_attestation:  "Waiting for Circle attestation (~15s)...",
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
      
      const forwardFee  = BigInt(feeData.forwardFee.med); // Already in USDC units (6 decimals)
      const protocolFee = (amount * BigInt(Math.round(feeData.minimumFee * 10_000))) / BigInt(1_000_000);
      const maxFee      = forwardFee + protocolFee;
      const totalBurn   = amount + maxFee;
      
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
      
      if (!allowanceConfirmed) {
        console.warn("[Bridge] Could not confirm approval, proceeding optimistically...");
        console.log("[Bridge] If burn tx fails, check:", src.explorer + approveTx);
      }
      
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
      const forwardTx = await pollForForwardTx(src.domain, burnTx);

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
  type ChainType = typeof arcTestnet | typeof sepolia | typeof arbitrumSepolia | typeof baseSepolia | typeof polygonAmoy | typeof avalancheFuji | typeof optimismSepolia;
  
  // Using Alchemy for better reliability and speed
  // Get your free API key at: https://www.alchemy.com/
  const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "demo"; // Replace with your key
  
  const chainMap: Record<number, { chain: ChainType; rpc: string }> = {
    5042002:   { 
      chain: arcTestnet,       
      rpc: "https://rpc.testnet.arc.network" 
    },
    11155111:  { 
      chain: sepolia,          
      rpc: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}` 
    },
    421614:    { 
      chain: arbitrumSepolia,  
      rpc: `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}` 
    },
    84532:     { 
      chain: baseSepolia,      
      rpc: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}` 
    },
    80002:     { 
      chain: polygonAmoy,      
      rpc: `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}` 
    },
    43113:     { 
      chain: avalancheFuji,    
      rpc: "https://api.avax-test.network/ext/bc/C/rpc" // Avalanche official RPC
    },
    11155420:  { 
      chain: optimismSepolia,  
      rpc: `https://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}` 
    },
  };

  const config = chainMap[chainId];
  if (!config) throw new Error(`No RPC configured for chainId ${chainId}`);

  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpc),
  });
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
  
  throw new Error("Attestation timeout — check ArcScan manually");
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
