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

// ─── Token registry ───────────────────────────────────────────────────────────
export const SUPPORTED_TOKENS = {
  USDC: {
    address:              LENDING_CONTRACTS.USDC,
    symbol:               "USDC",
    name:                 "USD Coin",
    decimals:             6,
    ltv:                  90,
    liquidationThreshold: 92,
    liquidationBonus:     5,
    color:                "#00F5FF",
  },
  EURC: {
    address:              LENDING_CONTRACTS.EURC,
    symbol:               "EURC",
    name:                 "Euro Coin",
    decimals:             6,
    ltv:                  85,
    liquidationThreshold: 88,
    liquidationBonus:     5,
    color:                "#8B00FF",
  },
  cirBTC: {
    address:              LENDING_CONTRACTS.CIRBTC,
    symbol:               "cirBTC",
    name:                 "Circle BTC",
    decimals:             8,
    ltv:                  70,
    liquidationThreshold: 75,
    liquidationBonus:     10,
    color:                "#FF9900",
  },
} as const;

export type TokenSymbol = keyof typeof SUPPORTED_TOKENS;
export const TOKEN_SYMBOLS = Object.keys(SUPPORTED_TOKENS) as TokenSymbol[];

// Legacy alias — borrow page still uses COLLATERAL_TOKENS
export const COLLATERAL_TOKENS = SUPPORTED_TOKENS;
export type CollateralSymbol = TokenSymbol;

// ─── Arc public client ────────────────────────────────────────────────────────
const arcClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC),
});

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  { type: "function", name: "balanceOf",   stateMutability: "view",       inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance",   stateMutability: "view",       inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",     stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "totalSupply", stateMutability: "view",       inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const POOL_ABI = [
  // Supply / Withdraw
  { type: "function", name: "supply",            stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdraw",          stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "shares", type: "uint256" }], outputs: [] },
  // Collateral
  { type: "function", name: "depositCollateral", stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdrawCollateral",stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  // Borrow / Repay
  { type: "function", name: "borrow",            stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "repay",             stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  // Liquidate
  { type: "function", name: "liquidate",         stateMutability: "nonpayable",
    inputs: [
      { name: "borrower",        type: "address" },
      { name: "debtAsset",       type: "address" },
      { name: "collateralAsset", type: "address" },
      { name: "repayAmount",     type: "uint256" },
    ], outputs: [] },
  // Views
  { type: "function", name: "getHealthFactor",   stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getBorrowBalance",  stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getSupplyBalance",  stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "exchangeRate",      stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getBorrowRate",     stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getSupplyRate",     stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getUtilization",    stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getPosition",       stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "userShares",        stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "userCollateral",    stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "assetStates",       stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [
    { name: "totalBorrowed",   type: "uint256" },
    { name: "totalReserves",   type: "uint256" },
    { name: "borrowIndex",     type: "uint256" },
    { name: "lastAccruedTime", type: "uint256" },
    { name: "totalShares",     type: "uint256" },
  ]},
] as const;

const ORACLE_ABI = [
  { type: "function", name: "getAssetPrice", stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LendingState {
  step:   string;
  busy:   boolean;
  error:  string | null;
  txHash: Hash | null;
}

export interface AssetMarketInfo {
  symbol:       TokenSymbol;
  supplyApyPct: number;
  borrowApyPct: number;
  utilizationPct: number;
  totalSupplied: string;   // human-readable
  totalBorrowed: string;
  liquidity:     string;
  exchangeRate:  string;   // 1 share = X tokens
}

export interface UserAssetInfo {
  symbol:          TokenSymbol;
  walletBalance:   string;
  supplyBalance:   string;   // supplied (earning yield)
  collateral:      string;   // dedicated collateral
  borrowBalance:   string;
  shares:          string;
}

export interface UserPosition {
  assets:             UserAssetInfo[];
  totalCollateralUSD: string;
  totalBorrowUSD:     string;
  healthFactor:       string;
}

// Legacy compat for borrow page
export interface UserLendingInfo {
  usdcBalance:   string;
  vUsdcBalance:  string;
  suppliedUsdc:  string;
  borrowedUsdc:  string;
  healthFactor:  string;
  collaterals:   { symbol: CollateralSymbol; amount: string; valueUsd: string }[];
  exchangeRate:  string;
  totalBorrowed: string;
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
  const POOL = LENDING_CONTRACTS.LENDING_POOL;

  const [state, setState] = useState<LendingState>({
    step: "idle", busy: false, error: null, txHash: null,
  });

  const setStep = (step: string, extra?: Partial<LendingState>) =>
    setState(prev => ({ ...prev, step, ...extra }));

  const failTx = (err: unknown) => {
    const poolMsg = parseLendingPoolError(err);
    const { message, cancelled } = parseWalletError(err);
    setState({
      step:   cancelled ? "cancelled" : "error",
      busy:   false,
      error:  poolMsg ?? message,
      txHash: null,
    });
  };

  const reset = useCallback(() =>
    setState({ step: "idle", busy: false, error: null, txHash: null }), []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async function ensureArc() {
    if (!walletClient) throw new Error("Wallet not connected");
    if (walletClient.chain.id !== arcTestnet.id)
      await switchChainAsync({ chainId: arcTestnet.id });
  }

  async function approveToken(tokenAddr: Address, amount: bigint) {
    if (!walletClient || !POOL) throw new Error("Not configured");
    const account = walletClient.account.address;
    const allowance = await arcClient.readContract({
      address: tokenAddr, abi: ERC20_ABI, functionName: "allowance",
      args: [account, POOL],
    }) as bigint;
    if (allowance < amount) {
      setStep("approving");
      const hash = await walletClient.sendTransaction({
        account, to: tokenAddr,
        data: encodeFunctionData({
          abi: ERC20_ABI, functionName: "approve",
          args: [POOL, amount * 10n],
        }),
      });
      const receipt = await arcClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Approval transaction failed");
      }
    }
  }

  async function sendPoolTx(
    step: string,
    fnName: string,
    args: readonly unknown[],
  ): Promise<Hash> {
    if (!walletClient || !POOL) throw new Error("Not configured");
    const account = walletClient.account.address;
    setStep(step);
    const hash = await walletClient.sendTransaction({
      account, to: POOL,
      data: encodeFunctionData({ abi: POOL_ABI, functionName: fnName as never, args: args as never }),
    });
    setStep("confirming", { txHash: hash });
    const receipt = await arcClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      throw new Error(`${fnName} transaction failed on-chain`);
    }
    return hash;
  }

  // ── Supply ──────────────────────────────────────────────────────────────────
  const supply = useCallback(async (symbol: TokenSymbol, amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      const token  = SUPPORTED_TOKENS[symbol];
      const amount = parseUnits(amountHuman, token.decimals);
      await approveToken(token.address, amount);
      const hash = await sendPoolTx("supplying", "supply", [token.address, amount]);
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err) { failTx(err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Withdraw (by shares) ────────────────────────────────────────────────────
  const withdraw = useCallback(async (symbol: TokenSymbol, sharesHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      const token  = SUPPORTED_TOKENS[symbol];
      // shares have same decimals as the underlying token
      const shares = parseUnits(sharesHuman, token.decimals);
      const hash = await sendPoolTx("withdrawing", "withdraw", [token.address, shares]);
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err) { failTx(err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Deposit Collateral ──────────────────────────────────────────────────────
  const depositCollateral = useCallback(async (symbol: TokenSymbol, amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      const token  = SUPPORTED_TOKENS[symbol];
      const amount = parseUnits(amountHuman, token.decimals);
      await approveToken(token.address, amount);
      const hash = await sendPoolTx("depositing", "depositCollateral", [token.address, amount]);
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err) { failTx(err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Withdraw Collateral ─────────────────────────────────────────────────────
  const withdrawCollateral = useCallback(async (symbol: TokenSymbol, amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      const token  = SUPPORTED_TOKENS[symbol];
      const amount = parseUnits(amountHuman, token.decimals);
      const hash = await sendPoolTx("withdrawing", "withdrawCollateral", [token.address, amount]);
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err) { failTx(err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Borrow ──────────────────────────────────────────────────────────────────
  const borrow = useCallback(async (symbol: TokenSymbol, amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      const token  = SUPPORTED_TOKENS[symbol];
      const amount = parseUnits(amountHuman, token.decimals);

      // Pre-check liquidity
      const cash = await arcClient.readContract({
        address: token.address, abi: ERC20_ABI, functionName: "balanceOf", args: [POOL],
      }) as bigint;
      if (cash < amount) {
        const avail = formatUnits(cash, token.decimals);
        throw new Error(`Only ${avail} ${symbol} available in pool. Supply more first.`);
      }

      const hash = await sendPoolTx("borrowing", "borrow", [token.address, amount]);
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err) { failTx(err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Repay ───────────────────────────────────────────────────────────────────
  const repay = useCallback(async (symbol: TokenSymbol, amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      const token  = SUPPORTED_TOKENS[symbol];
      const amount = parseUnits(amountHuman, token.decimals);
      await approveToken(token.address, amount);
      const hash = await sendPoolTx("repaying", "repay", [token.address, amount]);
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err) { failTx(err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  // ── Liquidate ───────────────────────────────────────────────────────────────
  const liquidate = useCallback(async (
    borrower: Address,
    debtSymbol: TokenSymbol,
    collateralSymbol: TokenSymbol,
    repayAmountHuman: string,
  ) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      const debtToken  = SUPPORTED_TOKENS[debtSymbol];
      const collToken  = SUPPORTED_TOKENS[collateralSymbol];
      const amount     = parseUnits(repayAmountHuman, debtToken.decimals);
      await approveToken(debtToken.address, amount);
      const hash = await sendPoolTx("liquidating", "liquidate", [
        borrower, debtToken.address, collToken.address, amount,
      ]);
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err) { failTx(err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);


  // ── Read: per-asset market info ─────────────────────────────────────────────
  const getMarketInfo = useCallback(async (): Promise<AssetMarketInfo[]> => {
    if (!POOL) return [];
    try {
      return await Promise.all(
        TOKEN_SYMBOLS.map(async (sym) => {
          const token = SUPPORTED_TOKENS[sym];
          const addr  = token.address;

          const [cash, state, supplyRate, borrowRate, utilization] = await Promise.all([
            arcClient.readContract({ address: addr, abi: ERC20_ABI, functionName: "balanceOf", args: [POOL] }),
            arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "assetStates", args: [addr] }),
            arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "getSupplyRate", args: [addr] }),
            arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "getBorrowRate",  args: [addr] }),
            arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "getUtilization", args: [addr] }),
          ]);

          const s = state as readonly [bigint, bigint, bigint, bigint, bigint];
          const cashBal   = cash as bigint;
          const borrowed  = s[0];  // totalBorrowed
          const shares    = s[4];  // totalShares

          // total supplied = cash + borrowed (simplified; excludes reserves)
          const totalSupplied = cashBal + borrowed;

          const rate = shares > 0n
            ? await arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "exchangeRate", args: [addr] }) as bigint
            : BigInt(1e18);

          return {
            symbol:         sym,
            supplyApyPct:   Number(supplyRate as bigint) / 1e16,
            borrowApyPct:   Number(borrowRate as bigint) / 1e16,
            utilizationPct: Number(utilization as bigint) / 1e16,
            totalSupplied:  formatUnits(totalSupplied, token.decimals),
            totalBorrowed:  formatUnits(borrowed, token.decimals),
            liquidity:      formatUnits(cashBal, token.decimals),
            exchangeRate:   (Number(rate) / 1e18).toFixed(6),
          };
        })
      );
    } catch { return []; }
  }, [POOL]);

  // ── Read: user position ─────────────────────────────────────────────────────
  const getUserPosition = useCallback(async (userAddress: Address): Promise<UserPosition | null> => {
    if (!POOL) return null;
    try {
      const [positionRaw, hfRaw] = await Promise.all([
        arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "getPosition", args: [userAddress] }),
        arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "getHealthFactor", args: [userAddress] }),
      ]);

      const [collUSD, borrowUSD] = positionRaw as [bigint, bigint, bigint];
      const hf = hfRaw as bigint;
      const hfStr = hf === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
        ? "∞"
        : (Number(hf) / 1e18).toFixed(2);

      const assets = await Promise.all(
        TOKEN_SYMBOLS.map(async (sym) => {
          const token = SUPPORTED_TOKENS[sym];
          const addr  = token.address;

          const [walletBal, supplyBal, collateral, borrowBal, shares] = await Promise.all([
            arcClient.readContract({ address: addr, abi: ERC20_ABI, functionName: "balanceOf", args: [userAddress] }),
            arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "getSupplyBalance", args: [userAddress, addr] }),
            arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "userCollateral",   args: [userAddress, addr] }),
            arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "getBorrowBalance", args: [userAddress, addr] }),
            arcClient.readContract({ address: POOL, abi: POOL_ABI, functionName: "userShares",       args: [userAddress, addr] }),
          ]);

          return {
            symbol:        sym,
            walletBalance: formatUnits(walletBal as bigint, token.decimals),
            supplyBalance: formatUnits(supplyBal as bigint, token.decimals),
            collateral:    formatUnits(collateral as bigint, token.decimals),
            borrowBalance: formatUnits(borrowBal as bigint, token.decimals),
            shares:        formatUnits(shares as bigint, token.decimals),
          };
        })
      );

      return {
        assets,
        totalCollateralUSD: formatUnits(collUSD, 8),
        totalBorrowUSD:     formatUnits(borrowUSD, 8),
        healthFactor:       hfStr,
      };
    } catch { return null; }
  }, [POOL]);

  // ── Legacy compat: getUserInfo (used by borrow page) ────────────────────────
  const getUserInfo = useCallback(async (userAddress: Address): Promise<UserLendingInfo | null> => {
    const pos = await getUserPosition(userAddress);
    if (!pos) return null;

    const usdcInfo = pos.assets.find(a => a.symbol === "USDC");
    const oracle   = LENDING_CONTRACTS.ORACLE;

    const collaterals = await Promise.all(
      pos.assets.map(async (a) => {
        let valueUsd = "—";
        const totalAmt = parseFloat(a.collateral) + parseFloat(a.supplyBalance);
        if (oracle && totalAmt > 0) {
          try {
            const token = SUPPORTED_TOKENS[a.symbol];
            const price = await arcClient.readContract({
              address: oracle, abi: ORACLE_ABI, functionName: "getAssetPrice", args: [token.address],
            }) as bigint;
            const raw = (BigInt(Math.round(totalAmt * 10 ** token.decimals)) * price) / BigInt(10 ** token.decimals);
            valueUsd = `$${formatUnits(raw, 8)}`;
          } catch { /* stale */ }
        }
        return { symbol: a.symbol as CollateralSymbol, amount: a.collateral, valueUsd };
      })
    );

    const usdcRate = await arcClient.readContract({
      address: POOL, abi: POOL_ABI, functionName: "exchangeRate",
      args: [LENDING_CONTRACTS.USDC],
    }).catch(() => BigInt(1e18)) as bigint;

    return {
      usdcBalance:   usdcInfo?.walletBalance  ?? "0",
      vUsdcBalance:  usdcInfo?.shares         ?? "0",
      suppliedUsdc:  usdcInfo?.supplyBalance  ?? "0",
      borrowedUsdc:  usdcInfo?.borrowBalance  ?? "0",
      healthFactor:  pos.healthFactor,
      collaterals,
      exchangeRate:  (Number(usdcRate) / 1e18).toFixed(6),
      totalBorrowed: pos.totalBorrowUSD,
    };
  }, [getUserPosition, POOL]);

  // ── Legacy compat: getProtocolStats ─────────────────────────────────────────
  const getProtocolStats = useCallback(async (): Promise<ProtocolStats | null> => {
    const markets = await getMarketInfo();
    const usdc = markets.find(m => m.symbol === "USDC");
    if (!usdc) return null;
    return {
      totalSuppliedUsdc: usdc.totalSupplied,
      totalBorrowedUsdc: usdc.totalBorrowed,
      utilizationPct:    usdc.utilizationPct,
      supplyApyPct:      usdc.supplyApyPct,
      borrowApyPct:      usdc.borrowApyPct,
      poolUsdcLiquidity: usdc.liquidity,
    };
  }, [getMarketInfo]);

  // ── Mint mock collateral (testnet only) ─────────────────────────────────────
  const mintCollateral = useCallback(async (symbol: TokenSymbol, amountHuman: string) => {
    setState({ step: "switching", busy: true, error: null, txHash: null });
    try {
      await ensureArc();
      if (!walletClient) throw new Error("Not connected");
      const token   = SUPPORTED_TOKENS[symbol];
      const account = walletClient.account.address;
      const amount  = parseUnits(amountHuman, token.decimals);
      const MINT_ABI = [{ type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }] as const;
      setStep("minting");
      const hash = await walletClient.sendTransaction({
        account, to: token.address,
        data: encodeFunctionData({ abi: MINT_ABI, functionName: "mint", args: [account, amount] }),
      });
      setStep("confirming", { txHash: hash });
      const receipt = await arcClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Mint transaction failed on-chain");
      }
      setState({ step: "done", busy: false, error: null, txHash: hash });
    } catch (err) { failTx(err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  return {
    state, reset,
    supply, withdraw,
    depositCollateral, withdrawCollateral,
    borrow, repay,
    liquidate,
    mintCollateral,
    getUserPosition,
    getUserInfo,
    getProtocolStats,
    getMarketInfo,
    POOL,
    SUPPORTED_TOKENS,
    COLLATERAL_TOKENS,
  };
}
