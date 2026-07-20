"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import WalletActionGate, { WalletConnectPrompt } from "../../components/WalletActionGate";
import { formatUsd, formatTokenAmount } from "../../lib/format";
import ProtocolFlowHint from "../../components/ProtocolFlowHint";
import TxStatusBanner from "../../components/TxStatusBanner";
import PageLayout from "../../components/PageLayout";
import Link from "next/link";
import TokenIcon from "../../components/TokenIcon";
import NetworkGuard from "../../components/NetworkGuard";
import {
  useLending, SUPPORTED_TOKENS, TOKEN_SYMBOLS,
  type TokenSymbol, type AssetMarketInfo, type UserPosition,
} from "../../hooks/useLending";

const ERC20_BALANCE_ABI = [{
  type: "function",
  name: "balanceOf",
  stateMutability: "view",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ type: "uint256" }],
}] as const;

// ─── Step labels ──────────────────────────────────────────────────────────────
const STEP_LABELS: Record<string, string> = {
  switching:  "Switching to Arc Testnet...",
  approving:  "Approving token...",
  supplying:  "Supplying — sign in wallet...",
  withdrawing:"Withdrawing — sign in wallet...",
  confirming: "Waiting for confirmation...",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtLiquidity(val: string, symbol: string): string {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return "—";
  if (symbol === "cirBTC") {
    if (n >= 1) return `${n.toFixed(4)} BTC`;
    return `${(n * 1e8).toFixed(0)} sat`;
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function apyColor(apy: number) {
  if (apy > 5) return "text-emerald-400";
  if (apy > 2) return "text-[#A998FF]";
  return "text-[#8991AF]";
}

function StatCard({ label, value, sub, accent = false, loading = false }: {
  label: string; value: string; sub?: string; accent?: boolean; loading?: boolean;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-[#8991AF] mb-2">{label}</p>
      {loading
        ? <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
        : <p suppressHydrationWarning className={`text-2xl font-extrabold ${accent ? "text-[#A998FF]" : "text-white"}`}>{value}</p>
      }
      {sub && !loading && <p className="text-xs text-emerald-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function LendPage() {
  const { isConnected, address } = useAccount();
  const { state, reset, supply, withdraw, getMarketInfo, getUserPosition } = useLending();

  const [markets, setMarkets]       = useState<AssetMarketInfo[]>([]);
  const [position, setPosition]     = useState<UserPosition | null>(null);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [posLoading, setPosLoading] = useState(false);

  const [selectedSymbol, setSelectedSymbol] = useState<TokenSymbol>("USDC");
  const [subTab, setSubTab]   = useState<"supply" | "withdraw">("supply");
  const [amount, setAmount]   = useState("");
  const selectedToken = SUPPORTED_TOKENS[selectedSymbol];

  // Wallet balance must remain independent from pool/oracle position reads.
  const {
    data: walletBalanceRaw,
    isLoading: walletBalanceLoading,
    isError: walletBalanceError,
    refetch: refetchWalletBalance,
  } = useReadContract({
    address: selectedToken.address,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: 5042002,
    query: {
      enabled: isConnected && !!address,
      retry: 4,
      retryDelay: attempt => Math.min(750 * 2 ** attempt, 6_000),
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  });

  // Load markets on mount
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => { if (!cancelled) setMarketsLoading(true); })
      .then(() => getMarketInfo())
      .then(data => { if (!cancelled) { setMarkets(data); setMarketsLoading(false); } })
      .catch(() => { if (!cancelled) setMarketsLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load position when wallet connects/changes
  useEffect(() => {
    let cancelled = false;
    if (!isConnected || !address) {
      Promise.resolve().then(() => { if (!cancelled) setPosition(null); });
      return () => { cancelled = true; };
    }
    Promise.resolve()
      .then(() => { if (!cancelled) setPosLoading(true); })
      .then(() => getUserPosition(address as `0x${string}`))
      .then(pos => { if (!cancelled) { setPosition(pos); setPosLoading(false); } })
      .catch(() => { if (!cancelled) setPosLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  // Reload after tx
  useEffect(() => {
    if (state.step !== "done") return;
    let cancelled = false;
    Promise.resolve()
      .then(() => { if (!cancelled) setMarketsLoading(true); })
      .then(() => getMarketInfo())
      .then(data => { if (!cancelled) { setMarkets(data); setMarketsLoading(false); } })
      .catch(() => { if (!cancelled) setMarketsLoading(false); });
    if (address) {
      Promise.resolve()
        .then(() => { if (!cancelled) setPosLoading(true); })
        .then(() => getUserPosition(address as `0x${string}`))
        .then(pos => { if (!cancelled) { setPosition(pos); setPosLoading(false); } })
        .catch(() => { if (!cancelled) setPosLoading(false); });
    }
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  useEffect(() => {
    if (state.step === "done") void refetchWalletBalance();
  }, [state.step, refetchWalletBalance]);

  const selectedMarket = markets.find(m => m.symbol === selectedSymbol);
  const userAsset      = position?.assets.find(a => a.symbol === selectedSymbol);
  const directWalletBalance = walletBalanceRaw === undefined
    ? undefined
    : formatUnits(walletBalanceRaw, selectedToken.decimals);
  const walletBalance = directWalletBalance ?? userAsset?.walletBalance ?? "0";

  const num     = parseFloat(amount) || 0;
  const monthly = selectedMarket ? (num * (selectedMarket.supplyApyPct / 100)) / 12 : 0;
  const busy    = state.busy;

  // Balance validation
  const walletBal = parseFloat(walletBalance);
  const supplyBal = parseFloat(userAsset?.supplyBalance ?? "0");
  const maxBal = subTab === "supply" ? walletBal : supplyBal;
  const insufficientBalance = num > maxBal;

  // Total supplied across all assets (USD approx)
  const totalSuppliedUSD = position?.totalCollateralUSD
    ? `$${parseFloat(position.totalCollateralUSD).toFixed(2)}`
    : "—";

  async function execute() {
    if (!amount || num <= 0) return;
    reset();
    if (subTab === "supply") {
      await supply(selectedSymbol, amount);
    } else {
      // Withdraw by shares. User enters token amount; convert proportionally.
      // If user entered MAX (amount == supplyBalance), pass all shares directly.
      const supplyBal = parseFloat(userAsset?.supplyBalance ?? "0");
      const totalShares = parseFloat(userAsset?.shares ?? "0");
      if (totalShares <= 0) return;

      let sharesToRedeem: string;
      if (supplyBal > 0 && Math.abs(num - supplyBal) < 0.000001) {
        // MAX — redeem all shares to avoid dust
        sharesToRedeem = userAsset!.shares;
      } else {
        // Proportional: shares = totalShares * (amount / supplyBalance)
        const pct = Math.min(num / supplyBal, 1);
        sharesToRedeem = (totalShares * pct).toFixed(selectedToken.decimals);
      }
      await withdraw(selectedSymbol, sharesToRedeem);
    }
  }

  return (
    <PageLayout variant="app">
      <main className="app-page relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-8">

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="app-eyebrow text-xs uppercase tracking-widest text-[#A998FF] font-bold mb-2 block">
            Arc Testnet · Vitael Protocol
          </span>
          <h1 className="app-page-title text-5xl text-white">Lend</h1>
          <p className="text-[#8991AF] mt-2 text-sm">
            Supply USDC, EURC, or cirBTC to earn yield. Use any asset as collateral to borrow others.
          </p>
        </motion.div>

        <ProtocolFlowHint variant="lend" />

        <NetworkGuard>
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatCard
            label="My Collateral (USD)"
            value={isConnected ? totalSuppliedUSD : "—"}
            sub="All assets combined"
            accent
            loading={posLoading}
          />
          <StatCard
            label="Health Factor"
            value={position?.healthFactor ?? "∞"}
            sub={position?.healthFactor === "∞" ? "No borrows" : ""}
            loading={posLoading}
          />
          <StatCard
            label="USDC Supply APY"
            value={marketsLoading ? "—" : `${markets.find(m => m.symbol === "USDC")?.supplyApyPct.toFixed(2) ?? "0"}%`}
            sub="Live rate"
            loading={marketsLoading}
          />
          <StatCard
            label="cirBTC Supply APY"
            value={marketsLoading ? "—" : `${markets.find(m => m.symbol === "cirBTC")?.supplyApyPct.toFixed(2) ?? "0"}%`}
            sub="Live rate"
            loading={marketsLoading}
          />
        </motion.div>


        {/* Main grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

            {/* ── Market table ── */}
            <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-white/5">
                <h2 className="font-bold text-white">Supply markets</h2>
                <p className="text-xs text-[#8991AF] mt-0.5">
                  All 3 assets can be supplied to earn yield and used as collateral
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-[#8991AF]">
                      <th className="py-3 px-5">Asset</th>
                      <th className="py-3 px-5 text-[#A998FF]">Supply APY</th>
                      <th className="py-3 px-5">Borrow APY</th>
                      <th className="py-3 px-5">Utilization</th>
                      <th className="py-3 px-5">Liquidity</th>
                      <th className="py-3 px-5">LTV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOKEN_SYMBOLS.map((sym) => {
                      const m   = markets.find(x => x.symbol === sym);
                      const tok = SUPPORTED_TOKENS[sym];
                      const isSelected = selectedSymbol === sym;
                      return (
                        <motion.tr
                          key={sym}
                          onClick={() => setSelectedSymbol(sym)}
                          whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                          className={`border-b border-white/5 cursor-pointer transition ${
                            isSelected ? "bg-[#A998FF]/5" : ""
                          }`}
                        >
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <TokenIcon symbol={sym} size={34} />
                              <div>
                                <p className="font-bold text-white text-sm">{sym}</p>
                                <p className="text-xs text-[#8991AF]">{tok.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5 font-bold text-sm">
                            {marketsLoading
                              ? <div className="h-4 w-12 bg-white/5 rounded animate-pulse" />
                              : <span className={apyColor(m?.supplyApyPct ?? 0)}>
                                  {m ? `${m.supplyApyPct.toFixed(2)}%` : "—"}
                                </span>
                            }
                          </td>
                          <td className="py-4 px-5 text-[#7EE2B7] font-semibold text-sm">
                            {marketsLoading
                              ? <div className="h-4 w-12 bg-white/5 rounded animate-pulse" />
                              : m ? `${m.borrowApyPct.toFixed(2)}%` : "—"
                            }
                          </td>
                          <td className="py-4 px-5 text-sm">
                            {marketsLoading
                              ? <div className="h-4 w-12 bg-white/5 rounded animate-pulse" />
                              : (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#A998FF] rounded-full"
                                      style={{ width: `${Math.min(m?.utilizationPct ?? 0, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[#8991AF] text-xs">
                                    {m ? `${m.utilizationPct.toFixed(1)}%` : "—"}
                                  </span>
                                </div>
                              )
                            }
                          </td>
                          <td className="py-4 px-5 text-[#8991AF] text-sm">
                            {marketsLoading
                              ? <div className="h-4 w-16 bg-white/5 rounded animate-pulse" />
                              : fmtLiquidity(m?.liquidity ?? "0", sym)
                            }
                          </td>
                          <td className="py-4 px-5 text-white text-sm font-semibold">
                            {tok.ltv}%
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* My supplied positions */}
              <div className="px-6 py-5 border-t border-white/5">
                <p className="text-xs uppercase tracking-wider text-[#A998FF] font-bold mb-4">
                  Your Supplied Positions
                </p>
                {!isConnected ? (
                  <p className="text-xs text-[#8991AF]">Connect wallet to see your positions.</p>
                ) : posLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : position?.assets.filter(a => parseFloat(a.supplyBalance) > 0).length ? (
                  <div className="space-y-1">
                    {position.assets
                      .filter(a => parseFloat(a.supplyBalance) > 0)
                      .map(a => {
                        const m = markets.find(x => x.symbol === a.symbol);
                        return (
                          <div key={a.symbol} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                            <div className="flex items-center gap-3">
                              <TokenIcon symbol={a.symbol} size={28} />
                              <div>
                                <p className="text-sm font-bold text-white">{a.symbol}</p>
                                <p className="text-xs text-[#8991AF]">
                                  {formatTokenAmount(a.supplyBalance, { min: 2, max: 3 })} {a.symbol}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-semibold ${apyColor(m?.supplyApyPct ?? 0)}`}>
                                {m ? `${m.supplyApyPct.toFixed(2)}% APY` : "—"}
                              </p>
                              <p className="text-xs text-[#8991AF]">
                                Rate: {m?.exchangeRate ?? "—"}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                ) : (
                  <p className="text-xs text-[#8991AF]">No supplied positions yet.</p>
                )}
              </div>

              {/* Collateral hint */}
              <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                <p className="text-xs font-bold text-[#8991AF] uppercase tracking-wider mb-2">
                  Want to borrow? Deposit collateral on the Borrow page
                </p>
                <Link
                  href="/borrow"
                  className="inline-flex items-center px-3 py-2 text-xs font-semibold text-[#7EE2B7] border border-[#7EE2B7]/30 rounded-lg hover:bg-[#7EE2B7]/10 transition"
                >
                  Go to Borrow →
                </Link>
              </div>
            </div>


            {/* ── Action panel ── */}
            <div className="app-action-panel glass-panel rounded-3xl p-6 relative overflow-hidden flex flex-col min-h-[520px]">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#A998FF]/5 rounded-full blur-3xl pointer-events-none" />

              {/* Asset selector */}
              <div className="flex gap-2 mb-5">
                {TOKEN_SYMBOLS.map(sym => (
                  <button
                    key={sym}
                    onClick={() => { setSelectedSymbol(sym); reset(); setAmount(""); }}
                    className={`flex-1 flex flex-col items-center py-2 rounded-xl border text-xs font-bold transition ${
                      selectedSymbol === sym
                        ? "border-[#A998FF] bg-[#A998FF]/10 text-white"
                        : "border-white/10 text-[#8991AF] hover:border-white/30"
                    }`}
                  >
                    <TokenIcon symbol={sym} size={22} />
                    <span className="mt-1">{sym}</span>
                  </button>
                ))}
              </div>

              {/* Sub-tabs */}
              <div className="flex bg-white/3 p-1 rounded-xl mb-5 gap-1">
                {(["supply", "withdraw"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setSubTab(t); reset(); setAmount(""); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
                      subTab === t ? "bg-white/8 text-white" : "text-[#8991AF] hover:text-white"
                    }`}
                  >
                    {t === "supply"
                      ? <TrendingUp className="w-3.5 h-3.5" />
                      : <TrendingDown className="w-3.5 h-3.5" />
                    }
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <TxStatusBanner
                step={state.step}
                error={state.error}
                txHash={state.txHash}
                stepLabels={STEP_LABELS}
              />

              <WalletActionGate connectMessage={`Connect wallet to ${subTab}`}>
                {!isConnected ? (
                  <WalletConnectPrompt message={`Connect wallet to ${subTab}`} />
                ) : (
                  <>
                    {/* Success banner — shown above form when done */}
                    {state.step === "done" && (
                      <button
                        onClick={() => { reset(); setAmount(""); }}
                        className="w-full bg-white/5 border border-white/10 text-white font-semibold py-2.5 rounded-xl hover:bg-white/10 transition mb-4 text-sm"
                      >
                        {subTab === "supply" ? "Supply More" : "Withdraw More"}
                      </button>
                    )}

                    {/* Amount input — always visible */}
                    <div className="mb-4">
                      <label className="block text-xs uppercase tracking-wider text-[#8991AF] mb-2">
                        Amount
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={e => {
                            const val = e.target.value;
                            // Prevent negative numbers
                            if (val && parseFloat(val) < 0) return;
                            setAmount(val);
                            reset();
                          }}
                          onBlur={() => {
                            // Validate against max balance
                            if (!amount) return;
                            const val = parseFloat(amount);
                            const maxBal = parseFloat(
                              subTab === "supply"
                                ? walletBalance
                                : userAsset?.supplyBalance ?? "0"
                            );
                            if (val > maxBal) setAmount(maxBal.toString());
                          }}
                          disabled={busy || state.step === "done"}
                          className="w-full bg-black/30 border border-white/5 focus:border-[#A998FF] outline-none rounded-xl py-3 px-4 text-lg font-semibold text-white transition disabled:opacity-50"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A998FF] font-bold text-sm">
                          {selectedSymbol}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1.5 text-xs text-[#8991AF]">
                        {subTab === "supply" ? (
                          <>
                            <span>
                              Wallet: {walletBalanceLoading
                                ? "Loading…"
                                : walletBalanceError && directWalletBalance === undefined && !userAsset
                                  ? "Unavailable"
                                  : formatTokenAmount(walletBalance, { min: 2, max: 3 })} {selectedSymbol}
                            </span>
                            <button
                              className="text-[#A998FF] hover:underline"
                              onClick={() => setAmount(walletBalance)}
                            >
                              MAX
                            </button>
                          </>
                        ) : (
                          <>
                            <span>Supplied: {formatTokenAmount(userAsset?.supplyBalance ?? "0", { min: 2, max: 3 })} {selectedSymbol}</span>
                            <button
                              className="text-[#A998FF] hover:underline"
                              onClick={() => setAmount(userAsset?.supplyBalance ?? "0")}
                            >
                              MAX
                            </button>
                          </>
                        )}
                      </div>
                      {insufficientBalance && amount && (
                        <p className="text-xs text-red-400 mt-1">
                          Insufficient {selectedSymbol} balance
                        </p>
                      )}
                    </div>

                    {/* Info box — always visible */}
                    <div className="bg-white/2 rounded-xl p-4 space-y-2.5 mb-5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#8991AF]">Supply APY</span>
                        <span className={`font-bold ${apyColor(selectedMarket?.supplyApyPct ?? 0)}`}>
                          {selectedMarket ? `${selectedMarket.supplyApyPct.toFixed(2)}%` : "—"}
                        </span>
                      </div>
                      {num > 0 && selectedMarket && (
                        <div className="flex justify-between">
                          <span className="text-[#8991AF]">Est. monthly yield</span>
                          <span className="text-emerald-400 font-semibold">
                            +{selectedSymbol === "cirBTC"
                              ? `${(monthly * 1e8).toFixed(0)} sat`
                              : formatUsd(monthly)
                            }
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#8991AF]">Exchange rate</span>
                        <span className="text-white">
                          {selectedMarket?.exchangeRate
                            ? `${selectedMarket.exchangeRate} ${selectedSymbol}/share`
                            : "—"
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8991AF]">Max LTV</span>
                        <span className="text-white">{selectedToken.ltv}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8991AF]">Liq. threshold</span>
                        <span className="text-white">{selectedToken.liquidationThreshold}%</span>
                      </div>
                      {selectedMarket && (selectedMarket.supplyApyPct ?? 0) < 0.5 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 -mx-1 mt-1">
                          <p className="text-xs text-yellow-300">
                            APY increases as utilization grows when borrowers use the pool.
                          </p>
                        </div>
                      )}
                    </div>

                    {state.step !== "done" && (
                      <button
                        onClick={execute}
                        disabled={busy || !amount || num <= 0 || insufficientBalance}
                        className="app-button app-button-primary w-full bg-[#A998FF] text-[#0D0E1E] font-bold py-3.5 rounded-xl hover:bg-white transition disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        {busy ? (
                          <>
                            <div className="w-5 h-5 border-2 border-[#0D0E1E]/30 border-t-[#0D0E1E] rounded-full animate-spin" />
                            Processing...
                          </>
                        ) : (
                          `${subTab === "supply" ? "Supply" : "Withdraw"} ${selectedSymbol}`
                        )}
                      </button>
                    )}
                  </>
                )}
              </WalletActionGate>
            </div>

          </div>
        </motion.div>
        </NetworkGuard>

      </main>
    </PageLayout>
  );
}
