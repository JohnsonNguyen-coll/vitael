"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, TrendingUp, TrendingDown, Info, ChevronDown } from "lucide-react";
import Header from "../../components/Header";
import WaterfallBackground from "../../components/WaterfallBackground";
import Footer from "../../components/Footer";
import TokenIcon from "../../components/TokenIcon";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "supply" | "borrow" | "withdraw" | "repay";

interface Asset {
  symbol: string;
  name: string;
  supplyAPY: number;
  borrowAPY: number;
  ltv: number;
  liquidity: string;
  decimals: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const ASSETS: Asset[] = [
  { symbol: "USDC",  name: "USD Coin",        supplyAPY: 12.42, borrowAPY: 14.15, ltv: 0,   liquidity: "$14.2M", decimals: 6 },
  { symbol: "WETH",  name: "Wrapped Ether",   supplyAPY: 4.20,  borrowAPY: 6.12,  ltv: 80,  liquidity: "$18.4M", decimals: 18 },
  { symbol: "WBTC",  name: "Wrapped Bitcoin", supplyAPY: 3.10,  borrowAPY: 5.30,  ltv: 70,  liquidity: "$9.9M",  decimals: 8 },
];

const USER_POSITIONS = {
  supplied:   [{ symbol: "USDC", amount: "5,000.00", value: "$5,000.00", apy: "12.42%", earned: "+$51.75" }],
  collateral: [{ symbol: "WETH", amount: "1.5",      value: "$4,500.00", ltv: "80%" }],
  borrowed:   [{ symbol: "USDC", amount: "2,400.00", value: "$2,400.00", apy: "14.15%", interest: "-$28.30" }],
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">{label}</p>
      <p className={`text-2xl font-extrabold ${accent ? "text-[#00F5FF]" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-emerald-400 mt-1">{sub}</p>}
    </div>
  );
}

function AssetRow({ asset, onSelect, selected }: { asset: Asset; onSelect: () => void; selected: boolean }) {
  return (
    <motion.tr
      onClick={onSelect}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
      className={`border-b border-white/5 cursor-pointer transition-all duration-200 ${selected ? "bg-[#00F5FF]/5" : ""}`}
    >
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          <TokenIcon symbol={asset.symbol} size={36} />
          <div>
            <p className="font-bold text-white text-sm">{asset.symbol}</p>
            <p className="text-xs text-[#8E9FB8]">{asset.name}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-5 text-sm text-[#00F5FF] font-bold">{asset.supplyAPY.toFixed(2)}%</td>
      <td className="py-4 px-5 text-sm text-[#FF00C8] font-bold">{asset.borrowAPY.toFixed(2)}%</td>
      <td className="py-4 px-5 text-sm text-white">{asset.ltv > 0 ? `${asset.ltv}%` : "—"}</td>
      <td className="py-4 px-5 text-sm text-[#8E9FB8]">{asset.liquidity}</td>
      <td className="py-4 px-5 text-right">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border transition duration-200 ${
          selected
            ? "bg-[#00F5FF] text-[#0A1428] border-[#00F5FF]"
            : "bg-[#00F5FF]/10 text-[#00F5FF] border-[#00F5FF]/20 hover:bg-[#00F5FF]/20"
        }`}>
          {selected ? "Selected" : "Select"}
        </span>
      </td>
    </motion.tr>
  );
}

// ─── Main action panel ────────────────────────────────────────────────────────
function ActionPanel({ asset }: { asset: Asset }) {
  const [tab, setTab]       = useState<Tab>("supply");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const apy = tab === "supply" || tab === "withdraw" ? asset.supplyAPY : asset.borrowAPY;
  const numAmount = parseFloat(amount) || 0;
  const monthly = (numAmount * (apy / 100)) / 12;

  const healthFactor =
    tab === "borrow" && numAmount > 0
      ? ((4500 * 0.85) / (2400 + numAmount)).toFixed(2)
      : "∞";

  const hfColor =
    healthFactor === "∞" ? "text-emerald-400"
    : parseFloat(healthFactor) > 1.5 ? "text-emerald-400"
    : parseFloat(healthFactor) > 1.1 ? "text-yellow-400"
    : "text-red-400";

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "supply",   label: "Supply",   icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "borrow",   label: "Borrow",   icon: <TrendingDown className="w-3.5 h-3.5" /> },
    { id: "withdraw", label: "Withdraw", icon: <TrendingDown className="w-3.5 h-3.5" /> },
    { id: "repay",    label: "Repay",    icon: <TrendingUp className="w-3.5 h-3.5" /> },
  ];

  function execute() {
    if (!amount || numAmount <= 0) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSuccess(true); setTimeout(() => setSuccess(false), 4000); }, 2000);
  }

  return (
    <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
      {/* glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#00F5FF]/5 rounded-full blur-3xl pointer-events-none" />

      {/* success overlay */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-[#0A1428]/95 flex flex-col items-center justify-center rounded-3xl"
          >
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 14 }}
              className="w-16 h-16 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/30 flex items-center justify-center text-[#00F5FF] mb-4">
              <ShieldCheck className="w-8 h-8" />
            </motion.div>
            <p className="text-white font-bold text-lg mb-1">Transaction Sent</p>
            <p className="text-[#8E9FB8] text-sm mb-4">
              {tab.charAt(0).toUpperCase() + tab.slice(1)} {numAmount.toLocaleString()} {asset.symbol}
            </p>
            <button onClick={() => setSuccess(false)}
              className="px-5 py-2 rounded-full border border-[#00F5FF]/20 text-[#00F5FF] text-sm hover:bg-[#00F5FF]/10 transition">
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* asset header */}
      <div className="flex items-center gap-3 mb-5">
        <TokenIcon symbol={asset.symbol} size={44} />
        <div>
          <p className="font-extrabold text-white text-lg">{asset.symbol}</p>
          <p className="text-xs text-[#8E9FB8]">{asset.name}</p>
        </div>
      </div>

      {/* tabs */}
      <div className="flex bg-white/3 p-1 rounded-xl mb-5 gap-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition duration-200 ${
              tab === t.id ? "bg-white/8 text-white" : "text-[#8E9FB8] hover:text-white"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* amount input */}
      <div className="mb-4">
        <label className="block text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">Amount</label>
        <div className="relative">
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-black/30 border border-white/5 focus:border-[#00F5FF] outline-none rounded-xl py-3 px-4 text-lg font-semibold text-white transition"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00F5FF] font-bold text-sm">{asset.symbol}</span>
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-[#8E9FB8]">
          <span>Balance: —</span>
          <button className="text-[#00F5FF] hover:underline" onClick={() => setAmount("1000")}>MAX</button>
        </div>
      </div>

      {/* stats */}
      <div className="bg-white/2 rounded-xl p-4 space-y-2.5 mb-5 text-sm">
        <div className="flex justify-between">
          <span className="text-[#8E9FB8]">{tab === "supply" || tab === "withdraw" ? "Supply APY" : "Borrow APY"}</span>
          <span className={tab === "supply" || tab === "withdraw" ? "text-[#00F5FF] font-bold" : "text-[#FF00C8] font-bold"}>
            {apy.toFixed(2)}%
          </span>
        </div>
        {numAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-[#8E9FB8]">Est. monthly {tab === "supply" ? "yield" : "cost"}</span>
            <span className="text-white font-semibold">${monthly.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-[#8E9FB8] flex items-center gap-1">
            Health Factor <Info className="w-3 h-3" />
          </span>
          <span className={`font-bold flex items-center gap-1 ${hfColor}`}>
            <ShieldCheck className="w-3.5 h-3.5" />{healthFactor}
          </span>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={execute}
        disabled={loading || !amount || numAmount <= 0}
        className="w-full bg-[#00F5FF] text-[#0A1428] font-bold py-3.5 rounded-xl hover:bg-white transition duration-300 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {loading ? (
          <><div className="w-5 h-5 border-2 border-[#0A1428]/30 border-t-[#0A1428] rounded-full animate-spin" />Processing...</>
        ) : (
          `${tab.charAt(0).toUpperCase() + tab.slice(1)} ${asset.symbol}`
        )}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LendPage() {
  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [showPositions, setShowPositions] = useState(true);

  return (
    <div className="relative min-h-screen text-white font-sans">
      <WaterfallBackground />
      <Header />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-10">

        {/* Page title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-2 block">Protocol</span>
          <h1 className="text-4xl font-extrabold text-white">Lend &amp; Borrow</h1>
          <p className="text-[#8E9FB8] mt-2 text-sm">Supply assets to earn yield or borrow against your collateral.</p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatCard label="Net Worth"       value="$7,100.00"  sub="+$23.45 today" />
          <StatCard label="Total Supplied"  value="$5,000.00"  sub="+12.42% APY" accent />
          <StatCard label="Total Borrowed"  value="$2,400.00"  sub="14.15% APY" />
          <StatCard label="Health Factor"   value="1.59"       sub="Safe zone" accent />
        </motion.div>

        {/* Main grid: table + action panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Asset table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
            className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-white/5">
              <h2 className="font-bold text-white">Available Markets</h2>
              <p className="text-xs text-[#8E9FB8] mt-0.5">Click a row to select an asset</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-[#8E9FB8]">
                    <th className="py-3 px-5">Asset</th>
                    <th className="py-3 px-5 text-[#00F5FF]">Supply APY</th>
                    <th className="py-3 px-5 text-[#FF00C8]">Borrow APY</th>
                    <th className="py-3 px-5">Max LTV</th>
                    <th className="py-3 px-5">Liquidity</th>
                    <th className="py-3 px-5" />
                  </tr>
                </thead>
                <tbody>
                  {ASSETS.map((a) => (
                    <AssetRow
                      key={a.symbol}
                      asset={a}
                      selected={selectedAsset.symbol === a.symbol}
                      onSelect={() => setSelectedAsset(a)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Action panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          >
            <ActionPanel asset={selectedAsset} />
          </motion.div>
        </div>

        {/* My Positions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}
          className="glass-panel rounded-3xl overflow-hidden"
        >
          <button
            onClick={() => setShowPositions(!showPositions)}
            className="w-full flex items-center justify-between px-6 py-5 border-b border-white/5 hover:bg-white/2 transition"
          >
            <h2 className="font-bold text-white">My Positions</h2>
            <ChevronDown className={`w-5 h-5 text-[#8E9FB8] transition-transform duration-300 ${showPositions ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {showPositions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/5">
                  {/* Supplied */}
                  <div className="p-6">
                    <p className="text-xs uppercase tracking-wider text-[#00F5FF] font-bold mb-4">Supplied</p>
                    {USER_POSITIONS.supplied.map((p, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={p.symbol} size={24} />
                          <div>
                            <p className="text-sm font-bold text-white">{p.symbol}</p>
                            <p className="text-xs text-[#8E9FB8]">{p.amount} · {p.value}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#00F5FF] font-semibold">{p.apy}</p>
                          <p className="text-xs text-emerald-400">{p.earned}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Collateral */}
                  <div className="p-6">
                    <p className="text-xs uppercase tracking-wider text-[#8B00FF] font-bold mb-4">Collateral</p>
                    {USER_POSITIONS.collateral.map((p, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={p.symbol} size={24} />
                          <div>
                            <p className="text-sm font-bold text-white">{p.symbol}</p>
                            <p className="text-xs text-[#8E9FB8]">{p.amount} · {p.value}</p>
                          </div>
                        </div>
                        <p className="text-xs text-[#8B00FF] font-semibold">LTV {p.ltv}</p>
                      </div>
                    ))}
                  </div>

                  {/* Borrowed */}
                  <div className="p-6">
                    <p className="text-xs uppercase tracking-wider text-[#FF00C8] font-bold mb-4">Borrowed</p>
                    {USER_POSITIONS.borrowed.map((p, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={p.symbol} size={24} />
                          <div>
                            <p className="text-sm font-bold text-white">{p.symbol}</p>
                            <p className="text-xs text-[#8E9FB8]">{p.amount} · {p.value}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#FF00C8] font-semibold">{p.apy}</p>
                          <p className="text-xs text-red-400">{p.interest}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </main>
      <Footer />
    </div>
  );
}
