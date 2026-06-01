"use client";

import { useState, useCallback } from "react";
import { useWalletClient, usePublicClient, useSwitchChain } from "wagmi";
import { parseUnits, formatUnits, encodeFunctionData, type Address, type Hash } from "viem";
import { arcTestnet } from "../app/providers";

// ─── Contract addresses (filled after deploy) ─────────────────────────────────
// Set these in .env.local after running DeployVitaelDEX.s.sol
const ROUTER   = (process.env.NEXT_PUBLIC_DEX_ROUTER   ?? "") as Address;
const FACTORY  = (process.env.NEXT_PUBLIC_DEX_FACTORY  ?? "") as Address;
const QUOTER   = (process.env.NEXT_PUBLIC_DEX_QUOTER   ?? "") as Address;

// ─── Token addresses on Arc Testnet ──────────────────────────────────────────
export const TOKENS = {
  USDC:   { address: "0x3600000000000000000000000000000000000000" as Address, decimals: 6,  symbol: "USDC",   name: "USD Coin"   },
  EURC:   { address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as Address, decimals: 6,  symbol: "EURC",   name: "Euro Coin"  },
  cirBTC: { address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF" as Address, decimals: 8,  symbol: "cirBTC", name: "Circle BTC" },
} as const;

export type TokenSymbol = keyof typeof TOKENS;

// ─── ABIs (minimal) ───────────────────────────────────────────────────────────
const ERC20_ABI = [
  { type: "function", name: "approve",   stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view",       inputs: [{ name: "owner",   type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view",       inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const ROUTER_ABI = [
  {
    type: "function", name: "swapExactTokensForTokens", stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn",     type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path",         type: "address[]" },
      { name: "to",           type: "address" },
      { name: "deadline",     type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function", name: "addLiquidity", stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA",        type: "address" },
      { name: "tokenB",        type: "address" },
      { name: "amountADesired",type: "uint256" },
      { name: "amountBDesired",type: "uint256" },
      { name: "amountAMin",    type: "uint256" },
      { name: "amountBMin",    type: "uint256" },
      { name: "to",            type: "address" },
      { name: "deadline",      type: "uint256" },
    ],
    outputs: [
      { name: "amountA",   type: "uint256" },
      { name: "amountB",   type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
  {
    type: "function", name: "removeLiquidity", stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA",    type: "address" },
      { name: "tokenB",    type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountAMin",type: "uint256" },
      { name: "amountBMin",type: "uint256" },
      { name: "to",        type: "address" },
      { name: "deadline",  type: "uint256" },
    ],
    outputs: [{ name: "amountA", type: "uint256" }, { name: "amountB", type: "uint256" }],
  },
  {
    type: "function", name: "getAmountsOut", stateMutability: "view",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

const FACTORY_ABI = [
  {
    type: "function", name: "getPair", stateMutability: "view",
    inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;

const PAIR_ABI = [
  { type: "function", name: "getReserves",  stateMutability: "view", inputs: [], outputs: [{ name: "reserve0", type: "uint112" }, { name: "reserve1", type: "uint112" }, { name: "blockTimestampLast", type: "uint32" }] },
  { type: "function", name: "token0",       stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1",       stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalSupply",  stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf",    stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",      stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PoolInfo {
  pair:         Address;
  reserve0:     bigint;
  reserve1:     bigint;
  token0:       Address;
  token1:       Address;
  totalSupply:  bigint;
  userLpBalance:bigint;
}

export interface DEXState {
  step:      string;
  busy:      boolean;
  error:     string | null;
  txHash:    Hash | null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function deadline() { return BigInt(Math.floor(Date.now() / 1000) + 600); }

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useVitaelDEX() {
  const { data: walletClient }  = useWalletClient();
  const publicClient            = usePublicClient();
  const { switchChainAsync }    = useSwitchChain();

  const [state, setState] = useState<DEXState>({
    step: "idle", busy: false, error: null, txHash: null,
  });

  const setStep = (step: string, extra?: Partial<DEXState>) =>
    setState(prev => ({ ...prev, step, ...extra }));

  // ── Ensure Arc Testnet ──────────────────────────────────────────────────────
  async function ensureArc() {
    if (!walletClient) throw new Error("Wallet not connected");
    if (walletClient.chain.id !== arcTestnet.id) {
      await switchChainAsync({ chainId: arcTestnet.id });
    }
  }

  // ── Approve helper ──────────────────────────────────────────────────────────
  async function ensureApproval(token: Address, spender: Address, amount: bigint) {
    if (!walletClient || !publicClient) throw new Error("Not connected");
    const account = walletClient.account.address;

    const allowance = await publicClient.readContract({
      address: token, abi: ERC20_ABI, functionName: "allowance",
      args: [account, spender],
    });

    if ((allowance as bigint) < amount) {
      setStep("approving");
      const hash = await walletClient.sendTransaction({
        account,
        to: token,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [spender, amount * 2n] }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
  }

  // ── Get quote ───────────────────────────────────────────────────────────────
  const getQuote = useCallback(async (
    tokenIn: TokenSymbol,
    tokenOut: TokenSymbol,
    amountInHuman: string,
  ): Promise<string> => {
    if (!publicClient || !ROUTER || !amountInHuman || parseFloat(amountInHuman) <= 0) return "";
    try {
      const tIn  = TOKENS[tokenIn];
      const tOut = TOKENS[tokenOut];
      const amountIn = parseUnits(amountInHuman, tIn.decimals);
      const result = await publicClient.readContract({
        address: ROUTER, abi: ROUTER_ABI, functionName: "getAmountsOut",
        args: [amountIn, [tIn.address, tOut.address]],
      });
      const amounts = result as bigint[];
      return formatUnits(amounts[1], tOut.decimals);
    } catch {
      return "";
    }
  }, [publicClient]);

  // ── Swap ────────────────────────────────────────────────────────────────────
  const swap = useCallback(async (
    tokenIn:      TokenSymbol,
    tokenOut:     TokenSymbol,
    amountInHuman:string,
    slippagePct:  number,
  ) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !publicClient) throw new Error("Not connected");
      if (!ROUTER) throw new Error("DEX not deployed yet — set NEXT_PUBLIC_DEX_ROUTER in .env.local");

      const tIn  = TOKENS[tokenIn];
      const tOut = TOKENS[tokenOut];
      const account   = walletClient.account.address;
      const amountIn  = parseUnits(amountInHuman, tIn.decimals);

      // Get quote for slippage
      const amounts = await publicClient.readContract({
        address: ROUTER, abi: ROUTER_ABI, functionName: "getAmountsOut",
        args: [amountIn, [tIn.address, tOut.address]],
      }) as bigint[];
      const amountOutMin = amounts[1] * BigInt(Math.floor((1 - slippagePct / 100) * 10000)) / 10000n;

      // Approve
      await ensureApproval(tIn.address, ROUTER, amountIn);

      // Swap
      setStep("swapping");
      const hash = await walletClient.sendTransaction({
        account,
        to: ROUTER,
        data: encodeFunctionData({
          abi: ROUTER_ABI, functionName: "swapExactTokensForTokens",
          args: [amountIn, amountOutMin, [tIn.address, tOut.address], account, deadline()],
        }),
      });

      setStep("confirming", { txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      setState({ step: "done", busy: false, error: null, txHash: hash });

    } catch (err: unknown) {
      setState({ step: "error", busy: false, error: err instanceof Error ? err.message : String(err), txHash: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient, publicClient]);

  // ── Add Liquidity ───────────────────────────────────────────────────────────
  const addLiquidity = useCallback(async (
    tokenA:       TokenSymbol,
    tokenB:       TokenSymbol,
    amountAHuman: string,
    amountBHuman: string,
    slippagePct:  number,
  ) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !publicClient) throw new Error("Not connected");
      if (!ROUTER) throw new Error("DEX not deployed yet — set NEXT_PUBLIC_DEX_ROUTER in .env.local");

      const tA = TOKENS[tokenA];
      const tB = TOKENS[tokenB];
      const account  = walletClient.account.address;
      const amountA  = parseUnits(amountAHuman, tA.decimals);
      const amountB  = parseUnits(amountBHuman, tB.decimals);
      const slip     = BigInt(Math.floor((1 - slippagePct / 100) * 10000));
      const amountAMin = amountA * slip / 10000n;
      const amountBMin = amountB * slip / 10000n;

      // Approve both tokens
      await ensureApproval(tA.address, ROUTER, amountA);
      await ensureApproval(tB.address, ROUTER, amountB);

      // Add liquidity
      setStep("adding");
      const hash = await walletClient.sendTransaction({
        account,
        to: ROUTER,
        data: encodeFunctionData({
          abi: ROUTER_ABI, functionName: "addLiquidity",
          args: [tA.address, tB.address, amountA, amountB, amountAMin, amountBMin, account, deadline()],
        }),
      });

      setStep("confirming", { txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      setState({ step: "done", busy: false, error: null, txHash: hash });

    } catch (err: unknown) {
      setState({ step: "error", busy: false, error: err instanceof Error ? err.message : String(err), txHash: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient, publicClient]);

  // ── Remove Liquidity ────────────────────────────────────────────────────────
  const removeLiquidity = useCallback(async (
    tokenA:       TokenSymbol,
    tokenB:       TokenSymbol,
    lpAmountHuman:string,
    slippagePct:  number,
  ) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !publicClient || !FACTORY) throw new Error("Not connected");

      const tA = TOKENS[tokenA];
      const tB = TOKENS[tokenB];
      const account = walletClient.account.address;

      // Get pair address
      const pair = await publicClient.readContract({
        address: FACTORY, abi: FACTORY_ABI, functionName: "getPair",
        args: [tA.address, tB.address],
      }) as Address;
      if (!pair || pair === "0x0000000000000000000000000000000000000000") throw new Error("Pair not found");

      const lpAmount = parseUnits(lpAmountHuman, 18);

      // Approve LP token
      setStep("approving");
      const approveTx = await walletClient.sendTransaction({
        account, to: pair,
        data: encodeFunctionData({ abi: PAIR_ABI, functionName: "approve", args: [ROUTER, lpAmount] }),
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // Remove liquidity
      setStep("removing");
      const hash = await walletClient.sendTransaction({
        account, to: ROUTER,
        data: encodeFunctionData({
          abi: ROUTER_ABI, functionName: "removeLiquidity",
          args: [tA.address, tB.address, lpAmount, 0n, 0n, account, deadline()],
        }),
      });

      setStep("confirming", { txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      setState({ step: "done", busy: false, error: null, txHash: hash });

    } catch (err: unknown) {
      setState({ step: "error", busy: false, error: err instanceof Error ? err.message : String(err), txHash: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient, publicClient]);

  // ── Get pool info ───────────────────────────────────────────────────────────
  const getPoolInfo = useCallback(async (
    tokenA: TokenSymbol,
    tokenB: TokenSymbol,
    userAddress?: Address,
  ): Promise<PoolInfo | null> => {
    if (!publicClient || !FACTORY) return null;
    try {
      const tA = TOKENS[tokenA];
      const tB = TOKENS[tokenB];

      const pair = await publicClient.readContract({
        address: FACTORY, abi: FACTORY_ABI, functionName: "getPair",
        args: [tA.address, tB.address],
      }) as Address;
      if (!pair || pair === "0x0000000000000000000000000000000000000000") return null;

      const [reserves, token0, totalSupply, userLp] = await Promise.all([
        publicClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "getReserves" }),
        publicClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "token0" }),
        publicClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "totalSupply" }),
        userAddress
          ? publicClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "balanceOf", args: [userAddress] })
          : Promise.resolve(0n),
      ]);

      const [r0, r1] = reserves as [bigint, bigint, number];
      return {
        pair,
        reserve0:      r0,
        reserve1:      r1,
        token0:        token0 as Address,
        token1:        tA.address < tB.address ? tB.address : tA.address,
        totalSupply:   totalSupply as bigint,
        userLpBalance: userLp as bigint,
      };
    } catch {
      return null;
    }
  }, [publicClient]);

  const reset = useCallback(() => {
    setState({ step: "idle", busy: false, error: null, txHash: null });
  }, []);

  return { state, swap, addLiquidity, removeLiquidity, getQuote, getPoolInfo, reset, TOKENS, ROUTER, FACTORY };
}
