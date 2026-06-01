"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, AlertTriangle, ExternalLink, Wallet,
} from "lucide-react";
import { useAccount } from "wagmi";
import WalletActionGate, { WalletConnectPrompt } from "../../components/WalletActionGate";
import { formatUsd, formatTokenAmount } from "../../lib/format";
import ProtocolFlowHint from "../../components/ProtocolFlowHint";
import TxStatusBanner from "../../components/TxStatusBanner";
import Header from "../../components/Header";
import Link from "next/link";
import WaterfallBackground from "../../components/WaterfallBackground";
import Footer from "../../components/Footer";
import TokenIcon from "../../components/TokenIcon";
import {
  useLending, COLLATERAL_TOKENS,
  type UserLendingInfo, type ProtocolStats,
} from "../../hooks/useLending";

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Asset {
  symbol: string; name: string;
  supplyAPY: number; borrowAPY: number;
  ltv: number; liquidity: string;
  supplyOnly?: boolean;
}

const COLLATERAL_REF = [
  { symbol: "EURC", name: "Euro Coin", ltv: COLLATERAL_TOKENS.EURC.ltv },
  { symbol: "cirBTC", name: "Circle BTC", ltv: COLLATERAL_TOKENS.cirBTC.ltv },
] as const;

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
  supplying:  "Supplying — sign in wallet...",
  withdrawing:"Withdrawing — sign in wallet...",
  confirming: "Waiting for confirmation...",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false, loading = false }: {
  label: string; value: string; sub?: string; accent?: boolean; loading?: boolean;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">{label}</p>
      {loading
        ? <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
        : <p suppressHydrationWarning className={`text-2xl font-extrabold ${accent ? "text-[#00F5FF]" : "text-white"}`}>{value}</p>
      }
      {sub && !loading && <p className="text-xs text-emerald-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function LendPage() {
  const { isConnected, address } = useAccount();
  const { state, reset, supply, withdraw, getUserInfo, getProtocolStats } = useLending();

  const [protocolStats, setProtocolStats] = useState<ProtocolStats | null>(null);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [subTab, setSubTab]     = useState<"supply" | "withdraw">("supply");
  const [amount, setAmount]     = useState("");
  const [userInfo, setUserInfo] = useState<UserLendingInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  const usdcAsset: Asset = {
    symbol: "USDC",
    name: "USD Coin",
    supplyAPY: protocolStats?.supplyApyPct ?? 0,
    borrowAPY: protocolStats?.borrowApyPct ?? 0,
    ltv: 0,
    liquidity: protocolStats ? fmtLiquidity(protocolStats.poolUsdcLiquidity) : "—",
    supplyOnly: true,
  };
  const active = selected ?? usdcAsset;

  const num     = parseFloat(amount) || 0;
  const monthly = (num * (active.supplyAPY / 100)) / 12;
  const busy    = state.busy;

  const loadProtocolStats = useCallback(async () => {
    const stats = await getProtocolStats();
    if (stats) setProtocolStats(stats);
  }, [getProtocolStats]);

  const loadUserInfo = useCallback(async () => {
    if (!address) return;
    setInfoLoading(true);
    try {
      const info = await getUserInfo(address);
      setUserInfo(info);
    } finally {
      setInfoLoading(false);
    }
  }, [address, getUserInfo]);

  // Load on mount and when address changes
  useEffect(() => { loadProtocolStats(); }, [loadProtocolStats]);

  useEffect(() => {
    if (isConnected && address) {
      loadUserInfo();
    } else {
      setUserInfo(null);
    }
  }, [isConnected, address, loadUserInfo]);

  useEffect(() => {
    if (state.step === "done") {
      loadUserInfo();
      loadProtocolStats();
    }
  }, [state.step, loadUserInfo, loadProtocolStats]);

  async function execute() {
    if (active.symbol !== "USDC") return;
    if (!amount || num <= 0) return;
    reset();
    if (subTab === "supply") {
      await supply(amount);
    } else {
      // withdraw takes vUSDC amount — user enters USDC amount, convert via exchange rate
      const rate = userInfo ? parseFloat(userInfo.exchangeRate) : 1;
      const vAmount = rate > 0 ? (num / rate).toFixed(6) : amount;
      await withdraw(vAmount);
    }
  }

  const suppliedUsdc  = userInfo?.suppliedUsdc  ?? "0.00";
  const vUsdcBalance  = userInfo?.vUsdcBalance  ?? "0.00";
  const exchangeRate  = userInfo?.exchangeRate  ?? "—";
  const usdcBalance   = userInfo?.usdcBalance   ?? "0.00";

  const fmtUsdc = (v: string) => formatUsd(parseFloat(v));

  return (
    <div className="relative min-h-screen text-white font-sans">
      <WaterfallBackground />
      <Header />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-8">

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-2 block">Arc Testnet · Vitael Protocol</span>
          <h1 className="text-4xl font-extrabold text-white">Lend</h1>
          <p className="text-[#8E9FB8] mt-2 text-sm">Supply USDC to earn yield. Borrow USDC using EURC or cirBTC collateral on Borrow.</p>
        </motion.div>

        <ProtocolFlowHint variant="lend" />

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Supplied"
            value={fmtUsdc(suppliedUsdc)}
            sub={protocolStats ? `${protocolStats.supplyApyPct.toFixed(2)}% APY` : "Live APY"}
            accent
            loading={infoLoading}
          />
          <StatCard
            label="vUSDC Balance"
            value={formatTokenAmount(vUsdcBalance)}
            sub="Interest-bearing"
            accent
            loading={infoLoading}
          />
          <StatCard
            label="Exchange Rate"
            value={exchangeRate === "—" ? "—" : `1 vUSDC = ${exchangeRate} USDC`}
            sub="Increases over time"
            loading={infoLoading}
          />
          <StatCard
            label="Wallet USDC"
            value={fmtUsdc(usdcBalance)}
            sub="Available to supply"
            loading={infoLoading}
          />
        </motion.div>

        {/* Main content */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Asset table */}
            <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden">
              <div className="px-6 py-5 border-b border-white/5">
                <h2 className="font-bold text-white">Supply market</h2>
                <p className="text-xs text-[#8E9FB8] mt-0.5">USDC only — deposit into the pool to receive vUSDC and earn APY</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-[#8E9FB8]">
                      <th className="py-3 px-5">Asset</th>
                      <th className="py-3 px-5 text-[#00F5FF]">Supply APY</th>
                      <th className="py-3 px-5">Pool liquidity</th>
                      <th className="py-3 px-5" />
                    </tr>
                  </thead>
                  <tbody>
                    <motion.tr
                      onClick={() => setSelected(usdcAsset)}
                      whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                      className={`border-b border-white/5 cursor-pointer ${active.symbol === "USDC" ? "bg-[#00F5FF]/5" : ""}`}
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <TokenIcon symbol="USDC" size={34} />
                          <div>
                            <p className="font-bold text-white text-sm">USDC</p>
                            <p className="text-xs text-[#8E9FB8]">USD Coin · earn yield</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[#00F5FF] font-bold text-sm">
                        {usdcAsset.supplyAPY > 0 ? `${usdcAsset.supplyAPY.toFixed(2)}%` : "—"}
                      </td>
                      <td className="py-4 px-5 text-[#8E9FB8] text-sm" title="USDC in the pool available for borrowers">
                        {usdcAsset.liquidity}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-[#00F5FF] text-[#0A1428] border-[#00F5FF]">
                          Active
                        </span>
                      </td>
                    </motion.tr>
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                <p className="text-xs font-bold text-[#8E9FB8] uppercase tracking-wider mb-3">
                  Collateral (not supplied here — used when borrowing)
                </p>
                <div className="flex flex-wrap gap-2">
                  {COLLATERAL_REF.map((c) => (
                    <Link
                      key={c.symbol}
                      href="/borrow#collateral"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-black/20 hover:border-[#FF00C8]/40 transition text-xs"
                    >
                      <TokenIcon symbol={c.symbol} size={22} />
                      <span className="text-white font-semibold">{c.symbol}</span>
                      <span className="text-[#8E9FB8]">LTV {c.ltv}%</span>
                    </Link>
                  ))}
                  <Link
                    href="/borrow"
                    className="inline-flex items-center px-3 py-2 text-xs font-semibold text-[#FF00C8] hover:underline"
                  >
                    Go to Borrow →
                  </Link>
                </div>
              </div>

              {/* My supplied positions */}
              <div className="px-6 py-5 border-t border-white/5">
                <p className="text-xs uppercase tracking-wider text-[#00F5FF] font-bold mb-4">Your Supplied Positions</p>
                {!isConnected ? (
                  <p className="text-xs text-[#8E9FB8]">Connect wallet to see your positions.</p>
                ) : infoLoading ? (
                  <div className="space-y-2">
                    <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
                  </div>
                ) : parseFloat(suppliedUsdc) > 0 ? (
                  <div className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol="USDC" size={28} />
                      <div>
                        <p className="text-sm font-bold text-white">USDC</p>
                        <p className="text-xs text-[#8E9FB8]">
                          {formatTokenAmount(suppliedUsdc)} USDC
                          · {formatTokenAmount(vUsdcBalance, { min: 2, max: 6 })} vUSDC
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#00F5FF] font-semibold">
                        {protocolStats ? `${protocolStats.supplyApyPct.toFixed(2)}% APY` : "—"}
                      </p>
                      <p className="text-xs text-[#8E9FB8]">Rate: {exchangeRate}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#8E9FB8]">No supplied positions yet.</p>
                )}
              </div>
            </div>

            {/* Action panel */}
            <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#00F5FF]/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center gap-3 mb-5">
                <TokenIcon symbol={active.symbol} size={44} />
                <div>
                  <p className="font-extrabold text-white text-lg">{active.symbol}</p>
                  <p className="text-xs text-[#8E9FB8]">{active.name}</p>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex bg-white/3 p-1 rounded-xl mb-5 gap-1">
                {(["supply", "withdraw"] as const).map(t => (
                  <button key={t} onClick={() => { setSubTab(t); reset(); setAmount(""); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
                      subTab === t ? "bg-white/8 text-white" : "text-[#8E9FB8] hover:text-white"
                    }`}>
                    {t === "supply" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <TxStatusBanner step={state.step} error={state.error} txHash={state.txHash} stepLabels={STEP_LABELS} />

              {active.symbol !== "USDC" ? (
                <p className="text-sm text-[#8E9FB8] py-4 text-center">
                  Only USDC can be supplied. Deposit EURC/cirBTC as collateral on the{" "}
                  <a href="/borrow" className="text-[#00F5FF] hover:underline">Borrow</a> page.
                </p>
              ) : (
                <WalletActionGate connectMessage="Connect wallet to supply">
                  {!isConnected ? (
                    <WalletConnectPrompt message="Connect wallet to supply" />
                  ) : state.step === "done" ? (
                <button onClick={() => { reset(); setAmount(""); }}
                  className="w-full bg-white/5 border border-white/10 text-white font-semibold py-3.5 rounded-xl hover:bg-white/10 transition">
                  {subTab === "supply" ? "Supply More" : "Withdraw More"}
                </button>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">Amount</label>
                    <div className="relative">
                      <input
                        type="number" placeholder="0.00" value={amount}
                        onChange={e => { setAmount(e.target.value); reset(); }}
                        disabled={busy}
                        className="w-full bg-black/30 border border-white/5 focus:border-[#00F5FF] outline-none rounded-xl py-3 px-4 text-lg font-semibold text-white transition disabled:opacity-50"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00F5FF] font-bold text-sm">
                        {subTab === "supply" ? "USDC" : "USDC"}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-[#8E9FB8]">
                      {subTab === "supply" ? (
                        <>
                          <span>Wallet: {formatTokenAmount(usdcBalance)} USDC</span>
                          <button className="text-[#00F5FF] hover:underline" onClick={() => setAmount(usdcBalance)}>MAX</button>
                        </>
                      ) : (
                        <>
                          <span>Supplied: {formatTokenAmount(suppliedUsdc)} USDC</span>
                          <button className="text-[#00F5FF] hover:underline" onClick={() => setAmount(suppliedUsdc)}>MAX</button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/2 rounded-xl p-4 space-y-2.5 mb-5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#8E9FB8]">Supply APY</span>
                      <span className="text-[#00F5FF] font-bold">
                        {active.supplyAPY > 0 ? `${active.supplyAPY.toFixed(2)}%` : "—"}
                      </span>
                    </div>
                    {num > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#8E9FB8]">Est. monthly yield</span>
                        <span className="text-emerald-400 font-semibold">+${monthly.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#8E9FB8]">Exchange rate</span>
                      <span className="text-white">{exchangeRate === "—" ? "—" : `${exchangeRate} USDC/vUSDC`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8E9FB8]">Receive</span>
                      <span className="text-white">vUSDC (interest-bearing)</span>
                    </div>
                  </div>

                  <button
                    onClick={execute}
                    disabled={busy || !amount || num <= 0}
                    className="w-full bg-[#00F5FF] text-[#0A1428] font-bold py-3.5 rounded-xl hover:bg-white transition disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {busy
                      ? <><div className="w-5 h-5 border-2 border-[#0A1428]/30 border-t-[#0A1428] rounded-full animate-spin" />Processing...</>
                      : `${subTab === "supply" ? "Supply" : "Withdraw"} ${active.symbol}`
                    }
                  </button>
                </>
                  )}
                </WalletActionGate>
              )}
            </div>
          </div>
        </motion.div>

      </main>
      <Footer />
    </div>
  );
}
