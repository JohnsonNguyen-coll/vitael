"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, ShieldCheck, Info,
  ChevronDown, AlertTriangle, Wallet,
} from "lucide-react";
import Header from "../../components/Header";
import WaterfallBackground from "../../components/WaterfallBackground";
import Footer from "../../components/Footer";
import TokenIcon from "../../components/TokenIcon";

type PageTab = "lend" | "borrow";

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Asset {
  symbol: string; name: string;
  supplyAPY: number; borrowAPY: number;
  ltv: number; liquidity: string;
}

const ASSETS: Asset[] = [
  { symbol: "USDC",  name: "USD Coin",        supplyAPY: 12.42, borrowAPY: 14.15, ltv: 0,  liquidity: "$14.2M" },
  { symbol: "WETH",  name: "Wrapped Ether",   supplyAPY: 4.20,  borrowAPY: 6.12,  ltv: 80, liquidity: "$18.4M" },
  { symbol: "WBTC",  name: "Wrapped Bitcoin", supplyAPY: 3.10,  borrowAPY: 5.30,  ltv: 70, liquidity: "$9.9M"  },
];

const SUPPLIED  = [{ symbol: "USDC", amount: "5,000.00", value: "$5,000.00", apy: "12.42%", earned: "+$51.75" }];
const BORROWED  = [{ symbol: "USDC", amount: "2,400.00", value: "$2,400.00", apy: "14.15%", interest: "-$28.30" }];
const COLLATERAL= [{ symbol: "WETH", amount: "1.5",      value: "$4,500.00", ltv: "80%" }];

// ─── Shared helpers ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">{label}</p>
      <p className={`text-2xl font-extrabold ${accent ? "text-[#00F5FF]" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-emerald-400 mt-1">{sub}</p>}
    </div>
  );
}

function SuccessOverlay({ tab, amount, symbol, onDismiss }: { tab: string; amount: number; symbol: string; onDismiss: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 bg-[#0A1428]/95 flex flex-col items-center justify-center rounded-3xl">
      <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 14 }}
        className="w-16 h-16 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/30 flex items-center justify-center text-[#00F5FF] mb-4">
        <ShieldCheck className="w-8 h-8" />
      </motion.div>
      <p className="text-white font-bold text-lg mb-1">Transaction Sent</p>
      <p className="text-[#8E9FB8] text-sm mb-4">{tab} {amount.toLocaleString()} {symbol}</p>
      <button onClick={onDismiss} className="px-5 py-2 rounded-full border border-[#00F5FF]/20 text-[#00F5FF] text-sm hover:bg-[#00F5FF]/10 transition">
        Dismiss
      </button>
    </motion.div>
  );
}

// ─── LEND TAB ─────────────────────────────────────────────────────────────────
function LendTab() {
  const [selected, setSelected] = useState<Asset>(ASSETS[0]);
  const [subTab, setSubTab]     = useState<"supply" | "withdraw">("supply");
  const [amount, setAmount]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  const num     = parseFloat(amount) || 0;
  const monthly = (num * (selected.supplyAPY / 100)) / 12;

  function execute() {
    if (!amount || num <= 0) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSuccess(true); }, 1800);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Asset table */}
      <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5">
          <h2 className="font-bold text-white">Supply Markets</h2>
          <p className="text-xs text-[#8E9FB8] mt-0.5">Select an asset to supply and earn yield</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-[#8E9FB8]">
                <th className="py-3 px-5">Asset</th>
                <th className="py-3 px-5 text-[#00F5FF]">Supply APY</th>
                <th className="py-3 px-5">Liquidity</th>
                <th className="py-3 px-5" />
              </tr>
            </thead>
            <tbody>
              {ASSETS.map(a => (
                <motion.tr key={a.symbol} onClick={() => setSelected(a)} whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                  className={`border-b border-white/5 cursor-pointer transition-all ${selected.symbol === a.symbol ? "bg-[#00F5FF]/5" : ""}`}>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol={a.symbol} size={34} />
                      <div><p className="font-bold text-white text-sm">{a.symbol}</p><p className="text-xs text-[#8E9FB8]">{a.name}</p></div>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-[#00F5FF] font-bold text-sm">{a.supplyAPY.toFixed(2)}%</td>
                  <td className="py-4 px-5 text-[#8E9FB8] text-sm">{a.liquidity}</td>
                  <td className="py-4 px-5 text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${selected.symbol === a.symbol ? "bg-[#00F5FF] text-[#0A1428] border-[#00F5FF]" : "bg-[#00F5FF]/10 text-[#00F5FF] border-[#00F5FF]/20 hover:bg-[#00F5FF]/20"}`}>
                      {selected.symbol === a.symbol ? "Selected" : "Select"}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* My supplied positions */}
        <div className="px-6 py-5 border-t border-white/5">
          <p className="text-xs uppercase tracking-wider text-[#00F5FF] font-bold mb-4">Your Supplied Positions</p>
          {SUPPLIED.map((p, i) => (
            <div key={i} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <TokenIcon symbol={p.symbol} size={28} />
                <div><p className="text-sm font-bold text-white">{p.symbol}</p><p className="text-xs text-[#8E9FB8]">{p.amount} · {p.value}</p></div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#00F5FF] font-semibold">{p.apy} APY</p>
                <p className="text-xs text-emerald-400">{p.earned}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action panel */}
      <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#00F5FF]/5 rounded-full blur-3xl pointer-events-none" />
        <AnimatePresence>
          {success && <SuccessOverlay tab={subTab === "supply" ? "Supplied" : "Withdrew"} amount={num} symbol={selected.symbol} onDismiss={() => { setSuccess(false); setAmount(""); }} />}
        </AnimatePresence>

        <div className="flex items-center gap-3 mb-5">
          <TokenIcon symbol={selected.symbol} size={44} />
          <div><p className="font-extrabold text-white text-lg">{selected.symbol}</p><p className="text-xs text-[#8E9FB8]">{selected.name}</p></div>
        </div>

        {/* Sub-tabs */}
        <div className="flex bg-white/3 p-1 rounded-xl mb-5 gap-1">
          {(["supply", "withdraw"] as const).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${subTab === t ? "bg-white/8 text-white" : "text-[#8E9FB8] hover:text-white"}`}>
              {t === "supply" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">Amount</label>
          <div className="relative">
            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full bg-black/30 border border-white/5 focus:border-[#00F5FF] outline-none rounded-xl py-3 px-4 text-lg font-semibold text-white transition" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00F5FF] font-bold text-sm">{selected.symbol}</span>
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-[#8E9FB8]">
            <span>Balance: —</span>
            <button className="text-[#00F5FF] hover:underline" onClick={() => setAmount("1000")}>MAX</button>
          </div>
        </div>

        <div className="bg-white/2 rounded-xl p-4 space-y-2.5 mb-5 text-sm">
          <div className="flex justify-between">
            <span className="text-[#8E9FB8]">Supply APY</span>
            <span className="text-[#00F5FF] font-bold">{selected.supplyAPY.toFixed(2)}%</span>
          </div>
          {num > 0 && (
            <div className="flex justify-between">
              <span className="text-[#8E9FB8]">Est. monthly yield</span>
              <span className="text-emerald-400 font-semibold">+${monthly.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[#8E9FB8]">Receive</span>
            <span className="text-white">v{selected.symbol} (interest-bearing)</span>
          </div>
        </div>

        <button onClick={execute} disabled={loading || !amount || num <= 0}
          className="w-full bg-[#00F5FF] text-[#0A1428] font-bold py-3.5 rounded-xl hover:bg-white transition disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? <><div className="w-5 h-5 border-2 border-[#0A1428]/30 border-t-[#0A1428] rounded-full animate-spin" />Processing...</>
            : `${subTab === "supply" ? "Supply" : "Withdraw"} ${selected.symbol}`}
        </button>
      </div>
    </div>
  );
}

// ─── BORROW TAB ───────────────────────────────────────────────────────────────
function BorrowTab() {
  const [selected, setSelected] = useState<Asset>(ASSETS[0]);
  const [subTab, setSubTab]     = useState<"borrow" | "repay">("borrow");
  const [amount, setAmount]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  const num        = parseFloat(amount) || 0;
  const monthly    = (num * (selected.borrowAPY / 100)) / 12;
  const totalDebt  = 2400 + (subTab === "borrow" ? num : 0);
  const collateralValue = 4500 * 0.85;
  const hfRaw      = totalDebt > 0 ? collateralValue / totalDebt : Infinity;
  const hf         = isFinite(hfRaw) ? hfRaw.toFixed(2) : "∞";
  const hfColor    = hf === "∞" ? "text-emerald-400" : parseFloat(hf) > 1.5 ? "text-emerald-400" : parseFloat(hf) > 1.1 ? "text-yellow-400" : "text-red-400";
  const isRisky    = hf !== "∞" && parseFloat(hf) < 1.2;

  function execute() {
    if (!amount || num <= 0) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSuccess(true); }, 1800);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Asset table */}
      <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5">
          <h2 className="font-bold text-white">Borrow Markets</h2>
          <p className="text-xs text-[#8E9FB8] mt-0.5">Borrow against your collateral. Monitor your health factor.</p>
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
              {ASSETS.map(a => (
                <motion.tr key={a.symbol} onClick={() => setSelected(a)} whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                  className={`border-b border-white/5 cursor-pointer transition-all ${selected.symbol === a.symbol ? "bg-[#FF00C8]/5" : ""}`}>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol={a.symbol} size={34} />
                      <div><p className="font-bold text-white text-sm">{a.symbol}</p><p className="text-xs text-[#8E9FB8]">{a.name}</p></div>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-[#FF00C8] font-bold text-sm">{a.borrowAPY.toFixed(2)}%</td>
                  <td className="py-4 px-5 text-white text-sm">{a.ltv > 0 ? `${a.ltv}%` : "—"}</td>
                  <td className="py-4 px-5 text-[#8E9FB8] text-sm">{a.liquidity}</td>
                  <td className="py-4 px-5 text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${selected.symbol === a.symbol ? "bg-[#FF00C8] text-white border-[#FF00C8]" : "bg-[#FF00C8]/10 text-[#FF00C8] border-[#FF00C8]/20 hover:bg-[#FF00C8]/20"}`}>
                      {selected.symbol === a.symbol ? "Selected" : "Select"}
                    </span>
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
            {COLLATERAL.map((p, i) => (
              <div key={i} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <TokenIcon symbol={p.symbol} size={28} />
                  <div><p className="text-sm font-bold text-white">{p.symbol}</p><p className="text-xs text-[#8E9FB8]">{p.amount} · {p.value}</p></div>
                </div>
                <p className="text-xs text-[#8B00FF] font-semibold">LTV {p.ltv}</p>
              </div>
            ))}
          </div>
          <div className="px-6 py-5">
            <p className="text-xs uppercase tracking-wider text-[#FF00C8] font-bold mb-4">Your Borrowed</p>
            {BORROWED.map((p, i) => (
              <div key={i} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <TokenIcon symbol={p.symbol} size={28} />
                  <div><p className="text-sm font-bold text-white">{p.symbol}</p><p className="text-xs text-[#8E9FB8]">{p.amount} · {p.value}</p></div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#FF00C8] font-semibold">{p.apy}</p>
                  <p className="text-xs text-red-400">{p.interest}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action panel */}
      <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#FF00C8]/5 rounded-full blur-3xl pointer-events-none" />
        <AnimatePresence>
          {success && <SuccessOverlay tab={subTab === "borrow" ? "Borrowed" : "Repaid"} amount={num} symbol={selected.symbol} onDismiss={() => { setSuccess(false); setAmount(""); }} />}
        </AnimatePresence>

        <div className="flex items-center gap-3 mb-5">
          <TokenIcon symbol={selected.symbol} size={44} />
          <div><p className="font-extrabold text-white text-lg">{selected.symbol}</p><p className="text-xs text-[#8E9FB8]">{selected.name}</p></div>
        </div>

        {/* Sub-tabs */}
        <div className="flex bg-white/3 p-1 rounded-xl mb-5 gap-1">
          {(["borrow", "repay"] as const).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${subTab === t ? "bg-white/8 text-white" : "text-[#8E9FB8] hover:text-white"}`}>
              {t === "borrow" ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">Amount</label>
          <div className="relative">
            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full bg-black/30 border border-white/5 focus:border-[#FF00C8] outline-none rounded-xl py-3 px-4 text-lg font-semibold text-white transition" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FF00C8] font-bold text-sm">{selected.symbol}</span>
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-[#8E9FB8]">
            <span>Balance: —</span>
            <button className="text-[#FF00C8] hover:underline" onClick={() => setAmount("500")}>MAX</button>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white/2 rounded-xl p-4 space-y-2.5 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[#8E9FB8]">Borrow APY</span>
            <span className="text-[#FF00C8] font-bold">{selected.borrowAPY.toFixed(2)}%</span>
          </div>
          {num > 0 && (
            <div className="flex justify-between">
              <span className="text-[#8E9FB8]">Est. monthly cost</span>
              <span className="text-red-400 font-semibold">-${monthly.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 border-t border-white/5">
            <span className="text-[#8E9FB8] flex items-center gap-1">Health Factor <Info className="w-3 h-3" /></span>
            <span className={`font-bold flex items-center gap-1 ${hfColor}`}>
              <ShieldCheck className="w-3.5 h-3.5" />{hf}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8E9FB8]">Liquidation at</span>
            <span className="text-white">HF &lt; 1.0</span>
          </div>
        </div>

        {/* Risk warning */}
        <AnimatePresence>
          {isRisky && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4">
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Health factor is dangerously low. You risk liquidation.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={execute} disabled={loading || !amount || num <= 0}
          className={`w-full font-bold py-3.5 rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2 ${
            subTab === "borrow"
              ? "bg-[#FF00C8] text-white hover:bg-pink-400"
              : "bg-[#00F5FF] text-[#0A1428] hover:bg-white"
          }`}>
          {loading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
            : `${subTab === "borrow" ? "Borrow" : "Repay"} ${selected.symbol}`}
        </button>

        <p className="text-center text-xs text-[#8E9FB8] mt-3">
          Collateral value: $4,500 · Max borrow: ~$3,825
        </p>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function LendPage() {
  const [tab, setTab] = useState<PageTab>("lend");

  return (
    <div className="relative min-h-screen text-white font-sans">
      <WaterfallBackground />
      <Header />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-8">

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-2 block">Arc Testnet · Vitael Protocol</span>
          <h1 className="text-4xl font-extrabold text-white">Lend &amp; Borrow</h1>
          <p className="text-[#8E9FB8] mt-2 text-sm">Supply assets to earn yield, or borrow against your collateral.</p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Net Worth"      value="$7,100.00" sub="+$23.45 today" />
          <StatCard label="Total Supplied" value="$5,000.00" sub="+12.42% APY" accent />
          <StatCard label="Total Borrowed" value="$2,400.00" sub="14.15% APY" />
          <StatCard label="Health Factor"  value="1.59"      sub="Safe zone" accent />
        </motion.div>

        {/* Main tab switcher */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex gap-1 bg-white/3 rounded-2xl p-1 mb-8 max-w-xs">
            <button onClick={() => setTab("lend")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition duration-200 ${
                tab === "lend" ? "bg-[#00F5FF] text-[#0A1428] shadow-lg" : "text-[#8E9FB8] hover:text-white"
              }`}>
              <TrendingUp className="w-4 h-4" /> Lend
            </button>
            <button onClick={() => setTab("borrow")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition duration-200 ${
                tab === "borrow" ? "bg-[#FF00C8] text-white shadow-lg" : "text-[#8E9FB8] hover:text-white"
              }`}>
              <TrendingDown className="w-4 h-4" /> Borrow
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
              {tab === "lend"   && <LendTab />}
              {tab === "borrow" && <BorrowTab />}
            </motion.div>
          </AnimatePresence>
        </motion.div>

      </main>
      <Footer />
    </div>
  );
}
