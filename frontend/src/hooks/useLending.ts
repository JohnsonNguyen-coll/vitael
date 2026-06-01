"use client";

import { useState, useCallback } from "react";
import { useWalletClient, useSwitchChain } from "wagmi";
import {
  parseUnits, formatUnits, encodeFunctionData,
  createPublicClient, http, type Address, type Hash,
} from "viem";
import { arcTestnet } from "../app/providers";
import { LENDING_CONTRACTS, ARC_RPC } from "../lib/contracts";
import { parseWalletError } from "../lib/walletErrors";
import { parseLendingPoolError } from "../lib/lendingErrors";

// ─── Contract addresses ───────────────────────────────────────────────────────
const POOL    = LENDING_CONTRACTS.LENDING_POOL;
const VUSDC   = LENDING_CONTRACTS.VUSDC;
const USDC    = LENDING_CONTRACTS.USDC;
const ORACLE  = LENDING_CONTRACTS.ORACLE;

export const COLLATERAL_TOKENS = {
  EURC: {
    address: LENDING_CONTRACTS.EURC,
    symbol: "EURC", name: "Euro Coin", decimals: 6,
    ltv: 80, liquidationThreshold: 85, liquidationBonus: 5,
  },
  cirBTC: {
    address: LENDING_CONTRACTS.CIRBTC,
    symbol: "cirBTC", name: "Circle BTC", decimals: 8,
    ltv: 70, liquidationThreshold: 75, liquidationBonus: 10,
  },
  USDC: {
    address: LENDING_CONTRACTS.USDC,
    symbol: "USDC", name: "USD Coin (collateral)", decimals: 6,
    ltv: 85, liquidationThreshold: 90, liquidationBonus: 5,
  },
} as const;
export type CollateralSymbol = keyof typeof COLLATERAL_TOKENS;

// ─── Arc public client ────────────────────────────────────────────────────────
const arcClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC),
});

// Pool interest model (matches VitaelLendingPool.sol)
const BASE_RATE = 2n * 10n ** 16n;
const OPTIMAL_UTILIZATION = 8n * 10n ** 17n;
const SLOPE_1 = 4n * 10n ** 16n;
const SLOPE_2 = 75n * 10n ** 16n;
const RESERVE_FACTOR_BPS = 1000n;

function computeBorrowRate(totalBorrowed: bigint, cash: bigint): bigint {
  if (totalBorrowed === 0n) return BASE_RATE;
  const totalSupply = cash + totalBorrowed;
  const u = (totalBorrowed * 10n ** 18n) / totalSupply;
  if (u < OPTIMAL_UTILIZATION) {
    return BASE_RATE + (u * SLOPE_1) / OPTIMAL_UTILIZATION;
  }
  return BASE_RATE + SLOPE_1 + ((u - OPTIMAL_UTILIZATION) * SLOPE_2) / (10n ** 18n - OPTIMAL_UTILIZATION);
}

function rateToApyPercent(rate: bigint): number {
  return Number(rate) / 1e16;
}

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  { type: "function", name: "balanceOf",  stateMutability: "view",       inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance",  stateMutability: "view",       inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",    stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer",   stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint",       stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

const POOL_ABI = [
  { type: "function", name: "supply",            stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdraw",           stateMutability: "nonpayable", inputs: [{ name: "vAmount", type: "uint256" }], outputs: [] },
  { type: "function", name: "depositCollateral",  stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdrawCollateral", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "borrow",             stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "repay",              stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "getHealthFactor",    stateMutability: "view",       inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getCompoundedBorrowBalance", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getExchangeRate",    stateMutability: "view",       inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getLatestState",     stateMutability: "view",       inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "totalBorrowedUSDC",  stateMutability: "view",       inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "userCollateral",     stateMutability: "view",       inputs: [{ name: "user", type: "address" }, { name: "token", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const ERC20_EXTRA_ABI = [
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const ORACLE_ABI = [
  { type: "function", name: "getAssetPrice", stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LendingState {
  step:  string;
  busy:  boolean;
  error: string | null;
  txHash: Hash | null;
}

export interface UserLendingInfo {
  usdcBalance:    string;  // wallet USDC balance
  vUsdcBalance:   string;  // vUSDC balance (supplied)
  suppliedUsdc:   string;  // USDC value of vUSDC
  borrowedUsdc:   string;  // current borrow balance
  healthFactor:   string;  // HF (∞ if no borrow)
  collaterals:    { symbol: CollateralSymbol; amount: string; valueUsd: string }[];
  exchangeRate:   string;
  totalBorrowed:  string;  // protocol total
}

export interface ProtocolStats {
  totalSuppliedUsdc: string;
  totalBorrowedUsdc: string;
  utilizationPct:    number;
  supplyApyPct:      number;
  borrowApyPct:      number;
  poolUsdcLiquidity: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLending() {
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync }   = useSwitchChain();

  const [state, setState] = useState<LendingState>({
    step: "idle", busy: false, error: null, txHash: null,
  });

  const setStep = (step: string, extra?: Partial<LendingState>) =>
    setState(prev => ({ ...prev, step, ...extra }));

  const failTx = (err: unknown) => {
    const poolMsg = parseLendingPoolError(err);
    const { message, cancelled } = parseWalletError(err);
    setState({
      step: cancelled ? "cancelled" : "error",
      busy: false,
      error: poolMsg ?? message,
      txHash: null,
    });
  };

  async function getPoolUsdcCash(): Promise<bigint> {
    if (!POOL) return 0n;
    return arcClient.readContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [POOL],
    });
  }

  async function simulatePoolCall(
    account: Address,
    functionName: "borrow" | "repay" | "supply" | "withdraw",
    args: readonly unknown[],
  ) {
    if (!POOL) throw new Error("Lending pool not configured");
    await arcClient.simulateContract({
      address: POOL,
      abi: POOL_ABI,
      functionName,
      args: args as never,
      account,
      chain: arcTestnet,
    });
  }

  async function ensureArc() {
    if (!walletClient) throw new Error("Wallet not connected");
    if (walletClient.chain.id !== arcTestnet.id)
      await switchChainAsync({ chainId: arcTestnet.id });
  }

  // Approve USDC to pool (handles Arc USDC precompile via direct transfer pattern)
  async function approveUsdc(amount: bigint) {
    if (!walletClient) throw new Error("Not connected");
    const account = walletClient.account.address;
    const allowance = await arcClient.readContract({
      address: USDC, abi: ERC20_ABI, functionName: "allowance", args: [account, POOL],
    }) as bigint;
    if (allowance < amount) {
      setStep("approving");
      const hash = await walletClient.sendTransaction({
        account, to: USDC,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [POOL, amount * 10n] }),
      });
      await arcClient.waitForTransactionReceipt({ hash });
    }
  }

  async function approveToken(token: Address, amount: bigint) {
    if (!walletClient) throw new Error("Not connected");
    const account = walletClient.account.address;
    const allowance = await arcClient.readContract({
      address: token, abi: ERC20_ABI, functionName: "allowance", args: [account, POOL],
    }) as bigint;
    if (allowance < amount) {
      setStep("approving");
      const hash = await walletClient.sendTransaction({
        account, to: token,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [POOL, amount * 10n] }),
      });
      await arcClient.waitForTransactionReceipt({ hash });
    }
  }

  // ── Supply USDC ─────────────────────────────────────────────────────────────
  const supply = useCallback(async (amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !POOL) throw new Error("Not configured");
      const account = walletClient.account.address;
      const amount  = parseUnits(amountHuman, 6);

      // Arc USDC: use transfer directly to pool then pool.supply(0) won't work
      // Pool uses safeTransferFrom — need approve first
      await approveUsdc(amount);

      setStep("supplying");
      const hash = await walletClient.sendTransaction({
        account, to: POOL,
        data: encodeFunctionData({ abi: POOL_ABI, functionName: "supply", args: [amount] }),
      });
      setStep("confirming", { txHash: hash });
      await arcClient.waitForTransactionReceipt({ hash });
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err: unknown) {
      failTx(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Withdraw (burn vUSDC) ───────────────────────────────────────────────────
  const withdraw = useCallback(async (vAmountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !POOL) throw new Error("Not configured");
      const account  = walletClient.account.address;
      const vAmount  = parseUnits(vAmountHuman, 6);

      setStep("withdrawing");
      const hash = await walletClient.sendTransaction({
        account, to: POOL,
        data: encodeFunctionData({ abi: POOL_ABI, functionName: "withdraw", args: [vAmount] }),
      });
      setStep("confirming", { txHash: hash });
      await arcClient.waitForTransactionReceipt({ hash });
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err: unknown) {
      failTx(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Deposit Collateral ──────────────────────────────────────────────────────
  const depositCollateral = useCallback(async (symbol: CollateralSymbol, amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !POOL) throw new Error("Not configured");
      const token   = COLLATERAL_TOKENS[symbol];
      const account = walletClient.account.address;
      const amount  = parseUnits(amountHuman, token.decimals);

      await approveToken(token.address, amount);

      setStep("depositing");
      const hash = await walletClient.sendTransaction({
        account, to: POOL,
        data: encodeFunctionData({ abi: POOL_ABI, functionName: "depositCollateral", args: [token.address, amount] }),
      });
      setStep("confirming", { txHash: hash });
      await arcClient.waitForTransactionReceipt({ hash });
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err: unknown) {
      failTx(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Withdraw Collateral ─────────────────────────────────────────────────────
  const withdrawCollateral = useCallback(async (symbol: CollateralSymbol, amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !POOL) throw new Error("Not configured");
      const token   = COLLATERAL_TOKENS[symbol];
      const account = walletClient.account.address;
      const amount  = parseUnits(amountHuman, token.decimals);

      setStep("withdrawing");
      const hash = await walletClient.sendTransaction({
        account, to: POOL,
        data: encodeFunctionData({ abi: POOL_ABI, functionName: "withdrawCollateral", args: [token.address, amount] }),
      });
      setStep("confirming", { txHash: hash });
      await arcClient.waitForTransactionReceipt({ hash });
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err: unknown) {
      failTx(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Borrow USDC ─────────────────────────────────────────────────────────────
  const borrow = useCallback(async (amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !POOL) throw new Error("Not configured");
      const account = walletClient.account.address;
      const amount  = parseUnits(amountHuman, 6);

      const poolCash = await getPoolUsdcCash();
      if (poolCash < amount) {
        const avail = formatUnits(poolCash, 6);
        throw new Error(
          poolCash === 0n
            ? "The pool has 0 USDC available to borrow. Supply USDC on the Lend page first."
            : `Only ${avail} USDC is available in the pool. Reduce your borrow amount or wait for more suppliers.`,
        );
      }

      await simulatePoolCall(account, "borrow", [amount]);

      setStep("borrowing");
      const hash = await walletClient.sendTransaction({
        account,
        chain: arcTestnet,
        to: POOL,
        data: encodeFunctionData({ abi: POOL_ABI, functionName: "borrow", args: [amount] }),
      });
      setStep("confirming", { txHash: hash });
      await arcClient.waitForTransactionReceipt({ hash });
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err: unknown) {
      failTx(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Repay USDC ──────────────────────────────────────────────────────────────
  const repay = useCallback(async (amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient || !POOL) throw new Error("Not configured");
      const account = walletClient.account.address;
      const amount  = parseUnits(amountHuman, 6);

      await approveUsdc(amount);

      setStep("repaying");
      const hash = await walletClient.sendTransaction({
        account, to: POOL,
        data: encodeFunctionData({ abi: POOL_ABI, functionName: "repay", args: [amount] }),
      });
      setStep("confirming", { txHash: hash });
      await arcClient.waitForTransactionReceipt({ hash });
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err: unknown) {
      failTx(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Mint mock collateral (testnet only) ─────────────────────────────────────
  const mintCollateral = useCallback(async (symbol: CollateralSymbol, amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient) throw new Error("Not connected");
      const token   = COLLATERAL_TOKENS[symbol];
      const account = walletClient.account.address;
      const amount  = parseUnits(amountHuman, token.decimals);

      setStep("minting");
      const hash = await walletClient.sendTransaction({
        account, to: token.address,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: "mint", args: [account, amount] }),
      });
      setStep("confirming", { txHash: hash });
      await arcClient.waitForTransactionReceipt({ hash });
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err: unknown) {
      failTx(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Read protocol-wide stats (on-chain) ─────────────────────────────────────
  const getProtocolStats = useCallback(async (): Promise<ProtocolStats | null> => {
    if (!POOL || !VUSDC) return null;
    try {
      const [cash, latestState, exchangeRate, vSupply] = await Promise.all([
        arcClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [POOL] }),
        arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "getLatestState" }),
        arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "getExchangeRate" }),
        arcClient.readContract({ address: VUSDC, abi: [...ERC20_ABI, ...ERC20_EXTRA_ABI], functionName: "totalSupply" }),
      ]);

      const [, currentTotalBorrowed] = latestState as [bigint, bigint];

      const cashBal = cash as bigint;
      const borrowed = currentTotalBorrowed;
      const rate = exchangeRate as bigint;
      const vSup = vSupply as bigint;

      const totalSupplied = vSup > 0n
        ? (vSup * rate) / BigInt(1e18)
        : cashBal + borrowed;

      const borrowRate = computeBorrowRate(borrowed, cashBal);
      const utilization = borrowed === 0n || totalSupplied === 0n
        ? 0
        : Number((borrowed * 10000n) / (cashBal + borrowed)) / 100;

      const u = borrowed === 0n ? 0n : (borrowed * 10n ** 18n) / (cashBal + borrowed);
      const supplyRate = borrowed === 0n
        ? 0n
        : (borrowRate * u * (10000n - RESERVE_FACTOR_BPS)) / (10n ** 18n * 10000n);

      return {
        totalSuppliedUsdc: formatUnits(totalSupplied, 6),
        totalBorrowedUsdc: formatUnits(borrowed, 6),
        utilizationPct: utilization,
        supplyApyPct: rateToApyPercent(supplyRate),
        borrowApyPct: rateToApyPercent(borrowRate),
        poolUsdcLiquidity: formatUnits(cashBal, 6),
      };
    } catch { return null; }
  }, []);

  // ── Read user info ──────────────────────────────────────────────────────────
  const getUserInfo = useCallback(async (userAddress: Address): Promise<UserLendingInfo | null> => {
    if (!POOL || !VUSDC) return null;
    try {
      const [usdcBal, vUsdcBal, borrowBal, hfRaw, exchangeRate, totalBorrowed] = await Promise.all([
        arcClient.readContract({ address: USDC,  abi: ERC20_ABI, functionName: "balanceOf", args: [userAddress] }),
        arcClient.readContract({ address: VUSDC, abi: ERC20_ABI, functionName: "balanceOf", args: [userAddress] }),
        arcClient.readContract({ address: POOL,  abi: POOL_ABI,  functionName: "getCompoundedBorrowBalance", args: [userAddress] }),
        arcClient.readContract({ address: POOL,  abi: POOL_ABI,  functionName: "getHealthFactor", args: [userAddress] }),
        arcClient.readContract({ address: POOL,  abi: POOL_ABI,  functionName: "getExchangeRate" }),
        arcClient.readContract({ address: POOL,  abi: POOL_ABI,  functionName: "totalBorrowedUSDC" }),
      ]);

      const rate = exchangeRate as bigint;
      const vBal = vUsdcBal as bigint;
      const suppliedUsdc = (vBal * rate) / BigInt(1e18);

      const hf = hfRaw as bigint;
      const hfStr = hf === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
        ? "∞"
        : (Number(hf) / 1e18).toFixed(2);

      // Collateral balances
      const collaterals = await Promise.all(
        Object.entries(COLLATERAL_TOKENS).map(async ([sym, token]) => {
          const amt = await arcClient.readContract({
            address: POOL, abi: POOL_ABI, functionName: "userCollateral",
            args: [userAddress, token.address],
          }) as bigint;

          let valueUsd = "—";
          if (ORACLE && token.address && amt > 0n) {
            try {
              const price8 = await arcClient.readContract({
                address: ORACLE, abi: ORACLE_ABI, functionName: "getAssetPrice",
                args: [token.address],
              }) as bigint;
              const usd = (amt * price8) / BigInt(10 ** token.decimals);
              valueUsd = `$${formatUnits(usd, 8)}`;
            } catch { /* feed stale or unset */ }
          }

          return {
            symbol: sym as CollateralSymbol,
            amount: formatUnits(amt, token.decimals),
            valueUsd,
          };
        })
      );

      return {
        usdcBalance:   formatUnits(usdcBal as bigint, 6),
        vUsdcBalance:  formatUnits(vBal, 6),
        suppliedUsdc:  formatUnits(suppliedUsdc, 6),
        borrowedUsdc:  formatUnits(borrowBal as bigint, 6),
        healthFactor:  hfStr,
        collaterals,
        exchangeRate:  (Number(rate) / 1e18).toFixed(6),
        totalBorrowed: formatUnits(totalBorrowed as bigint, 6),
      };
    } catch { return null; }
  }, []);

  const reset = useCallback(() =>
    setState({ step: "idle", busy: false, error: null, txHash: null }), []);

  return {
    state, reset,
    supply, withdraw,
    depositCollateral, withdrawCollateral,
    borrow, repay,
    mintCollateral,
    getUserInfo,
    getProtocolStats,
    POOL, VUSDC, USDC,
    COLLATERAL_TOKENS,
  };
}
