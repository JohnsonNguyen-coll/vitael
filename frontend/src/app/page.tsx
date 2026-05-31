"use client";

import React from "react";
import { motion } from "framer-motion";
import Header from "../components/Header";
import WaterfallBackground from "../components/WaterfallBackground";
import LendingWidget from "../components/LendingWidget";
import StatsSection from "../components/StatsSection";
import Features from "../components/Features";
import Markets from "../components/Markets";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="relative min-h-screen text-white bg-transparent font-sans">
      <WaterfallBackground />

      {/* Sticky Header */}
      <Header />

      {/* Main Layout Container */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16 space-y-16">
        {/* Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-8">
          <div className="lg:col-span-7 space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="inline-block bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-[#00F5FF] text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
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
              <span className="text-[#00F5FF]">lend on Arc</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-base md:text-lg text-[#8E9FB8] leading-relaxed max-w-lg"
            >
              The most capital-efficient lending protocol on Arc Network. Supplying USDC earns interest automatically under utilization-based compounding logic.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-wrap gap-4 pt-2"
            >
              <a href="#calculator" className="px-8 py-3.5 bg-[#00F5FF] text-[#0A1428] font-bold rounded-full hover:bg-white transition duration-300 shadow-[0_0_15px_rgba(0,245,255,0.3)]">
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
