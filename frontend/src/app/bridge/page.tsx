"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ShieldCheck, Clock, ExternalLink,
  ChevronDown, AlertTriangle, Wallet,
} from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Header from "../../components/Header";
import WaterfallBackground from "../../components/WaterfallBackground";
import Footer from "../../components/Footer";
import ChainIcon from "../../components/ChainIcon";
import TokenIcon from "../../components/TokenIcon";
import { useCCTPBridge } from "../../hooks/useCCTPBridge";

// ─── Supported chains (only EVM testnets with CCTP V2) ───────────────────────
interface Chain {
  id: string;   // matches CONTRACTS key in hook
  name: string;
  domain: number;
}

const CHAINS: Chain[] = [
  { id: "Arc_Testnet",      name: "Arc Testnet",      domain: 26 },
  { id: "Ethereum_Sepolia", name: "Ethereum Sepolia",  domain: 0  },
];

// ─── Chain selector ───────────────────────────────────────────────────────────
function ChainSelector({ selected, onSelect, label, exclude }: {
  selected: Chain; onSelect: (c: Chain) => void; label: string; exclude: string;
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
            <p className="text-xs text-[#8E9FB8]">Domain {selected.domain}</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#8E9FB8] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 z-30 glass-panel rounded-2xl overflow-hidden shadow-2xl">
            {CHAINS.filter(c => c.id !== exclude).map(c => (
              <button key={c.id} onClick={() => { onSelect(c); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition duration-150 text-left">
                <ChainIcon chainId={c.id} size={28} />
                <div>
                  <p className="text-sm font-bold text-white">{c.name}</p>
                  <p className="text-xs text-[#8E9FB8]">Domain {c.domain}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Step progress bar ────────────────────────────────────────────────────────
const STEP_NAMES = ["Approve", "Burn & Bridge", "Attestation", "Done"];
const STEP_MAP: Record<string, number> = {
  idle: -1, switching_chain: 0, fetching_fees: 0,
  approving: 0, burning: 1, waiting_attestation: 2, done: 3, error: -1,
};

function StepBar({ currentStep }: { currentStep: string }) {
  const active = STEP_MAP[currentStep] ?? -1;
  return (
    <div className="flex items-center gap-1 mb-5">
      {STEP_NAMES.map((name, i) => (
        <div key={name} className="flex items-center flex-1">
          <div className={`flex items-center gap-1.5 flex-1 ${i < STEP_NAMES.length - 1 ? "" : ""}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-500 ${
              i < active  ? "bg-emerald-400 text-[#0A1428]"
              : i === active ? "bg-[#00F5FF] text-[#0A1428] ring-2 ring-[#00F5FF]/30"
              : "bg-white/10 text-[#8E9FB8]"
            }`}>
              {i < active ? "✓" : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === active ? "text-white" : "text-[#8E9FB8]"}`}>{name}</span>
          </div>
          {i < STEP_NAMES.length - 1 && (
            <div className={`h-px flex-1 mx-1 transition-all duration-500 ${i < active ? "bg-emerald-400" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BridgePage() {
  const { isConnected } = useAccount();
  const { state, bridge, reset } = useCCTPBridge();

  const [fromChain, setFromChain] = useState<Chain>(CHAINS[1]); // Ethereum Sepolia
  const [toChain,   setToChain]   = useState<Chain>(CHAINS[0]); // Arc Testnet
  const [amount,    setAmount]    = useState("");

  const numAmt    = parseFloat(amount) || 0;
  const sameChain = fromChain.id === toChain.id;
  const busy      = !["idle", "done", "error"].includes(state.step);
  const isDone    = state.step === "done";
  const isError   = state.step === "error";

  function swapChains() {
    const tmp = fromChain;
    setFromChain(toChain);
    setToChain(tmp);
  }

  async function execute() {
    if (!amount || numAmt <= 0 || sameChain || !isConnected) return;
    await bridge(
      fromChain.id as "Arc_Testnet" | "Ethereum_Sepolia",
      toChain.id   as "Arc_Testnet" | "Ethereum_Sepolia",
      amount,
    );
  }

  return (
    <div className="relative min-h-screen text-white font-sans">
      <WaterfallBackground />
      <Header />

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-2 block">
            Cross-Chain · Circle CCTP V2
          </span>
          <h1 className="text-4xl font-extrabold text-white">Bridge</h1>
          <p className="text-[#8E9FB8] mt-2 text-sm">
            Bridge USDC between chains. You sign 2 transactions in your wallet — no server involved.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* Bridge card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-3 glass-panel rounded-3xl p-6 relative overflow-hidden">

            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#8B00FF]/8 rounded-full blur-3xl pointer-events-none" />

            <h2 className="font-bold text-white text-lg mb-5">Bridge USDC</h2>

            {/* Step bar — shown when active */}
            {(busy || isDone) && <StepBar currentStep={state.step} />}

            {/* Chain selectors */}
            <div className="flex items-end gap-3 mb-5">
              <ChainSelector selected={fromChain} onSelect={c => { setFromChain(c); reset(); }} label="From" exclude={toChain.id} />
              <button onClick={swapChains} disabled={busy}
                className="mb-1 w-10 h-10 flex-shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#00F5FF] hover:bg-[#00F5FF]/10 hover:border-[#00F5FF]/30 transition duration-200 disabled:opacity-40">
                <ArrowRight className="w-4 h-4" />
              </button>
              <ChainSelector selected={toChain} onSelect={c => { setToChain(c); reset(); }} label="To" exclude={fromChain.id} />
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

            {/* Token — USDC only */}
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">Token</p>
              <div className="flex items-center gap-3 bg-white/3 border border-white/10 rounded-xl px-4 py-3">
                <TokenIcon symbol="USDC" size={28} />
                <div>
                  <p className="text-sm font-bold text-white">USDC</p>
                  <p className="text-xs text-[#8E9FB8]">Circle CCTP V2 — USDC only</p>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="mb-5">
              <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">Amount (USDC)</p>
              <div className="relative bg-black/30 border border-white/5 focus-within:border-[#00F5FF] rounded-2xl p-4 transition duration-200">
                <input type="number" placeholder="0.00" value={amount} disabled={busy}
                  onChange={e => { setAmount(e.target.value); reset(); }}
                  className="w-full bg-transparent text-2xl font-bold text-white outline-none placeholder-white/20 disabled:opacity-50" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00F5FF] font-bold text-sm">USDC</span>
              </div>
            </div>

            {/* Summary */}
            {numAmt > 0 && !sameChain && !busy && !isDone && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white/2 rounded-xl p-4 space-y-2.5 mb-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8E9FB8]">You send</span>
                  <span className="text-white font-semibold">{numAmt} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9FB8]">Protocol</span>
                  <span className="text-white">Circle CCTP V2 + Forwarding Service</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9FB8] flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Est. time</span>
                  <span className="text-white">~2 min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9FB8]">Wallet confirmations</span>
                  <span className="text-[#00F5FF] font-semibold">2 (Approve + Burn)</span>
                </div>
              </motion.div>
            )}

            {/* Status label when busy */}
            {busy && (
              <div className="bg-[#00F5FF]/5 border border-[#00F5FF]/15 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-[#00F5FF]/30 border-t-[#00F5FF] rounded-full animate-spin flex-shrink-0" />
                <p className="text-sm text-[#00F5FF]">{state.stepLabel}</p>
              </div>
            )}

            {/* Tx links */}
            {(state.approveTx || state.burnTx || state.forwardTx) && (
              <div className="space-y-2 mb-5">
                {state.approveTx && (
                  <a href={`${CHAINS.find(c=>c.id===fromChain.id) ? state.explorerBase : ""}${state.approveTx}`}
                    target="_blank" className="flex items-center gap-2 text-xs text-[#8E9FB8] hover:text-[#00F5FF] transition">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Approve tx: {state.approveTx.slice(0, 18)}...
                  </a>
                )}
                {state.burnTx && (
                  <a href={`${state.explorerBase}${state.burnTx}`} target="_blank"
                    className="flex items-center gap-2 text-xs text-[#8E9FB8] hover:text-[#00F5FF] transition">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Burn tx: {state.burnTx.slice(0, 18)}...
                  </a>
                )}
                {state.forwardTx && (
                  <a href={`https://testnet.arcscan.app/tx/${state.forwardTx}`} target="_blank"
                    className="flex items-center gap-2 text-xs text-emerald-400 hover:underline transition">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Mint on Arc: {state.forwardTx.slice(0, 18)}...
                  </a>
                )}
              </div>
            )}

            {/* Success */}
            <AnimatePresence>
              {isDone && (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-400/8 border border-emerald-400/20 rounded-2xl p-4 mb-5 flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-400">Bridge Complete</p>
                    <p className="text-xs text-[#8E9FB8] mt-0.5">
                      {numAmt} USDC arrived on {toChain.name}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                  <Wallet className="w-4 h-4" /> Connect your wallet to bridge
                </p>
                <ConnectButton />
              </div>
            ) : isDone ? (
              <button onClick={() => { reset(); setAmount(""); }}
                className="w-full bg-white/5 border border-white/10 text-white font-semibold py-3.5 rounded-xl hover:bg-white/10 transition duration-300">
                Bridge Again
              </button>
            ) : (
              <button onClick={execute} disabled={busy || !amount || numAmt <= 0 || sameChain}
                className="w-full bg-[#00F5FF] text-[#0A1428] font-bold py-3.5 rounded-xl hover:bg-white transition duration-300 disabled:opacity-40 flex items-center justify-center gap-2">
                {busy
                  ? <><div className="w-5 h-5 border-2 border-[#0A1428]/30 border-t-[#0A1428] rounded-full animate-spin" />{state.stepLabel}</>
                  : `Bridge ${numAmt || ""} USDC → ${toChain.name}`}
              </button>
            )}

            <p className="text-center text-xs text-[#8E9FB8] mt-3">
              Powered by{" "}
              <a href="https://developers.circle.com/cctp" target="_blank" className="text-[#00F5FF] hover:underline">
                Circle CCTP V2
              </a>
              {" "}· You sign all transactions
            </p>
          </motion.div>

          {/* Right panel */}
          <div className="lg:col-span-2 space-y-5">

            {/* How it works */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              className="glass-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-wider text-[#00F5FF] font-bold mb-4">How it works</p>
              <div className="space-y-4">
                {[
                  { n: "1", title: "Approve USDC", desc: "You sign an ERC-20 approve transaction on the source chain." },
                  { n: "2", title: "Burn & Bridge", desc: "You sign depositForBurnWithHook — USDC is burned and a CCTP message is emitted." },
                  { n: "3", title: "Circle Attestation", desc: "Circle's Forwarding Service picks up the message and mints USDC on the destination (~2 min)." },
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

            {/* Supported routes */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="glass-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-wider text-[#8E9FB8] mb-4">Supported Routes</p>
              <div className="space-y-3">
                {[
                  { from: "Ethereum_Sepolia", to: "Arc_Testnet",      fromName: "Ethereum Sepolia", toName: "Arc Testnet" },
                  { from: "Arc_Testnet",      to: "Ethereum_Sepolia", fromName: "Arc Testnet",      toName: "Ethereum Sepolia" },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <ChainIcon chainId={r.from} size={20} />
                      <span className="text-xs text-white">{r.fromName}</span>
                      <ArrowRight className="w-3 h-3 text-[#8E9FB8]" />
                      <ChainIcon chainId={r.to} size={20} />
                      <span className="text-xs text-[#00F5FF]">{r.toName}</span>
                    </div>
                    <span className="text-xs text-emerald-400">~2 min</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Faucet */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
              className="glass-panel rounded-3xl p-5 border border-[#00F5FF]/10">
              <p className="text-xs uppercase tracking-wider text-[#00F5FF] font-bold mb-2">Need testnet USDC?</p>
              <p className="text-xs text-[#8E9FB8] mb-3 leading-relaxed">
                Get free Sepolia USDC and Arc Testnet USDC from the Circle Faucet.
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
