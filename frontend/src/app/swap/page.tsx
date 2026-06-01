"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpDown, Settings, Info, ShieldCheck,
  ChevronDown, ExternalLink, AlertTriangle, Wallet,
} from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Header from "../../components/Header";
import WaterfallBackground from "../../components/WaterfallBackground";
import Footer from "../../components/Footer";
import TokenIcon from "../../components/TokenIcon";
import { useSwap } from "../../hooks/useSwap";

// ─── Tokens ───────────────────────────────────────────────────────────────────
interface Token { symbol: string; name: string }

const TOKENS: Token[] = [
  { symbol: "USDC",   name: "USD Coin"   },
  { symbol: "EURC",   name: "Euro Coin"  },
  { symbol: "cirBTC", name: "Circle BTC" },
];

// ─── Token selector ───────────────────────────────────────────────────────────
function TokenSelector({ selected, onSelect, exclude }: {
  selected: Token; onSelect: (t: Token) => void; exclude: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 transition duration-200">
        <TokenIcon symbol={selected.symbol} size={24} />
        <span className="font-bold text-white text-sm">{selected.symbol}</span>
        <ChevronDown className={`w-4 h-4 text-[#8E9FB8] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 z-30 glass-panel rounded-2xl overflow-hidden w-48 shadow-2xl">
            {TOKENS.filter(t => t.symbol !== exclude).map(t => (
              <button key={t.symbol} onClick={() => { onSelect(t); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition duration-150 text-left">
                <TokenIcon symbol={t.symbol} size={28} />
                <div>
                  <p className="text-sm font-bold text-white">{t.symbol}</p>
                  <p className="text-xs text-[#8E9FB8]">{t.name}</p>
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
export default function SwapPage() {
  const { isConnected } = useAccount();
  const { state, swap, reset } = useSwap();

  const [fromToken, setFromToken] = useState<Token>(TOKENS[0]); // USDC
  const [toToken,   setToToken]   = useState<Token>(TOKENS[1]); // EURC
  const [fromAmt,   setFromAmt]   = useState("");
  const [slippage,  setSlippage]  = useState("0.5");
  const [showSettings, setShowSettings] = useState(false);

  const numFrom = parseFloat(fromAmt) || 0;
  const busy    = state.step === "signing";
  const isDone  = state.step === "done";
  const isError = state.step === "error";

  // Kit key from env (public — safe to expose, it's a read-only API key)
  const kitKey = process.env.NEXT_PUBLIC_KIT_KEY ?? "";

  const flip = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmt("");
    reset();
  }, [fromToken, toToken, reset]);

  async function execute() {
    if (!fromAmt || numFrom <= 0 || !isConnected) return;
    await swap(fromToken.symbol, toToken.symbol, fromAmt, kitKey);
  }

  return (
    <div className="relative min-h-screen text-white font-sans">
      <WaterfallBackground />
      <Header />

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-2 block">
            Arc Testnet · Circle Swap Kit
          </span>
          <h1 className="text-4xl font-extrabold text-white">Swap</h1>
          <p className="text-[#8E9FB8] mt-2 text-sm">
            Swap USDC, EURC, cirBTC on Arc Testnet. You sign the transaction in your wallet.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* Swap card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-3 glass-panel rounded-3xl p-6 relative overflow-hidden">

            <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#00F5FF]/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-white text-lg">Swap Tokens</h2>
              <button onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl transition duration-200 ${showSettings ? "bg-[#00F5FF]/10 text-[#00F5FF]" : "text-[#8E9FB8] hover:text-white hover:bg-white/5"}`}>
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Settings */}
            <AnimatePresence>
              {showSettings && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-4">
                  <div className="bg-white/3 rounded-2xl p-4">
                    <p className="text-xs text-[#8E9FB8] mb-3 uppercase tracking-wider">Slippage Tolerance</p>
                    <div className="flex gap-2">
                      {["0.1", "0.5", "1.0"].map(v => (
                        <button key={v} onClick={() => setSlippage(v)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition duration-200 ${
                            slippage === v ? "bg-[#00F5FF] text-[#0A1428]" : "bg-white/5 text-[#8E9FB8] hover:bg-white/10"
                          }`}>{v}%</button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* From */}
            <div className="bg-black/30 border border-white/5 rounded-2xl p-4 mb-2">
              <span className="text-xs text-[#8E9FB8] uppercase tracking-wider">From</span>
              <div className="flex items-center gap-3 mt-3">
                <input type="number" placeholder="0.00" value={fromAmt} disabled={busy}
                  onChange={e => { setFromAmt(e.target.value); reset(); }}
                  className="flex-1 bg-transparent text-2xl font-bold text-white outline-none placeholder-white/20 disabled:opacity-50" />
                <TokenSelector selected={fromToken} onSelect={t => { setFromToken(t); reset(); }} exclude={toToken.symbol} />
              </div>
            </div>

            {/* Flip */}
            <div className="flex justify-center my-1">
              <button onClick={flip} disabled={busy}
                className="w-10 h-10 rounded-full bg-[#0A1428] border border-white/10 flex items-center justify-center text-[#00F5FF] hover:bg-[#00F5FF]/10 hover:border-[#00F5FF]/30 transition duration-200 disabled:opacity-40">
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>

            {/* To */}
            <div className="bg-black/30 border border-white/5 rounded-2xl p-4 mb-5">
              <span className="text-xs text-[#8E9FB8] uppercase tracking-wider">To (estimated)</span>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 text-2xl font-bold text-white/50">
                  {isDone && state.result ? state.result.amountOut : "—"}
                </div>
                <TokenSelector selected={toToken} onSelect={t => { setToToken(t); reset(); }} exclude={fromToken.symbol} />
              </div>
            </div>

            {/* Info row */}
            <div className="bg-white/2 rounded-xl p-4 space-y-2 mb-5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[#8E9FB8] flex items-center gap-1"><Info className="w-3.5 h-3.5" />Network</span>
                <span className="text-[#00F5FF] font-semibold">Arc Testnet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E9FB8]">Slippage</span>
                <span className="text-white">{slippage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E9FB8]">Wallet confirmations</span>
                <span className="text-[#00F5FF] font-semibold">1 (you sign)</span>
              </div>
            </div>

            {/* Status when busy */}
            {busy && (
              <div className="bg-[#00F5FF]/5 border border-[#00F5FF]/15 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-[#00F5FF]/30 border-t-[#00F5FF] rounded-full animate-spin flex-shrink-0" />
                <p className="text-sm text-[#00F5FF]">{state.stepLabel}</p>
              </div>
            )}

            {/* Error */}
            <AnimatePresence>
              {isError && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-4">
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{state.error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA */}
            {!isConnected ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-[#8E9FB8] flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Connect your wallet to swap
                </p>
                <ConnectButton />
              </div>
            ) : isDone ? (
              <button onClick={() => { reset(); setFromAmt(""); }}
                className="w-full bg-white/5 border border-white/10 text-white font-semibold py-3.5 rounded-xl hover:bg-white/10 transition duration-300">
                Swap Again
              </button>
            ) : (
              <button onClick={execute} disabled={busy || !fromAmt || numFrom <= 0}
                className="w-full bg-[#00F5FF] text-[#0A1428] font-bold py-3.5 rounded-xl hover:bg-white transition duration-300 disabled:opacity-40 flex items-center justify-center gap-2">
                {busy
                  ? <><div className="w-5 h-5 border-2 border-[#0A1428]/30 border-t-[#0A1428] rounded-full animate-spin" />{state.stepLabel}</>
                  : `Swap ${fromToken.symbol} → ${toToken.symbol}`}
              </button>
            )}

            <p className="text-center text-xs text-[#8E9FB8] mt-3">
              Powered by{" "}
              <a href="https://docs.arc.network/app-kit/swap" target="_blank" className="text-[#00F5FF] hover:underline">
                Circle Swap Kit
              </a>
              {" "}· You sign all transactions
            </p>
          </motion.div>

          {/* Right panel */}
          <div className="lg:col-span-2 space-y-5">

            {/* Result card */}
            <AnimatePresence>
              {isDone && state.result && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="glass-panel rounded-3xl p-5 border border-emerald-400/20">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <p className="text-sm font-bold text-emerald-400">Swap Successful</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#8E9FB8]">Sent</span>
                      <span className="text-white font-semibold">{state.result.amountIn} {state.result.tokenIn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8E9FB8]">Received</span>
                      <span className="text-[#00F5FF] font-bold">{state.result.amountOut} {state.result.tokenOut}</span>
                    </div>
                    {state.result.fees?.map((f, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-[#8E9FB8]">Fee ({f.type})</span>
                        <span className="text-white">{f.amount} {f.token}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-white/5">
                      <a href={state.result.explorerUrl} target="_blank"
                        className="flex items-center gap-1.5 text-[#00F5FF] text-xs hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" />
                        View on ArcScan
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Supported tokens */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              className="glass-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-4">Supported Tokens</p>
              <div className="space-y-3">
                {TOKENS.map(t => (
                  <div key={t.symbol} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <TokenIcon symbol={t.symbol} size={28} />
                    <div>
                      <p className="text-sm font-bold text-white">{t.symbol}</p>
                      <p className="text-xs text-[#8E9FB8]">{t.name}</p>
                    </div>
                    <span className="ml-auto text-xs text-emerald-400 font-semibold">✓ Live</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#8E9FB8] mt-4 leading-relaxed">
                Arc Testnet Swap supports USDC, EURC, and cirBTC only.
              </p>
            </motion.div>

            {/* How it works */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="glass-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-wider text-[#00F5FF] font-bold mb-4">How it works</p>
              <div className="space-y-3">
                {[
                  { n: "1", title: "Connect wallet", desc: "Connect MetaMask or any EVM wallet." },
                  { n: "2", title: "Sign in wallet", desc: "Circle Swap Kit builds the transaction — you sign once in MetaMask." },
                  { n: "3", title: "Done", desc: "Tokens arrive in your wallet on Arc Testnet." },
                ].map(s => (
                  <div key={s.n} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/20 flex items-center justify-center text-xs font-bold text-[#00F5FF] flex-shrink-0 mt-0.5">
                      {s.n}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{s.title}</p>
                      <p className="text-xs text-[#8E9FB8] mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Faucet */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
              className="glass-panel rounded-3xl p-5 border border-[#00F5FF]/10">
              <p className="text-xs uppercase tracking-wider text-[#00F5FF] font-bold mb-2">Need testnet tokens?</p>
              <p className="text-xs text-[#8E9FB8] mb-3">Get free USDC and EURC from the Circle Faucet.</p>
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
