"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, ShieldCheck, Info,
  AlertTriangle, ExternalLink, Wallet, Droplets,
} from "lucide-react";
import { useAccount } from "wagmi";
import WalletActionGate, { WalletConnectPrompt } from "../../components/WalletActionGate";
import { formatUsd, formatTokenAmount } from "../../lib/format";
import Header from "../../components/Header";
import WaterfallBackground from "../../components/WaterfallBackground";
import Footer from "../../components/Footer";
import TokenIcon from "../../components/TokenIcon";
import {
  useLending, COLLATERAL_TOKENS,
  type UserLendingInfo, type CollateralSymbol, type ProtocolStats,
} from "../../hooks/useLending";

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
        : <p className={`text-2xl font-extrabold ${valueClass ?? (accent ? "text-[#FF00C8]" : "text-white")}`}>{value}</p>
      }
      {sub && !loading && <p className="text-xs text-emerald-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBanner({ step, error, txHash }: { step: string; error: string | null; txHash: string | null }) {
  if (error) return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span className="break-all">{error}</span>
    </div>
  );
  if (step === "done" && txHash) return (
    <div className="flex items-center justify-between bg-emerald-400/8 border border-emerald-400/20 rounded-xl px-4 py-3 mb-4">
      <span className="text-sm text-emerald-400 font-semibold">Transaction confirmed ✓</span>
      <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank"
        className="flex items-center gap-1 text-xs text-[#00F5FF] hover:underline">
        ArcScan <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
  if (!STEP_LABELS[step]) return null;
  return (
    <div className="flex items-center gap-3 bg-[#FF00C8]/5 border border-[#FF00C8]/15 rounded-xl px-4 py-3 mb-4">
      <div className="w-4 h-4 border-2 border-[#FF00C8]/30 border-t-[#FF00C8] rounded-full animate-spin flex-shrink-0" />
      <p className="text-sm text-[#FF00C8]">{STEP_LABELS[step]}</p>
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
    mintCollateral,
    getUserInfo, getProtocolStats,
  } = useLending();

  const [protocolStats, setProtocolStats] = useState<ProtocolStats | null>(null);
  const usdcAsset: Asset = {
    symbol: "USDC",
    name: "USD Coin",
    supplyAPY: protocolStats?.supplyApyPct ?? 0,
    borrowAPY: protocolStats?.borrowApyPct ?? 0,
    ltv: 0,
    liquidity: protocolStats ? fmtLiquidity(protocolStats.poolUsdcLiquidity) : "—",
  };
  const assets: Asset[] = [
    usdcAsset,
    {
      symbol: "WETH", name: "Wrapped Ether", supplyAPY: 0, borrowAPY: 0,
      ltv: COLLATERAL_TOKENS.WETH.ltv, liquidity: "Collateral",
    },
    {
      symbol: "WBTC", name: "Wrapped Bitcoin", supplyAPY: 0, borrowAPY: 0,
      ltv: COLLATERAL_TOKENS.WBTC.ltv, liquidity: "Collateral",
    },
  ];
  const [selected, setSelected]           = useState<Asset | null>(null);
  const active = selected ?? usdcAsset;
  const [subTab, setSubTab]               = useState<"borrow" | "repay">("borrow");
  const [amount, setAmount]               = useState("");
  const [userInfo, setUserInfo]           = useState<UserLendingInfo | null>(null);
  const [infoLoading, setInfoLoading]     = useState(false);

  // Collateral panel state
  const [collateralTab, setCollateralTab] = useState<"deposit" | "withdraw">("deposit");
  const [collSymbol, setCollSymbol]       = useState<CollateralSymbol>("WETH");
  const [collAmount, setCollAmount]       = useState("");

  // Mint faucet state
  const [mintSymbol, setMintSymbol]       = useState<CollateralSymbol>("WETH");
  const [mintAmount, setMintAmount]       = useState("1");

  const num  = parseFloat(amount) || 0;
  const busy = state.busy;

  const borrowedUsdc = userInfo?.borrowedUsdc ?? "0";
  const healthFactor = userInfo?.healthFactor ?? "∞";
  const collaterals  = userInfo?.collaterals  ?? [];

  const monthly = (num * (active.borrowAPY / 100)) / 12;

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

  async function executeBorrowRepay() {
    if (!amount || num <= 0) return;
    reset();
    if (subTab === "borrow") {
      await borrow(amount);
    } else {
      await repay(amount);
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

  async function executeMint() {
    if (!mintAmount || parseFloat(mintAmount) <= 0) return;
    reset();
    await mintCollateral(mintSymbol, mintAmount);
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
          <p className="text-[#8E9FB8] mt-2 text-sm">Borrow against your collateral. Monitor your health factor.</p>
        </motion.div>

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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Asset table + positions */}
            <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden">
              <div className="px-6 py-5 border-b border-white/5">
                <h2 className="font-bold text-white">Borrow Markets</h2>
                <p className="text-xs text-[#8E9FB8] mt-0.5">Select an asset to borrow against your collateral</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-[#8E9FB8]">
                      <th className="py-3 px-5">Asset</th>
                      <th className="py-3 px-5 text-[#FF00C8]">Borrow APY</th>
                      <th className="py-3 px-5">Max LTV</th>
                      <th className="py-3 px-5">Liquidity</th>
                      <th className="py-3 px-5" />
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map(a => (
                      <motion.tr key={a.symbol} onClick={() => a.symbol === "USDC" && setSelected(a)}
                        whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                        className={`border-b border-white/5 transition-all ${a.symbol === "USDC" ? "cursor-pointer" : "opacity-70"} ${active.symbol === a.symbol ? "bg-[#FF00C8]/5" : ""}`}>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <TokenIcon symbol={a.symbol} size={34} />
                            <div>
                              <p className="font-bold text-white text-sm">{a.symbol}</p>
                              <p className="text-xs text-[#8E9FB8]">{a.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-[#FF00C8] font-bold text-sm">
                          {a.symbol === "USDC" && a.borrowAPY > 0 ? `${a.borrowAPY.toFixed(2)}%` : a.symbol === "USDC" ? "—" : "N/A"}
                        </td>
                        <td className="py-4 px-5 text-white text-sm">{a.ltv > 0 ? `${a.ltv}%` : "—"}</td>
                        <td className="py-4 px-5 text-[#8E9FB8] text-sm">{a.liquidity}</td>
                        <td className="py-4 px-5 text-right">
                          {a.symbol === "USDC" ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                              active.symbol === a.symbol
                                ? "bg-[#FF00C8] text-white border-[#FF00C8]"
                                : "bg-[#FF00C8]/10 text-[#FF00C8] border-[#FF00C8]/20 hover:bg-[#FF00C8]/20"
                            }`}>
                              {active.symbol === a.symbol ? "Selected" : "Select"}
                            </span>
                          ) : (
                            <span className="text-xs text-[#8E9FB8]">Collateral</span>
                          )}
                        </td>
                      </motion.tr>
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
            <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
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

              <StatusBanner step={state.step} error={state.error} txHash={state.txHash} />

              <WalletActionGate connectMessage="Connect wallet">
                {!isConnected ? (
                  <WalletConnectPrompt message="Connect wallet" />
                ) : state.step === "done" ? (
                <button onClick={() => { reset(); setAmount(""); }}
                  className="w-full bg-white/5 border border-white/10 text-white font-semibold py-3.5 rounded-xl hover:bg-white/10 transition mb-6">
                  {subTab === "borrow" ? "Borrow More" : "Repay More"}
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
                        className="w-full bg-black/30 border border-white/5 focus:border-[#FF00C8] outline-none rounded-xl py-3 px-4 text-lg font-semibold text-white transition disabled:opacity-50"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FF00C8] font-bold text-sm">USDC</span>
                    </div>
                    {subTab === "repay" && parseFloat(borrowedUsdc) > 0 && (
                      <div className="flex justify-end mt-1.5">
                        <button className="text-xs text-[#FF00C8] hover:underline" onClick={() => setAmount(borrowedUsdc)}>MAX</button>
                      </div>
                    )}
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

                  <button
                    onClick={executeBorrowRepay}
                    disabled={busy || !amount || num <= 0}
                    className="w-full bg-[#FF00C8] text-white font-bold py-3.5 rounded-xl hover:bg-white hover:text-[#0A1428] transition disabled:opacity-40 flex items-center justify-center gap-2 mb-6"
                  >
                    {busy
                      ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
                      : `${subTab === "borrow" ? "Borrow" : "Repay"} USDC`
                    }
                  </button>
                </>
                )}
              </WalletActionGate>

              {/* Collateral */}
              <p className="text-xs uppercase tracking-wider text-[#8B00FF] font-bold mb-3">Collateral</p>
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
                {(["WETH", "WBTC"] as CollateralSymbol[]).map(s => (
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
                onChange={e => { setCollAmount(e.target.value); reset(); }}
                disabled={busy || !isConnected}
                className="w-full bg-black/30 border border-white/5 rounded-xl py-2.5 px-3 text-sm text-white outline-none mb-3 disabled:opacity-50"
              />
              <button
                onClick={executeCollateral}
                disabled={busy || !isConnected || !collAmount || parseFloat(collAmount) <= 0}
                className="w-full border border-[#8B00FF]/30 text-[#8B00FF] font-semibold py-2.5 rounded-xl hover:bg-[#8B00FF]/10 transition disabled:opacity-40 text-sm mb-5"
              >
                {collateralTab === "deposit" ? "Deposit" : "Withdraw"} {collSymbol}
              </button>

              {/* Testnet faucet */}
              <div className="border-t border-white/5 pt-4">
                <p className="text-xs text-[#8E9FB8] flex items-center gap-1 mb-2">
                  <Droplets className="w-3.5 h-3.5" /> Testnet faucet (mint mock tokens)
                </p>
                <div className="flex gap-2 mb-2">
                  {(["WETH", "WBTC"] as CollateralSymbol[]).map(s => (
                    <button key={s} onClick={() => setMintSymbol(s)}
                      className={`px-3 py-1 text-xs rounded-lg border ${mintSymbol === s ? "border-[#00F5FF] text-[#00F5FF]" : "border-white/10 text-[#8E9FB8]"}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number" value={mintAmount}
                    onChange={e => { setMintAmount(e.target.value); reset(); }}
                    disabled={busy || !isConnected}
                    className="flex-1 bg-black/30 border border-white/5 rounded-lg py-2 px-3 text-sm text-white outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={executeMint}
                    disabled={busy || !isConnected}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold hover:bg-white/10 transition disabled:opacity-40"
                  >
                    Mint
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

      </main>
      <Footer />
    </div>
  );
}
