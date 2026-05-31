"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import DeFiBackground from "../components/DeFiBackground";
import LendingWidget from "../components/LendingWidget";
import StatsSection from "../components/StatsSection";
import Features from "../components/Features";
import Markets from "../components/Markets";
import Footer from "../components/Footer";

export default function Home() {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);

    const handleConnect = () => {
        if (walletAddress) {
            setWalletAddress(null);
            return;
        }
        setConnecting(true);
        setTimeout(() => {
            setConnecting(false);
            setWalletAddress("0x71C7...6b89");
        }, 1200);
    };

    return (
        <div className="relative min-h-screen text-white font-sans bg-transparent">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-cyan/5 to-transparent pointer-events-none -z-10" />
            <DeFiBackground />

            {/* Sticky Navigation */}
            <header className="sticky top-0 w-full flex justify-between items-center py-5 px-8 md:px-16 backdrop-blur-xl border-b border-white/5 bg-[#050b14]/70 z-50">
                <div className="flex items-center gap-2">
                    <span className="text-2xl text-cyan drop-shadow-[0_0_10px_rgba(0,245,255,0.6)]">⚡</span>
                    <span className="font-extrabold font-display text-xl tracking-wider text-white">VITAEL</span>
                </div>
                <nav className="hidden md:flex gap-8 text-sm font-medium text-text-secondary">
                    <a href="#markets" className="hover:text-cyan transition duration-200">Markets</a>
                    <a href="#calculator" className="hover:text-cyan transition duration-200">Calculator</a>
                    <a href="https://testnet.arcscan.app" target="_blank" className="hover:text-cyan transition duration-200">Explorer</a>
                    <a href="https://docs.arc.network" target="_blank" className="hover:text-cyan transition duration-200">Docs</a>
                </nav>
                <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="px-6 py-2 border border-cyan/30 text-cyan text-sm font-semibold rounded-full hover:bg-cyan hover:text-black transition duration-300 disabled:opacity-50"
                >
                    {connecting ? "Connecting..." : walletAddress ? walletAddress : "Connect Wallet"}
                </button>
            </header>

            {/* Main Layout Container */}
            <main className="max-w-6xl mx-auto px-6 py-12 space-y-16">
                {/* Hero Section */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-8">
                    <div className="lg:col-span-7 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            className="inline-block bg-cyan/10 border border-cyan/20 text-cyan text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                        >
                            Arc Network Native
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="text-5xl md:text-6xl font-extrabold font-display leading-[1.1] text-white tracking-tight"
                        >
                            Earn while you <br />
                            <span className="text-gradient">lend on Arc</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="text-base md:text-lg text-text-secondary leading-relaxed max-w-lg"
                        >
                            The most capital-efficient lending protocol on Arc Network. Supplying USDC earns interest automatically under utilization-based compounding logic.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="flex flex-wrap gap-4 pt-2"
                        >
                            <a href="#markets" className="px-8 py-3.5 bg-gradient-to-r from-cyan to-purple text-white font-semibold rounded-full hover:shadow-lg hover:shadow-cyan/20 transition duration-300">
                                Start Supplying
                            </a>
                            <a href="https://faucet.circle.com" target="_blank" className="px-8 py-3.5 bg-white/5 border border-white/10 text-white font-semibold rounded-full hover:bg-white/10 transition duration-300">
                                Bridge USDC Now
                            </a>
                        </motion.div>
                    </div>

                    {/* Interactive Widget */}
                    <div id="calculator" className="lg:col-span-5 flex justify-center">
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, type: "spring", damping: 18 }}
                        >
                            <LendingWidget />
                        </motion.div>
                    </div>
                </section>

                {/* Stats Bar */}
                <StatsSection />

                {/* System workflow features */}
                <Features />

                {/* Money Markets assets */}
                <Markets />
            </main>

            {/* Footer */}
            <Footer />
        </div>
    );
}
