"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ExternalLink } from "lucide-react";
import TxStatusBanner from "./TxStatusBanner";
import Link from "next/link";
import { useAccount } from "wagmi";
import WalletActionGate, { WalletConnectPrompt } from "./WalletActionGate";
import TokenIcon from "./TokenIcon";
import { formatTokenAmount } from "../lib/format";
import { useLending } from "../hooks/useLending";

const STEP_LABELS: Record<string, string> = {
  switching:  "Switching to Arc Testnet...",
  approving:  "Approving USDC...",
  supplying:  "Supply — sign in wallet...",
  borrowing:  "Borrow — sign in wallet...",
  confirming: "Waiting for confirmation...",
};

export default function LendingWidget() {
  const { isConnected } = useAccount();
  const { state, reset, supply, borrow, getProtocolStats, getUserInfo } = useLending();

  const [activeTab, setActiveTab] = useState<"supply" | "borrow">("supply");
  const [amount, setAmount] = useState("100");
  const [supplyApy, setSupplyApy] = useState(0);
  const [borrowApy, setBorrowApy] = useState(0);
  const [healthFactor, setHealthFactor] = useState("∞");

  const loadStats = useCallback(async () => {
    const stats = await getProtocolStats();
    if (stats) {
      setSupplyApy(stats.supplyApyPct);
      setBorrowApy(stats.borrowApyPct);
    }
  }, [getProtocolStats]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const { address } = useAccount();
  useEffect(() => {
    if (!address) { setHealthFactor("∞"); return; }
    getUserInfo(address).then(info => {
      if (info) setHealthFactor(info.healthFactor);
    });
  }, [address, getUserInfo, state.step]);

  useEffect(() => {
    if (state.step === "done") loadStats();
  }, [state.step, loadStats]);

  const num = parseFloat(amount) || 0;
  const currentAPY = activeTab === "supply" ? supplyApy : borrowApy;
  const monthlyYield = (num * (currentAPY / 100)) / 12;
  const busy = state.busy;
  const txSuccess = state.step === "done" && !busy;

  async function handleExecute() {
    if (!amount || num <= 0) return;
    reset();
    if (activeTab === "supply") {
      await supply("USDC", amount);
    } else {
      await borrow("USDC", amount);
    }
  }

  return (
    <div className="glass-panel p-6 rounded-3xl w-full max-w-md relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#00F5FF]/5 rounded-full blur-2xl pointer-events-none" />

      <AnimatePresence>
        {txSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0A1428]/95 z-20 flex flex-col items-center justify-center p-6 text-center rounded-3xl"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="w-16 h-16 bg-[#00F5FF]/10 border border-[#00F5FF]/30 rounded-full flex items-center justify-center mb-4 text-[#00F5FF]"
            >
              <ShieldCheck className="w-8 h-8" />
            </motion.div>
            <h4 className="text-xl font-bold text-white mb-2">Transaction Successful</h4>
            <p className="text-sm text-[#8E9FB8] mb-2">
              {activeTab === "supply" ? "Supplied" : "Borrowed"} {formatTokenAmount(num)} USDC on Arc Testnet.
            </p>
            {state.txHash && (
              <a
                href={`https://testnet.arcscan.app/tx/${state.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#00F5FF] hover:underline mb-4"
              >
                View on ArcScan <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={() => { reset(); setAmount(""); }}
              className="px-6 py-2 border border-[#00F5FF]/20 rounded-full text-[#00F5FF] text-sm hover:bg-[#00F5FF]/10 transition"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <TxStatusBanner
        step={state.step}
        error={state.error}
        txHash={state.txHash}
        stepLabels={STEP_LABELS}
      />

      <div className="flex bg-white/3 p-1 rounded-xl mb-6">
        {(["supply", "borrow"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); reset(); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition duration-200 ${
              activeTab === tab
                ? "bg-white/8 text-white shadow-sm"
                : "text-[#8E9FB8] hover:text-white"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#8E9FB8] mb-2">
            Amount
          </label>
          <div className="relative bg-black/30 border border-white/5 focus-within:border-[#00F5FF] rounded-xl transition">
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); reset(); }}
              disabled={busy}
              className="w-full bg-transparent py-3 pl-4 pr-24 text-lg font-semibold text-white outline-none disabled:opacity-50"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
              <TokenIcon symbol="USDC" size={18} />
              <span className="text-[#00F5FF] font-bold text-sm">USDC</span>
            </div>
          </div>
        </div>

        <div className="bg-white/2 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#8E9FB8]">Live APY (on-chain)</span>
            <span className={`font-semibold ${activeTab === "supply" ? "text-[#00F5FF]" : "text-[#FF00C8]"}`}>
              {currentAPY > 0 ? `${currentAPY.toFixed(2)}%` : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#8E9FB8]">
              {activeTab === "supply" ? "Projected Monthly Yield" : "Monthly Interest Cost"}
            </span>
            <span className="text-white font-semibold">
              {num > 0 && currentAPY > 0 ? `$${monthlyYield.toFixed(2)}` : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#8E9FB8]">Health Factor</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> {healthFactor}
            </span>
          </div>
        </div>

        <WalletActionGate connectMessage="Connect wallet to transact">
          {!isConnected ? (
            <WalletConnectPrompt message="Connect wallet to transact" />
          ) : (
            <button
              onClick={handleExecute}
              disabled={busy || !amount || num <= 0}
              className="w-full bg-[#00F5FF] text-[#0A1428] font-bold py-3 rounded-xl hover:bg-white hover:shadow-lg hover:shadow-[#00F5FF]/10 transition duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#0A1428]/30 border-t-[#0A1428] rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                `${activeTab === "supply" ? "Supply" : "Borrow"} USDC`
              )}
            </button>
          )}
        </WalletActionGate>

        <Link
          href={activeTab === "supply" ? "/lend" : "/borrow"}
          className="block text-center text-xs text-[#8E9FB8] hover:text-[#00F5FF] transition duration-200 pt-1"
        >
          Open full Lend &amp; Borrow →
        </Link>
      </div>
    </div>
  );
}
