"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ShieldCheck, Clock, ExternalLink, ChevronDown, AlertTriangle } from "lucide-react";
import Header from "../../components/Header";
import WaterfallBackground from "../../components/WaterfallBackground";
import Footer from "../../components/Footer";
import ChainIcon from "../../components/ChainIcon";

// ─── Data ─────────────────────────────────────────────────────────────────────
// Bridge chỉ hỗ trợ USDC, dùng CCTP
interface Chain {
  id: string;       // App Kit chain identifier
  name: string;
  icon: string;
  isTestnet: boolean;
}

// Testnet chains hỗ trợ Bridge theo docs
const CHAINS: Chain[] = [
  { id: "Arc_Testnet",        name: "Arc Testnet",       icon: "⚡", isTestnet: true  },
  { id: "Ethereum_Sepolia",   name: "Ethereum Sepolia",  icon: "🔷", isTestnet: true  },
  { id: "Arbitrum_Sepolia",   name: "Arbitrum Sepolia",  icon: "🔵", isTestnet: true  },
  { id: "Base_Sepolia",       name: "Base Sepolia",      icon: "🟦", isTestnet: true  },
  { id: "Avalanche_Fuji",     name: "Avalanche Fuji",    icon: "🔺", isTestnet: true  },
  { id: "Polygon_Amoy_Testnet", name: "Polygon Amoy",   icon: "🟣", isTestnet: true  },
  { id: "OP_Sepolia",         name: "OP Sepolia",        icon: "🔴", isTestnet: true  },
  { id: "Solana_Devnet",      name: "Solana Devnet",     icon: "🟢", isTestnet: true  },
];

interface BridgeStep {
  chain: string;
  txHash: string;
  explorerUrl: string;
  status: string;
}

interface BridgeResult {
  fromChain: string;
  toChain: string;
  amount: string;
  steps: BridgeStep[];
}

// ─── Chain selector ───────────────────────────────────────────────────────────
function ChainSelector({ selected, onSelect, label, exclude }: {
  selected: Chain;
  onSelect: (c: Chain) => void;
  label: string;
  exclude: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-1">
      <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">{label}</p>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-2xl px-4 py-3.5 transition duration-200">
        <div className="flex items-center gap-3">
          <ChainIcon chainId={selected.id} size={32} showRing />
          <div className="text-left">
            <p className="font-bold text-white text-sm">{selected.name}</p>
            <p className="text-xs text-[#8E9FB8]">{selected.id}</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#8E9FB8] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 z-30 glass-panel rounded-2xl overflow-hidden shadow-2xl max-h-64 overflow-y-auto">
            {CHAINS.filter(c => c.id !== exclude).map(c => (
              <button key={c.id} onClick={() => { onSelect(c); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition duration-150 text-left ${selected.id === c.id ? "bg-white/3" : ""}`}>
                <ChainIcon chainId={c.id} size={28} />
                <div>
                  <p className="text-sm font-bold text-white">{c.name}</p>
                  <p className="text-xs text-[#8E9FB8]">{c.id}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BridgePage() {
  const [fromChain, setFromChain] = useState<Chain>(CHAINS[0]); // Arc Testnet
  const [toChain,   setToChain]   = useState<Chain>(CHAINS[1]); // Ethereum Sepolia
  const [amount,    setAmount]    = useState("");

  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<BridgeResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const numAmt    = parseFloat(amount) || 0;
  const sameChain = fromChain.id === toChain.id;

  function swapChains() {
    const tmp = fromChain;
    setFromChain(toChain);
    setToChain(tmp);
    setResult(null);
    setError(null);
  }

  async function execute() {
    if (!amount || numAmt <= 0 || sameChain) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromChain: fromChain.id,
          toChain:   toChain.id,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bridge failed");
      setResult(data as BridgeResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen text-white font-sans">
      <WaterfallBackground />
      <Header />

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-2 block">Cross-Chain · App Kit</span>
          <h1 className="text-4xl font-extrabold text-white">Bridge</h1>
          <p className="text-[#8E9FB8] mt-2 text-sm">
            Bridge USDC across chains via Circle CCTP — powered by Circle App Kit SDK.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* Bridge card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-3 glass-panel rounded-3xl p-6 relative overflow-hidden">

            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#8B00FF]/8 rounded-full blur-3xl pointer-events-none" />

            <h2 className="font-bold text-white text-lg mb-6">Bridge USDC</h2>

            {/* Chain selectors */}
            <div className="flex items-end gap-3 mb-5">
              <ChainSelector selected={fromChain} onSelect={c => { setFromChain(c); setResult(null); setError(null); }} label="From" exclude={toChain.id} />
              <button onClick={swapChains}
                className="mb-1 w-10 h-10 flex-shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#00F5FF] hover:bg-[#00F5FF]/10 hover:border-[#00F5FF]/30 transition duration-200">
                <ArrowRight className="w-4 h-4" />
              </button>
              <ChainSelector selected={toChain} onSelect={c => { setToChain(c); setResult(null); setError(null); }} label="To" exclude={fromChain.id} />
            </div>

            {/* Same chain warning */}
            <AnimatePresence>
              {sameChain && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-4">
                  <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-yellow-400 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Source and destination chains must be different.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Token — Bridge chỉ hỗ trợ USDC */}
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">Token</p>
              <div className="flex items-center gap-3 bg-white/3 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-xl">💵</span>
                <div>
                  <p className="text-sm font-bold text-white">USDC</p>
                  <p className="text-xs text-[#8E9FB8]">Only USDC is supported for bridging (CCTP)</p>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="mb-5">
              <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">Amount (USDC)</p>
              <div className="relative bg-black/30 border border-white/5 focus-within:border-[#00F5FF] rounded-2xl p-4 transition duration-200">
                <input type="number" placeholder="0.00" value={amount}
                  onChange={e => { setAmount(e.target.value); setResult(null); setError(null); }}
                  className="w-full bg-transparent text-2xl font-bold text-white outline-none placeholder-white/20" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00F5FF] font-bold text-sm">USDC</span>
              </div>
            </div>

            {/* Summary */}
            {numAmt > 0 && !sameChain && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white/2 rounded-xl p-4 space-y-2.5 mb-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8E9FB8]">From</span>
                  <span className="text-white font-semibold">{fromChain.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9FB8]">To</span>
                  <span className="text-[#00F5FF] font-semibold">{toChain.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9FB8]">Amount</span>
                  <span className="text-white font-bold">{numAmt} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9FB8] flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Est. time</span>
                  <span className="text-white">~2–5 min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9FB8]">Protocol</span>
                  <span className="text-white">Circle CCTP</span>
                </div>
              </motion.div>
            )}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-4">
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={execute} disabled={loading || !amount || numAmt <= 0 || sameChain}
              className="w-full bg-[#00F5FF] text-[#0A1428] font-bold py-3.5 rounded-xl hover:bg-white transition duration-300 disabled:opacity-40 flex items-center justify-center gap-2">
              {loading
                ? <><div className="w-5 h-5 border-2 border-[#0A1428]/30 border-t-[#0A1428] rounded-full animate-spin" />Bridging via CCTP...</>
                : `Bridge USDC → ${toChain.name}`}
            </button>

            <p className="text-center text-xs text-[#8E9FB8] mt-3">
              Powered by{" "}
              <a href="https://docs.arc.network/app-kit/bridge" target="_blank" className="text-[#00F5FF] hover:underline">
                Circle App Kit · CCTP
              </a>
            </p>
          </motion.div>

          {/* Right panel */}
          <div className="lg:col-span-2 space-y-5">

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="glass-panel rounded-3xl p-5 border border-emerald-400/20">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <p className="text-sm font-bold text-emerald-400">Bridge Initiated</p>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-[#8E9FB8]">Amount</span>
                      <span className="text-[#00F5FF] font-bold">{result.amount} USDC</span>
                    </div>
                  </div>
                  {result.steps?.map((step, i) => (
                    <div key={i} className="py-2 border-t border-white/5">
                      <p className="text-xs text-[#8E9FB8] mb-1">Step {i + 1} · {step.chain}</p>
                      <a href={step.explorerUrl} target="_blank"
                        className="flex items-center gap-1.5 text-[#00F5FF] text-xs hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" />
                        {step.txHash?.slice(0, 20)}...
                      </a>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Supported routes */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              className="glass-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-4">Supported Chains</p>
              <div className="space-y-2">
                {CHAINS.map(c => (
                  <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                    <ChainIcon chainId={c.id} size={24} />
                    <span className="text-sm text-white">{c.name}</span>
                    <span className="ml-auto text-xs text-emerald-400 font-semibold">✓ Bridge</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Faucet */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="glass-panel rounded-3xl p-5 border border-[#00F5FF]/10">
              <p className="text-xs uppercase tracking-wider text-[#00F5FF] font-bold mb-2">Arc Testnet Faucet</p>
              <p className="text-xs text-[#8E9FB8] mb-3 leading-relaxed">
                Get free testnet USDC to start bridging.
              </p>
              <a href="https://faucet.circle.com" target="_blank"
                className="flex items-center gap-2 text-sm text-[#00F5FF] font-semibold hover:underline">
                faucet.circle.com <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
