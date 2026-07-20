"use client";

import { useState, useCallback } from "react";
import { useWalletClient, useSwitchChain } from "wagmi";
import { parseUnits, formatUnits, encodeFunctionData, createPublicClient, type Address, type Hash, type Hex } from "viem";
import { arcTestnet } from "../app/providers";
import { parseWalletError } from "../lib/walletErrors";
import { arcTransport } from "../lib/arcTransport";

// ─── Contract addresses ───────────────────────────────────────────────────────
const ROUTER  = (process.env.NEXT_PUBLIC_DEX_ROUTER  ?? "") as Address;
const FACTORY = (process.env.NEXT_PUBLIC_DEX_FACTORY ?? "") as Address;

// Arc Testnet public client — always reads from Arc, regardless of wallet chain
const arcClient = createPublicClient({
  chain: arcTestnet,
  transport: arcTransport(),
});

// ─── Token addresses on Arc Testnet ──────────────────────────────────────────
export const TOKENS = {
  USDC:   { address: "0x3600000000000000000000000000000000000000" as Address, decimals: 6, symbol: "USDC",   name: "USD Coin"   },
  EURC:   { address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as Address, decimals: 6, symbol: "EURC",   name: "Euro Coin"  },
  cirBTC: { address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF" as Address, decimals: 8, symbol: "cirBTC", name: "Circle BTC" },
} as const;
export type TokenSymbol = keyof typeof TOKENS;

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  { type: "function", name: "approve",   stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view",       inputs: [{ name: "owner",   type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer",  stateMutability: "nonpayable", inputs: [{ name: "to",      type: "address" }, { name: "amount",  type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view",       inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const ROUTER_ABI = [
  {
    type: "function", name: "getAmountsOut", stateMutability: "view",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function", name: "getAmountOut", stateMutability: "pure",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "reserveIn", type: "uint256" }, { name: "reserveOut", type: "uint256" }],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    // Used only for swap — Router pulls tokens via transferFrom
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
] as const;

const FACTORY_ABI = [
  { type: "function", name: "getPair", stateMutability: "view", inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }], outputs: [{ name: "pair", type: "address" }] },
] as const;

const PAIR_ABI = [
  { type: "function", name: "mint",        stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }], outputs: [{ name: "liquidity", type: "uint256" }] },
  { type: "function", name: "burn",        stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }], outputs: [{ name: "amount0", type: "uint256" }, { name: "amount1", type: "uint256" }] },
  { type: "function", name: "getReserves", stateMutability: "view",       inputs: [], outputs: [{ name: "reserve0", type: "uint112" }, { name: "reserve1", type: "uint112" }, { name: "blockTimestampLast", type: "uint32" }] },
  { type: "function", name: "token0",      stateMutability: "view",       inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalSupply", stateMutability: "view",       inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf",   stateMutability: "view",       inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",     stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer",    stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PoolInfo {
  pair: Address; reserve0: bigint; reserve1: bigint;
  token0: Address; token1: Address; totalSupply: bigint; userLpBalance: bigint;
  balanceA: bigint; balanceB: bigint;
}
export interface DEXState { step: string; busy: boolean; error: string | null; txHash: Hash | null; }

function dl() { return BigInt(Math.floor(Date.now() / 1000) + 600); }

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useVitaelDEX() {
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync }   = useSwitchChain();

  const [state, setState] = useState<DEXState>({ step: "idle", busy: false, error: null, txHash: null });
  const setStep = (step: string, extra?: Partial<DEXState>) => setState(prev => ({ ...prev, step, ...extra }));

  const failTx = (err: unknown) => {
    const { message, cancelled } = parseWalletError(err);
    setState({
      step: cancelled ? "cancelled" : "error",
      busy: false,
      error: message,
      txHash: null,
    });
  };

  async function ensureArc() {
    if (!walletClient) throw new Error("Wallet not connected");
    if (walletClient.chain.id !== arcTestnet.id) await switchChainAsync({ chainId: arcTestnet.id });
  }

  async function sendWithEstimatedGas(to: Address, data: Hex): Promise<Hash> {
    if (!walletClient) throw new Error("Not connected");
    const account = walletClient.account.address;
    const estimatedGas = await arcClient.estimateGas({ account, to, data });
    return walletClient.sendTransaction({
      account,
      to,
      data,
      gas: estimatedGas * 125n / 100n,
    });
  }

  async function ensureApproval(token: Address, spender: Address, amount: bigint) {
    if (!walletClient) throw new Error("Not connected");
    const account = walletClient.account.address;
    const allowance = await arcClient.readContract({
      address: token, abi: ERC20_ABI, functionName: "allowance", args: [account, spender],
    }) as bigint;
    if (allowance < amount) {
      setStep("approving");
      const data = encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [spender, amount * 10n] });
      const hash = await sendWithEstimatedGas(token, data);
      const receipt = await arcClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Approval transaction failed");
      }
    }
  }

  // ── Get quote (read-only, safe) ───────────────────────────────────────────
  const getQuote = useCallback(async (tokenIn: TokenSymbol, tokenOut: TokenSymbol, amountInHuman: string): Promise<string> => {
    if (!FACTORY || !amountInHuman || parseFloat(amountInHuman) <= 0) return "";
    try {
      const tIn = TOKENS[tokenIn]; const tOut = TOKENS[tokenOut];
      const pair = await arcClient.readContract({
        address: FACTORY, abi: FACTORY_ABI, functionName: "getPair", args: [tIn.address, tOut.address],
      }) as Address;
      if (!pair || pair === "0x0000000000000000000000000000000000000000") return "";

      const reserves = await arcClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "getReserves" }) as [bigint, bigint, number];
      const token0   = await arcClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "token0" }) as Address;
      const [r0, r1] = reserves;
      if (r0 === 0n || r1 === 0n) return "";

      const [rIn, rOut] = tIn.address.toLowerCase() === token0.toLowerCase() ? [r0, r1] : [r1, r0];
      const amountIn = parseUnits(amountInHuman, tIn.decimals);
      const out = await arcClient.readContract({
        address: ROUTER, abi: ROUTER_ABI, functionName: "getAmountOut", args: [amountIn, rIn, rOut],
      }) as bigint;
      return formatUnits(out, tOut.decimals);
    } catch (error) {
      console.warn("[DEX] Unable to load swap quote", error);
      return "";
    }
  }, []);

  // ── Swap — approve Router then call swapExactTokensForTokens ─────────────
  const swap = useCallback(async (tokenIn: TokenSymbol, tokenOut: TokenSymbol, amountInHuman: string, slippagePct: number) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient) throw new Error("Not connected");
      if (!ROUTER || !FACTORY) throw new Error("DEX not configured — check .env.local");

      const tIn = TOKENS[tokenIn]; const tOut = TOKENS[tokenOut];
      const account  = walletClient.account.address;
      const amountIn = parseUnits(amountInHuman, tIn.decimals);

      const pair = await arcClient.readContract({
        address: FACTORY, abi: FACTORY_ABI, functionName: "getPair", args: [tIn.address, tOut.address],
      }) as Address;
      if (!pair || pair === "0x0000000000000000000000000000000000000000") throw new Error("Pool not found");

      const reserves = await arcClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "getReserves" }) as [bigint, bigint, number];
      const token0   = await arcClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "token0" }) as Address;
      const [r0, r1] = reserves;
      if (r0 === 0n || r1 === 0n) throw new Error("Pool has no liquidity — add liquidity first");

      const [rIn, rOut] = tIn.address.toLowerCase() === token0.toLowerCase() ? [r0, r1] : [r1, r0];
      const amountOut = await arcClient.readContract({
        address: ROUTER, abi: ROUTER_ABI, functionName: "getAmountOut", args: [amountIn, rIn, rOut],
      }) as bigint;
      const amountOutMin = amountOut * BigInt(Math.floor((1 - slippagePct / 100) * 10000)) / 10000n;

      await ensureApproval(tIn.address, ROUTER, amountIn);

      setStep("swapping");
      const data = encodeFunctionData({
        abi: ROUTER_ABI, functionName: "swapExactTokensForTokens",
        args: [amountIn, amountOutMin, [tIn.address, tOut.address], account, dl()],
      });
      const hash = await sendWithEstimatedGas(ROUTER, data);
      setStep("confirming", { txHash: hash });
      const receipt = await arcClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Swap transaction failed on-chain");
      }
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err: unknown) {
      failTx(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Add Liquidity — bypass Router, transfer directly to pair then mint ────
  // Arc USDC precompile blocks safeTransferFrom when called from Router context
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addLiquidity = useCallback(async (tokenA: TokenSymbol, tokenB: TokenSymbol, amountAHuman: string, amountBHuman: string, _slippage?: number) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !FACTORY) throw new Error("Not connected");

      const tA = TOKENS[tokenA]; const tB = TOKENS[tokenB];
      const account = walletClient.account.address;
      const amountA = parseUnits(amountAHuman, tA.decimals);
      const amountB = parseUnits(amountBHuman, tB.decimals);

      const pair = await arcClient.readContract({
        address: FACTORY, abi: FACTORY_ABI, functionName: "getPair", args: [tA.address, tB.address],
      }) as Address;
      if (!pair || pair === "0x0000000000000000000000000000000000000000") throw new Error("Pair not found");

      setStep("approving");
      const tx1 = await sendWithEstimatedGas(
        tA.address,
        encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [pair, amountA] }),
      );
      const receipt1 = await arcClient.waitForTransactionReceipt({ hash: tx1 });
      if (receipt1.status === "reverted") {
        throw new Error(`Transfer of ${tokenA} failed - insufficient balance`);
      }

      setStep("approving");
      const tx2 = await sendWithEstimatedGas(
        tB.address,
        encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [pair, amountB] }),
      );
      const receipt2 = await arcClient.waitForTransactionReceipt({ hash: tx2 });
      if (receipt2.status === "reverted") {
        throw new Error(`Transfer of ${tokenB} failed - insufficient balance`);
      }

      setStep("adding");
      const hash = await sendWithEstimatedGas(
        pair,
        encodeFunctionData({ abi: PAIR_ABI, functionName: "mint", args: [account] }),
      );
      setStep("confirming", { txHash: hash });
      const receipt = await arcClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Add liquidity transaction failed on-chain");
      }
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err: unknown) {
      failTx(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Remove Liquidity — transfer LP to pair then burn ─────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeLiquidity = useCallback(async (tokenA: TokenSymbol, tokenB: TokenSymbol, lpAmountHuman: string, _slippage?: number) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !FACTORY) throw new Error("Not connected");

      const tA = TOKENS[tokenA]; const tB = TOKENS[tokenB];
      const account = walletClient.account.address;

      const pair = await arcClient.readContract({
        address: FACTORY, abi: FACTORY_ABI, functionName: "getPair", args: [tA.address, tB.address],
      }) as Address;
      if (!pair || pair === "0x0000000000000000000000000000000000000000") throw new Error("Pair not found");

      const lpAmount = parseUnits(lpAmountHuman, 18);

      setStep("approving");
      const tx1 = await sendWithEstimatedGas(
        pair,
        encodeFunctionData({ abi: PAIR_ABI, functionName: "transfer", args: [pair, lpAmount] }),
      );
      const receipt1 = await arcClient.waitForTransactionReceipt({ hash: tx1 });
      if (receipt1.status === "reverted") {
        throw new Error("Transfer of LP tokens failed - insufficient balance");
      }

      setStep("removing");
      const hash = await sendWithEstimatedGas(
        pair,
        encodeFunctionData({ abi: PAIR_ABI, functionName: "burn", args: [account] }),
      );
      setStep("confirming", { txHash: hash });
      const receipt = await arcClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Remove liquidity transaction failed on-chain");
      }
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err: unknown) {
      failTx(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Get pool info ─────────────────────────────────────────────────────────
  const getPoolInfo = useCallback(async (tokenA: TokenSymbol, tokenB: TokenSymbol, userAddress?: Address): Promise<PoolInfo | null> => {
    if (!FACTORY) return null;
    try {
      const tA = TOKENS[tokenA]; const tB = TOKENS[tokenB];
      const pair = await arcClient.readContract({
        address: FACTORY, abi: FACTORY_ABI, functionName: "getPair", args: [tA.address, tB.address],
      }) as Address;
      if (!pair || pair === "0x0000000000000000000000000000000000000000") return null;

      const [reserves, token0, totalSupply, userLp, balA, balB] = await Promise.all([
        arcClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "getReserves" }),
        arcClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "token0" }),
        arcClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "totalSupply" }),
        userAddress ? arcClient.readContract({ address: pair, abi: PAIR_ABI, functionName: "balanceOf", args: [userAddress] }) : Promise.resolve(0n),
        userAddress ? arcClient.readContract({ address: tA.address, abi: ERC20_ABI, functionName: "balanceOf", args: [userAddress] }) : Promise.resolve(0n),
        userAddress ? arcClient.readContract({ address: tB.address, abi: ERC20_ABI, functionName: "balanceOf", args: [userAddress] }) : Promise.resolve(0n),
      ]);
      const [r0, r1] = reserves as [bigint, bigint, number];
      return {
        pair, reserve0: r0, reserve1: r1,
        token0: token0 as Address,
        token1: tA.address.toLowerCase() < tB.address.toLowerCase() ? tB.address : tA.address,
        totalSupply: totalSupply as bigint,
        userLpBalance: userLp as bigint,
        balanceA: balA as bigint,
        balanceB: balB as bigint,
      };
    } catch (error) {
      console.warn("[DEX] Unable to load pool info", error);
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ step: "idle", busy: false, error: null, txHash: null }), []);

  return { state, swap, addLiquidity, removeLiquidity, getQuote, getPoolInfo, reset, TOKENS, ROUTER, FACTORY };
}
