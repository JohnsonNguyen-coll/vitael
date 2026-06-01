"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useLending } from "../hooks/useLending";

import { formatUsd } from "../lib/format";

function fmtUsd(value: string): string {
  return formatUsd(parseFloat(value));
}

export default function StatsSection() {
  const { getProtocolStats } = useLending();
  const [tvl, setTvl] = useState<string | null>(null);
  const [borrowed, setBorrowed] = useState<string | null>(null);
  const [supplyApy, setSupplyApy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const stats = await getProtocolStats();
    if (!stats) return;
    setTvl(stats.totalSuppliedUsdc);
    setBorrowed(stats.totalBorrowedUsdc);
    setSupplyApy(stats.supplyApyPct);
  }, [getProtocolStats]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="glass-panel p-8 rounded-3xl relative overflow-hidden"
      >
        <div className="flex justify-between items-start mb-4">
          <span className="text-xs uppercase tracking-wider text-[#8E9FB8]">Total Value Locked</span>
        </div>
        <h3 className="text-3xl font-extrabold font-display text-white mb-2">
          {tvl ? fmtUsd(tvl) : <span className="inline-block h-9 w-40 bg-white/5 rounded animate-pulse" />}
        </h3>
        <span className="text-xs text-[#8E9FB8] font-semibold">USDC supplied · Arc Testnet</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="glass-panel p-8 rounded-3xl relative overflow-hidden"
      >
        <div className="flex justify-between items-start mb-4">
          <span className="text-xs uppercase tracking-wider text-[#8E9FB8]">Total Borrowed</span>
        </div>
        <h3 className="text-3xl font-extrabold font-display text-white mb-2">
          {borrowed ? fmtUsd(borrowed) : <span className="inline-block h-9 w-40 bg-white/5 rounded animate-pulse" />}
        </h3>
        <span className="text-xs text-[#8E9FB8] font-semibold">Live from VitaelLendingPool</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="glass-panel p-8 rounded-3xl relative overflow-hidden"
      >
        <div className="flex justify-between items-start mb-4">
          <span className="text-xs uppercase tracking-wider text-[#8E9FB8]">USDC Supply APY</span>
        </div>
        <h3 className="text-3xl font-extrabold font-display text-[#00F5FF] mb-2">
          {supplyApy !== null ? `${supplyApy.toFixed(2)}%` : <span className="inline-block h-9 w-24 bg-white/5 rounded animate-pulse" />}
        </h3>
        <span className="text-xs text-[#8E9FB8] font-semibold">Utilization-based rate model</span>
      </motion.div>
    </section>
  );
}
