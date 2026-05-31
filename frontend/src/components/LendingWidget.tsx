"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, ShieldCheck, Flame, Plus } from "lucide-react";

export default function LendingWidget() {
    const [activeTab, setActiveTab] = useState<"supply" | "borrow">("supply");
    const [amount, setAmount] = useState<number>(1000);
    const [isExecuting, setIsExecuting] = useState(false);
    const [txSuccess, setTxSuccess] = useState(false);

    // Yield Calculations
    const supplyAPY = 12.42;
    const borrowAPY = 14.15;
    const currentAPY = activeTab === "supply" ? supplyAPY : borrowAPY;
    
    const monthlyYield = activeTab === "supply" 
        ? (amount * (supplyAPY / 100)) / 12 
        : (amount * (borrowAPY / 100)) / 12;

    const handleExecute = () => {
        setIsExecuting(true);
        setTimeout(() => {
            setIsExecuting(false);
            setTxSuccess(true);
            setTimeout(() => setTxSuccess(false), 5000);
        }, 2200);
    };

    return (
        <div className="glass-panel p-6 rounded-3xl w-full max-w-md relative overflow-hidden">
            {/* Glow Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan/10 rounded-full blur-2xl pointer-events-none" />

            {/* Success Overlay */}
            <AnimatePresence>
                {txSuccess && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-navy/95 z-20 flex flex-col items-center justify-center p-6 text-center"
                    >
                        <motion.div 
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", damping: 15 }}
                            className="w-16 h-16 bg-cyan/10 border border-cyan/30 rounded-full flex items-center justify-center mb-4 text-cyan"
                        >
                            <ShieldCheck className="w-8 h-8" />
                        </motion.div>
                        <h4 className="text-xl font-bold font-display text-white mb-2">Transaction Successful</h4>
                        <p className="text-sm text-text-secondary mb-4">
                            Successfully {activeTab === "supply" ? "supplied" : "borrowed"} {amount.toLocaleString()} USDC on Arc Testnet.
                        </p>
                        <button 
                            onClick={() => setTxSuccess(false)}
                            className="px-6 py-2 border border-cyan/20 rounded-full text-cyan text-sm hover:bg-cyan/10 transition"
                        >
                            Dismiss
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header Tabs */}
            <div className="flex bg-white/3 p-1 rounded-xl mb-6">
                <button
                    onClick={() => setActiveTab("supply")}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition duration-200 ${
                        activeTab === "supply" 
                            ? "bg-white/8 text-white shadow-sm" 
                            : "text-text-secondary hover:text-white"
                    }`}
                >
                    Supply
                </button>
                <button
                    onClick={() => setActiveTab("borrow")}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition duration-200 ${
                        activeTab === "borrow" 
                            ? "bg-white/8 text-white shadow-sm" 
                            : "text-text-secondary hover:text-white"
                    }`}
                >
                    Borrow
                </button>
            </div>

            {/* Input fields */}
            <div className="space-y-4">
                <div>
                    <label className="block text-xs uppercase tracking-wider text-text-secondary mb-2">
                        Amount (USDC)
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            className="w-full bg-black/30 border border-white/5 focus:border-cyan outline-none rounded-xl py-3 px-4 text-lg font-semibold text-white transition"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan font-semibold text-sm">
                            USDC
                        </span>
                    </div>
                </div>

                {/* Calculation stats */}
                <div className="bg-white/2 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-text-secondary">Expected APY</span>
                        <span className="text-cyan font-semibold">{currentAPY}%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-text-secondary">
                            {activeTab === "supply" ? "Projected Monthly Yield" : "Monthly Interest Cost"}
                        </span>
                        <span className="text-magenta font-semibold">
                            ${monthlyYield.toFixed(2)} USDC
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-text-secondary">Position Health Factor</span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-4 h-4" /> Infinite
                        </span>
                    </div>
                </div>

                {/* Action button */}
                <button
                    onClick={handleExecute}
                    disabled={isExecuting}
                    className="w-full bg-gradient-to-r from-cyan to-magenta text-white font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-magenta/20 transition duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isExecuting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Accruing State...
                        </>
                    ) : (
                        `Execute ${activeTab === "supply" ? "Supply" : "Borrow"}`
                    )}
                </button>
            </div>
        </div>
    );
}
