"use client";

import React from "react";
import { motion } from "framer-motion";
import TokenIcon from "./TokenIcon";

export default function Markets() {
  const markets = [
    { name: "USDC", sub: "Gas Native",       supplied: "$14,197,600", supplyAPY: "12.42%", borrowed: "$9,800,200",  borrowAPY: "14.15%", type: "Stablecoin" },
    { name: "WETH", sub: "Collateral Token", supplied: "$18,406,000", supplyAPY: "4.20%",  borrowed: "$12,506,400", borrowAPY: "6.12%",  type: "Asset" },
    { name: "WBTC", sub: "Collateral Token", supplied: "$9,900,600",  supplyAPY: "3.10%",  borrowed: "$6,000,000",  borrowAPY: "5.30%",  type: "Asset" },
  ];

  return (
    <section id="markets" className="py-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-3 block">Markets</span>
          <h2 className="text-4xl font-extrabold font-display text-white">Active Borrowing Hubs</h2>
        </div>
        <div className="mt-4 md:mt-0 text-sm text-[#8E9FB8]">
          Total Liquidity: <span className="text-white font-semibold">$42,504,200</span>
        </div>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-[#8E9FB8]">
                <th className="py-5 px-6 font-semibold">Asset</th>
                <th className="py-5 px-6 font-semibold">Total Supplied</th>
                <th className="py-5 px-6 font-semibold text-[#00F5FF]">Supply APY</th>
                <th className="py-5 px-6 font-semibold">Total Borrowed</th>
                <th className="py-5 px-6 font-semibold text-[#FF00C8]">Borrow APY</th>
                <th className="py-5 px-6 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="border-b border-white/5 hover:bg-white/2 transition duration-200"
                >
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <TokenIcon symbol={m.name} size={36} />
                      <div>
                        <div className="font-bold text-white text-base">{m.name}</div>
                        <div className="text-xs text-[#8E9FB8]">{m.sub}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6 text-sm text-white font-medium">{m.supplied}</td>
                  <td className="py-5 px-6 text-sm text-[#00F5FF] font-bold">{m.supplyAPY}</td>
                  <td className="py-5 px-6 text-sm text-white font-medium">{m.borrowed}</td>
                  <td className="py-5 px-6 text-sm text-[#FF00C8] font-bold">{m.borrowAPY}</td>
                  <td className="py-5 px-6 text-right">
                    <a href="#calculator" className="px-5 py-2 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-[#00F5FF] text-sm font-semibold hover:bg-[#00F5FF] hover:text-[#0A1428] transition duration-300">
                      Transact
                    </a>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
