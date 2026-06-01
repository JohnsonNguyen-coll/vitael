"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown,
  AlertTriangle, ExternalLink, Droplets,
} from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import WalletActionGate, { WalletConnectPrompt } from "../../components/WalletActionGate";
import { formatUsd, formatTokenAmount } from "../../lib/format";
import TxStatusBanner from "../../components/TxStatusBanner";
import OracleStatusBanner from "../../components/OracleStatusBanner";
import { checkOracleFeeds, oracleReadyForBorrow, type OracleAssetStatus } from "../../lib/oracleHealth";
import Header from "../../components/Header";
import WaterfallBackground from "../../components/WaterfallBackground";
import Footer from "../../components/Footer";
import TokenIcon from "../../components/TokenIcon";
import {
  useLending, COLLATERAL_TOKENS,
  type UserLendingInfo, type CollateralSymbol, type ProtocolStats,
} from "../../hooks/useLending";
import { CIRCLE_FAUCET_URL } from "../../lib/arcTokens";

const COLLATERAL_SYMBOLS = ["EURC", "cirBTC", "USDC"] as const satisfies readonly CollateralSymbol[];

const COLLATERAL_MARKETS = COLLATERAL_SYMBOLS.map((sym) => ({
  symbol: sym,
  name: COLLATERAL_TOKENS[sym].name,
  ltv: COLLATERAL_TOKENS[sym].ltv,
}));

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Asset {
  symbol: string; name: string;
  supplyAPY: number; borrowAPY: number;
  ltv: number; liquidity: string;
}

function fmtLiquidity(usdc: string): string {
  const n = parseFloat(usdc);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── Step labels ──────────────────────────────────────────────────────────────
const STEP_LABELS: Record<string, string> = {
  switching:  "Switching to Arc Testnet...",
  approving:  "Approving...",
  borrowing:  "Borrowing — sign in wallet...",
  repaying:   "Repaying — sign in wallet...",
  depositing: "Depositing collateral — sign in wallet...",
  withdrawing:"Withdrawing collateral — sign in wallet...",
  minting:    "Minting testnet tokens — sign in wallet...",
  confirming: "Waiting for confirmation...",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false, loading = false, valueClass }: {
  label: string; value: string; sub?: string; accent?: boolean; loading?: boolean; valueClass?: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">{label}</p>
      {loading
        ? <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
        : <p suppressHydrationWarning className={`text-2xl font-extrabold ${valueClass ?? (accent ? "text-[#FF00C8]" : "text-white")}`}>{value}</p>
      }
      {sub && !loading && <p className="text-xs text-emerald-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Health factor color ──────────────────────────────────────────────────────
function hfColor(hf: string): string {
  if (hf === "∞") return "text-emerald-400";
  const n = parseFloat(hf);
  if (n > 1.5) return "text-emerald-400";
  if (n > 1.1) return "text-yellow-400";
  return "text-red-400";
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function BorrowPage() {
  const { isConnected, address } = useAccount();
  const {
    state, reset,
    borrow, repay,
    depositCollateral, withdrawCollateral,
    getUserInfo, getProtocolStats,
  } = useLending();

  const [protocolStats, setProtocolStats] = useState<ProtocolStats | null>(null);
  const [oracleStatus, setOracleStatus] = useState<OracleAssetStatus[] | null>(null);
  const [oracleLoading, setOracleLoading] = useState(true);
  const usdcAsset: Asset = {
    symbol: "USDC",
    name: "USD Coin",
    supplyAPY: protocolStats?.supplyApyPct ?? 0,
    borrowAPY: protocolStats?.borrowApyPct ?? 0,
    ltv: 0,
    liquidity: protocolStats ? fmtLiquidity(protocolStats.poolUsdcLiquidity) : "—",
  };
  const active = usdcAsset;
  const [subTab, setSubTab]               = useState<"borrow" | "repay">("borrow");
  const [amount, setAmount]               = useState("");
  const [userInfo, setUserInfo]           = useState<UserLendingInfo | null>(null);
  const [infoLoading, setInfoLoading]     = useState(false);

  // Collateral panel state
  const [collateralTab, setCollateralTab] = useState<"deposit" | "withdraw">("deposit");
  const [collSymbol, setCollSymbol]       = useState<CollateralSymbol>("EURC");
  const [collAmount, setCollAmount]       = useState("");

  // Fetch wallet balance for selected collateral token
  const { data: collBalanceData, refetch: refetchCollBalance } = useReadContract({
    address: COLLATERAL_TOKENS[collSymbol].address as `0x${string}`,
    abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }],
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const collWalletBalance = collBalanceData
    ? formatUnits(collBalanceData as bigint, COLLATERAL_TOKENS[collSymbol].decimals)
    : "0";

  // Refetch balance when token changes or tx completes
  useEffect(() => {
    if (address) refetchCollBalance();
  }, [collSymbol, address, state.step, refetchCollBalance]);

  const num  = parseFloat(amount) || 0;
  const busy = state.busy;
  const poolLiquidityUsdc = parseFloat(protocolStats?.poolUsdcLiquidity ?? "0") || 0;
  const noPoolLiquidity = subTab === "borrow" && poolLiquidityUsdc <= 0;
  const borrowExceedsPool = subTab === "borrow" && num > 0 && num > poolLiquidityUsdc;
  const oracleOk = oracleReadyForBorrow(oracleStatus ?? []);

  const borrowedUsdc = userInfo?.borrowedUsdc ?? "0";
  const healthFactor = userInfo?.healthFactor ?? "∞";
  const collaterals  = userInfo?.collaterals  ?? [];

  // Calculate max borrow based on collateral value and LTV
  const totalCollateralValueUsd = collaterals.reduce((sum, c) => sum + parseFloat(c.valueUsd), 0);
  const currentBorrowedUsd = parseFloat(borrowedUsdc);
  const maxBorrowUSD = Math.max(0, totalCollateralValueUsd * 0.9 - currentBorrowedUsd); // Assuming 90% max LTV

  const monthly = (num * (active.borrowAPY / 100)) / 12;

  useEffect(() => {
    let cancelled = false;
    getProtocolStats().then(stats => { if (!cancelled && stats) setProtocolStats(stats); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    checkOracleFeeds()
      .then(setOracleStatus)
      .finally(() => setOracleLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isConnected || !address) {
      Promise.resolve().then(() => { if (!cancelled) setUserInfo(null); });
      return () => { cancelled = true; };
    }
    Promise.resolve()
      .then(() => { if (!cancelled) setInfoLoading(true); })
      .then(() => getUserInfo(address))
      .then(info => { if (!cancelled) setUserInfo(info); })
      .finally(() => { if (!cancelled) setInfoLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  useEffect(() => {
    if (state.step !== "done") return;
    let cancelled = false;
    getProtocolStats().then(stats => { if (!cancelled && stats) setProtocolStats(stats); });
    if (address) {
      Promise.resolve()
        .then(() => { if (!cancelled) setInfoLoading(true); })
        .then(() => getUserInfo(address))
        .then(info => { if (!cancelled) setUserInfo(info); })
        .finally(() => { if (!cancelled) setInfoLoading(false); });
    }
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  async function executeBorrowRepay() {
    if (!amount || num <= 0) return;
    reset();
    if (subTab === "borrow") {
      await borrow("USDC", amount);
    } else {
      await repay("USDC", amount);
    }
  }

  async function executeCollateral() {
    if (!collAmount || parseFloat(collAmount) <= 0) return;
    reset();
    if (collateralTab === "deposit") {
      await depositCollateral(collSymbol, collAmount);
    } else {
      await withdrawCollateral(collSymbol, collAmount);
    }
  }

  const isRisky = healthFactor !== "∞" && parseFloat(healthFactor) < 1.2;

  const fmtUsdc = (v: string) => formatUsd(parseFloat(v));

  return (
    <div className="relative min-h-screen text-white font-sans">
      <WaterfallBackground />
      <Header />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-8">

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="text-xs uppercase tracking-widest text-[#FF00C8] font-bold mb-2 block">Arc Testnet · Vitael Protocol</span>
          <h1 className="text-4xl font-extrabold text-white">Borrow</h1>
          <p className="text-[#8E9FB8] mt-2 text-sm">Get Arc tokens → deposit collateral → borrow USDC (Stork oracle).</p>
        </motion.div>

        <OracleStatusBanner status={oracleStatus} loading={oracleLoading} />

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Borrowed"
            value={fmtUsdc(borrowedUsdc)}
            sub={protocolStats ? `${protocolStats.borrowApyPct.toFixed(2)}% APY` : "Live APY"}
            accent
            loading={infoLoading}
          />
          <StatCard
            label="Health Factor"
            value={healthFactor}
            sub={healthFactor === "∞" ? "No debt" : parseFloat(healthFactor) > 1.5 ? "Safe zone" : parseFloat(healthFactor) > 1.1 ? "Caution" : "At risk!"}
            loading={infoLoading}
            valueClass={hfColor(healthFactor)}
          />
          {collaterals.map((c, i) => i < 2 && (
            <StatCard
              key={c.symbol}
              label={`${c.symbol} Collateral`}
              value={formatTokenAmount(c.amount, { min: 4, max: 6 })}
              sub={`LTV ${COLLATERAL_TOKENS[c.symbol].ltv}%`}
              loading={infoLoading}
            />
          ))}
          {collaterals.length === 0 && !infoLoading && (
            <StatCard label="Collateral" value="None" sub="Deposit to borrow" />
          )}
        </motion.div>

        {/* Main content */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

            {/* Asset table + positions */}
            <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-white/5 space-y-4">
                <div>
                  <h2 className="font-bold text-white">Borrow from pool</h2>
                  <p className="text-xs text-[#8E9FB8] mt-0.5">Borrowable asset — USDC only</p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#FF00C8]/25 bg-[#FF00C8]/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol="USDC" size={40} />
                    <div>
                      <p className="font-bold text-white">USDC</p>
                      <p className="text-xs text-[#8E9FB8]">Borrow APY {usdcAsset.borrowAPY > 0 ? `${usdcAsset.borrowAPY.toFixed(2)}%` : "—"} · Pool {usdcAsset.liquidity}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#FF00C8] border border-[#FF00C8]/40 px-2 py-1 rounded-full">
                    Borrow asset
                  </span>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-white/5">
                <h3 className="text-xs font-bold text-[#8B00FF] uppercase tracking-wider mb-1">Accepted collateral</h3>
                <p className="text-xs text-[#8E9FB8] mb-3">Deposit these tokens in the right panel, then borrow USDC</p>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[#8E9FB8] border-b border-white/5">
                      <th className="py-2 pr-4">Token</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Max LTV</th>
                      <th className="py-2 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COLLATERAL_MARKETS.map((c) => (
                      <tr key={c.symbol} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <TokenIcon symbol={c.symbol} size={26} />
                            <span className="font-semibold text-white">{c.symbol}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[#8E9FB8]">Collateral</td>
                        <td className="py-3 pr-4 text-white">{c.ltv}%</td>
                        <td className="py-3 text-right">
                          <a href="#collateral" className="text-xs font-semibold text-[#8B00FF] hover:underline">
                            Deposit ↓
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Collateral + Borrowed positions */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5 border-t border-white/5">
                <div className="px-6 py-5">
                  <p className="text-xs uppercase tracking-wider text-[#8B00FF] font-bold mb-4">Your Collateral</p>
                  {!isConnected ? (
                    <p className="text-xs text-[#8E9FB8]">Connect wallet to see collateral.</p>
                  ) : infoLoading ? (
                    <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
                  ) : collaterals.filter(c => parseFloat(c.amount) > 0).length > 0 ? (
                    collaterals.filter(c => parseFloat(c.amount) > 0).map(c => (
                      <div key={c.symbol} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-3">
                          <TokenIcon symbol={c.symbol} size={28} />
                          <div>
                            <p className="text-sm font-bold text-white">{c.symbol}</p>
                            <p className="text-xs text-[#8E9FB8]">
                              {formatTokenAmount(c.amount, { min: 4, max: 6 })}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-[#8B00FF] font-semibold">LTV {COLLATERAL_TOKENS[c.symbol].ltv}%</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#8E9FB8]">No collateral deposited.</p>
                  )}
                </div>
                <div className="px-6 py-5">
                  <p className="text-xs uppercase tracking-wider text-[#FF00C8] font-bold mb-4">Your Borrowed</p>
                  {!isConnected ? (
                    <p className="text-xs text-[#8E9FB8]">Connect wallet to see borrows.</p>
                  ) : infoLoading ? (
                    <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
                  ) : parseFloat(borrowedUsdc) > 0 ? (
                    <div className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3">
                        <TokenIcon symbol="USDC" size={28} />
                        <div>
                          <p className="text-sm font-bold text-white">USDC</p>
                          <p className="text-xs text-[#8E9FB8]">
                            {formatTokenAmount(borrowedUsdc)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#FF00C8] font-semibold">
                          {protocolStats ? `${protocolStats.borrowApyPct.toFixed(2)}% APY` : "—"}
                        </p>
                        <p className={`text-xs font-bold ${hfColor(healthFactor)}`}>HF: {healthFactor}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#8E9FB8]">No active borrows.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Borrow / Repay panel */}
            <div className="glass-panel rounded-3xl p-6 relative overflow-hidden flex flex-col min-h-[720px]">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#FF00C8]/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center gap-3 mb-5">
                <TokenIcon symbol="USDC" size={44} />
                <div>
                  <p className="font-extrabold text-white text-lg">USDC</p>
                  <p className="text-xs text-[#8E9FB8]">Borrow against collateral</p>
                </div>
              </div>

              {isRisky && (
                <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 text-yellow-400 text-xs mb-4">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Health factor low — add collateral or repay debt.
                </div>
              )}

              <div className="flex bg-white/3 p-1 rounded-xl mb-5 gap-1">
                {(["borrow", "repay"] as const).map(t => (
                  <button key={t} onClick={() => { setSubTab(t); reset(); setAmount(""); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
                      subTab === t ? "bg-white/8 text-white" : "text-[#8E9FB8] hover:text-white"
                    }`}>
                    {t === "borrow" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <TxStatusBanner step={state.step} error={state.error} txHash={state.txHash} stepLabels={STEP_LABELS} accent="pink" />

              <WalletActionGate connectMessage="Connect wallet">
                {!isConnected ? (
                  <WalletConnectPrompt message="Connect wallet" />
                ) : (
                  <>
                    {/* Success banner + reset — shown above form when done */}
                    {state.step === "done" && (
                      <button
                        onClick={() => { reset(); setAmount(""); }}
                        className="w-full bg-white/5 border border-white/10 text-white font-semibold py-2.5 rounded-xl hover:bg-white/10 transition mb-4 text-sm"
                      >
                        {subTab === "borrow" ? "Borrow More" : "Repay More"}
                      </button>
                    )}

                    <div className="mb-4">
                      <label className="block text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">Amount</label>
                      <div className="relative">
                        <input
                          type="number" placeholder="0.00" value={amount}
                          onChange={e => {
                            const val = e.target.value;
                            if (val && parseFloat(val) < 0) return;
                            setAmount(val);
                            reset();
                          }}
                          onBlur={() => {
                            if (!amount || subTab !== "repay") return;
                            const val = parseFloat(amount);
                            const maxBal = parseFloat(borrowedUsdc);
                            if (val > maxBal) setAmount(maxBal.toString());
                          }}
                          disabled={busy || state.step === "done"}
                          className="w-full bg-black/30 border border-white/5 focus:border-[#FF00C8] outline-none rounded-xl py-3 px-4 text-lg font-semibold text-white transition disabled:opacity-50"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FF00C8] font-bold text-sm">USDC</span>
                      </div>
                      <div className="flex justify-between mt-1.5 text-xs text-[#8E9FB8]">
                        {subTab === "borrow" ? (
                          <span>Available to borrow: {formatUsd(maxBorrowUSD)}</span>
                        ) : (
                          <>
                            <span>Borrowed: {formatTokenAmount(borrowedUsdc)} USDC</span>
                            <button className="text-[#FF00C8] hover:underline" onClick={() => setAmount(borrowedUsdc)}>MAX</button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/2 rounded-xl p-4 space-y-2.5 mb-5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#8E9FB8]">Borrow APY</span>
                        <span className="text-[#FF00C8] font-bold">
                          {active.borrowAPY > 0 ? `${active.borrowAPY.toFixed(2)}%` : "—"}
                        </span>
                      </div>
                      {num > 0 && active.borrowAPY > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#8E9FB8]">Est. monthly interest</span>
                          <span className="text-[#FF00C8] font-semibold">${monthly.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#8E9FB8]">Health Factor</span>
                        <span className={`font-bold ${hfColor(healthFactor)}`}>{healthFactor}</span>
                      </div>
                    </div>

                    {subTab === "borrow" && !collaterals.some(c => parseFloat(c.amount) > 0) && (
                      <p className="text-xs text-yellow-400/90 mb-3">
                        Deposit EURC, cirBTC, or USDC collateral below (get tokens from Circle Faucet if needed).
                      </p>
                    )}

                    {noPoolLiquidity && (
                      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-amber-200 text-sm mb-3">
                        <Droplets className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                          No USDC in the lending pool yet — borrows will fail in your wallet.
                          {" "}
                          <a href="/lend" className="text-[#00F5FF] font-semibold hover:underline">
                            Supply USDC on Lend
                          </a>{" "}
                          first (yours or another user&apos;s deposit).
                        </p>
                      </div>
                    )}

                    {borrowExceedsPool && !noPoolLiquidity && (
                      <p className="text-xs text-amber-300/90 mb-3">
                        Max borrowable from pool right now: {fmtLiquidity(protocolStats!.poolUsdcLiquidity)} USDC.
                      </p>
                    )}

                    {state.step !== "done" && (
                      <button
                        onClick={executeBorrowRepay}
                        disabled={
                          busy || !amount || num <= 0
                          || (subTab === "borrow" && !collaterals.some(c => parseFloat(c.amount) > 0))
                          || noPoolLiquidity
                          || borrowExceedsPool
                          || (subTab === "borrow" && !oracleOk)
                        }
                        className="w-full bg-[#FF00C8] text-white font-bold py-3.5 rounded-xl hover:bg-white hover:text-[#0A1428] transition disabled:opacity-40 flex items-center justify-center gap-2 mb-6"
                      >
                        {busy
                          ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
                          : `${subTab === "borrow" ? "Borrow" : "Repay"} USDC`
                        }
                      </button>
                    )}
                    {state.step === "done" && <div className="mb-6" />}
                  </>
                )}
              </WalletActionGate>

              {/* Collateral */}
              <p id="collateral" className="text-xs uppercase tracking-wider text-[#8B00FF] font-bold mb-1">Collateral</p>
              <p className="text-[10px] text-[#8E9FB8] mb-3">Deposit Arc collateral before borrowing USDC.</p>
              <div className="flex bg-white/3 p-1 rounded-xl mb-3 gap-1">
                {(["deposit", "withdraw"] as const).map(t => (
                  <button key={t} onClick={() => { setCollateralTab(t); reset(); setCollAmount(""); }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                      collateralTab === t ? "bg-white/8 text-white" : "text-[#8E9FB8]"
                    }`}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                {COLLATERAL_SYMBOLS.map(s => (
                  <button key={s} onClick={() => setCollSymbol(s)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                      collSymbol === s ? "border-[#8B00FF] bg-[#8B00FF]/10 text-white" : "border-white/10 text-[#8E9FB8]"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
              <input
                type="number" placeholder="0.00" value={collAmount}
                onChange={e => {
                  const val = e.target.value;
                  if (val && parseFloat(val) < 0) return;
                  setCollAmount(val);
                  reset();
                }}
                onBlur={() => {
                  if (!collAmount) return;
                  const val = parseFloat(collAmount);
                  const maxBal = parseFloat(
                    collateralTab === "deposit" ? collWalletBalance : collaterals.find(c => c.symbol === collSymbol)?.amount ?? "0"
                  );
                  if (val > maxBal) setCollAmount(maxBal.toString());
                }}
                disabled={busy || !isConnected}
                className="w-full bg-black/30 border border-white/5 rounded-xl py-2.5 px-3 text-sm text-white outline-none mb-1 disabled:opacity-50"
              />
              <div className="flex justify-between mb-3 text-xs text-[#8E9FB8]">
                {collateralTab === "deposit" ? (
                  <>
                    <span>Wallet: {formatTokenAmount(collWalletBalance, { min: 4, max: 8 })} {collSymbol}</span>
                    <button
                      className="text-[#8B00FF] hover:underline"
                      onClick={() => setCollAmount(collWalletBalance)}
                    >
                      MAX
                    </button>
                  </>
                ) : (
                  <>
                    <span>Deposited: {formatTokenAmount(collaterals.find(c => c.symbol === collSymbol)?.amount ?? "0", { min: 4, max: 8 })} {collSymbol}</span>
                    <button
                      className="text-[#8B00FF] hover:underline"
                      onClick={() => setCollAmount(collaterals.find(c => c.symbol === collSymbol)?.amount ?? "0")}
                    >
                      MAX
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={executeCollateral}
                disabled={busy || !isConnected || !collAmount || parseFloat(collAmount) <= 0}
                className="w-full border border-[#8B00FF]/30 text-[#8B00FF] font-semibold py-2.5 rounded-xl hover:bg-[#8B00FF]/10 transition disabled:opacity-40 text-sm mb-5"
              >
                {collateralTab === "deposit" ? "Deposit" : "Withdraw"} {collSymbol}
              </button>

              <div id="faucet" className="border-t border-white/5 pt-4">
                <p className="text-xs text-[#8E9FB8] flex items-center gap-1 mb-2">
                  <Droplets className="w-3.5 h-3.5" /> Need tokens? Circle Faucet (Arc Testnet)
                </p>
                <a
                  href={CIRCLE_FAUCET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#00F5FF] hover:underline"
                >
                  faucet.circle.com <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>

      </main>
      <Footer />
    </div>
  );
}
