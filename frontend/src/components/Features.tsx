"use client";

import React from "react";
import { motion } from "framer-motion";

export default function Features() {
  const steps = [
    {
      num: "01",
      title: "Supply USDC",
      desc: "Deposit your USDC stablecoins to receive vUSDC yield shares. Instantly begin earning compounded interest."
    },
    {
      num: "02",
      title: "Earn vUSDC",
      desc: "vUSDC continuously appreciates in value relative to USDC as borrower interest accrues to the pool."
    },
    {
      num: "03",
      title: "Collateralized Borrow",
      desc: "Lock EURC, cirBTC, or USDC on Arc as collateral (Stork prices) to borrow USDC up to a safe LTV limit."
    },
    {
      num: "04",
      title: "Liquidation Safeguards",
      desc: "A standard 50% close factor protects positions from total liquidation while keeping the pool safe."
    }
  ];

  return (
    <section className="py-16">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-3 block">Architecture</span>
        <h2 className="text-4xl font-extrabold font-display text-white mb-4">How Vitael Capital Works</h2>
        <p className="text-[#8E9FB8] text-sm">A highly secure over-collateralized pool structure delivering automatic stablecoin efficiency.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
            className="glass-panel p-6 rounded-3xl relative overflow-hidden group hover:border-[#00F5FF]/30 transition-all duration-300"
          >
            <div className="text-3xl font-extrabold text-[#00F5FF] mb-4 font-display opacity-80">{step.num}</div>
            <h4 className="text-lg font-bold text-white mb-2">{step.title}</h4>
            <p className="text-xs text-[#8E9FB8] leading-relaxed">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
