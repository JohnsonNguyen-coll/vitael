"use client";

import { useCallback, useState } from "react";
import { useSwitchChain, useWalletClient } from "wagmi";
import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { arcTestnet } from "../app/providers";
import { arcTransport } from "../lib/arcTransport";
import { LENDING_CONTRACTS, VAULT_CONTRACTS, vaultConfigured } from "../lib/contracts";
import { parseWalletError } from "../lib/walletErrors";

const client = createPublicClient({ chain: arcTestnet, transport: arcTransport() });

export const VAULT_ABI = [
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "depositCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "shutdown", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "availableLiquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "convertToAssets", stateMutability: "view", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxWithdraw", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "previewDeposit", stateMutability: "view", inputs: [{ name: "assets", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const LENDING_RATE_ABI = [{
  type: "function", name: "getSupplyRate", stateMutability: "view",
  inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "uint256" }],
}] as const;

export type VaultSnapshot = {
  totalAssets: string;
  totalSupply: string;
  depositCap: string;
  availableLiquidity: string;
  walletBalance: string;
  shares: string;
  positionAssets: string;
  maxWithdraw: string;
  apyPct: number;
  shutdown: boolean;
};

type VaultState = { step: string; busy: boolean; error: string | null; txHash: Hash | null };

export function useVault() {
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const [state, setState] = useState<VaultState>({ step: "idle", busy: false, error: null, txHash: null });
  const vault = VAULT_CONTRACTS.USDC_VAULT;
  const usdc = LENDING_CONTRACTS.USDC;

  const reset = useCallback(() => setState({ step: "idle", busy: false, error: null, txHash: null }), []);

  const getSnapshot = useCallback(async (account?: Address): Promise<VaultSnapshot | null> => {
    if (!vaultConfigured()) return null;
    const zero = 0n;
    const [totalAssets, totalSupply, depositCap, availableLiquidity, shutdown, apy] = await Promise.all([
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: "totalAssets" }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: "totalSupply" }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: "depositCap" }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: "availableLiquidity" }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: "shutdown" }),
      client.readContract({ address: LENDING_CONTRACTS.LENDING_POOL, abi: LENDING_RATE_ABI, functionName: "getSupplyRate", args: [usdc] }),
    ]);
    const [walletBalance, shares, maxWithdraw] = account ? await Promise.all([
      client.readContract({ address: usdc, abi: ERC20_ABI, functionName: "balanceOf", args: [account] }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: "balanceOf", args: [account] }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: "maxWithdraw", args: [account] }),
    ]) : [zero, zero, zero];
    const positionAssets = shares === 0n ? 0n : await client.readContract({
      address: vault, abi: VAULT_ABI, functionName: "convertToAssets", args: [shares],
    });
    return {
      totalAssets: formatUnits(totalAssets, 6), totalSupply: formatUnits(totalSupply, 9),
      depositCap: formatUnits(depositCap, 6), availableLiquidity: formatUnits(availableLiquidity, 6),
      walletBalance: formatUnits(walletBalance, 6), shares: formatUnits(shares, 9),
      positionAssets: formatUnits(positionAssets, 6), maxWithdraw: formatUnits(maxWithdraw, 6),
      apyPct: Number(formatUnits(apy, 16)), shutdown,
    };
  }, [usdc, vault]);

  async function ensureArc() {
    if (!walletClient) throw new Error("Wallet not connected");
    if (walletClient.chain.id !== arcTestnet.id) await switchChainAsync({ chainId: arcTestnet.id });
  }

  async function send(functionName: "deposit" | "withdraw", args: readonly unknown[], step: string) {
    if (!walletClient || !vaultConfigured()) throw new Error("Vault is not configured");
    const account = walletClient.account.address;
    setState(s => ({ ...s, step }));
    const data = encodeFunctionData({ abi: VAULT_ABI, functionName, args: args as never });
    const gas = await client.estimateGas({ account, to: vault, data });
    const hash = await walletClient.sendTransaction({ account, to: vault, data, gas: gas * 125n / 100n });
    setState(s => ({ ...s, step: "confirming", txHash: hash }));
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") throw new Error("Vault transaction reverted");
    setState({ step: "done", busy: false, error: null, txHash: hash });
  }

  const deposit = useCallback(async (amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient) throw new Error("Wallet not connected");
      const amount = parseUnits(amountHuman, 6);
      const account = walletClient.account.address;
      const allowance = await client.readContract({ address: usdc, abi: ERC20_ABI, functionName: "allowance", args: [account, vault] });
      if (allowance < amount) {
        setState(s => ({ ...s, step: "approving" }));
        const data = encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [vault, amount] });
        const hash = await walletClient.sendTransaction({ account, to: usdc, data });
        await client.waitForTransactionReceipt({ hash });
      }
      await send("deposit", [amount, account], "depositing");
    } catch (error) {
      const parsed = parseWalletError(error);
      setState({ step: parsed.cancelled ? "cancelled" : "error", busy: false, error: parsed.message, txHash: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient, usdc, vault]);

  const withdraw = useCallback(async (amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient) throw new Error("Wallet not connected");
      const account = walletClient.account.address;
      await send("withdraw", [parseUnits(amountHuman, 6), account, account], "withdrawing");
    } catch (error) {
      const parsed = parseWalletError(error);
      setState({ step: parsed.cancelled ? "cancelled" : "error", busy: false, error: parsed.message, txHash: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient, vault]);

  return { state, reset, getSnapshot, deposit, withdraw, configured: vaultConfigured() };
}
