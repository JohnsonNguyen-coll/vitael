"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function StatsSection() {
    const [tvl, setTvl] = useState(42504200.00);
    const [borrowed, setBorrowed] = useState(28306600.00);

    // Dynamic compounding live simulation
    useEffect(() => {
        const interval = setInterval(() => {
            setTvl((prev) => prev + Math.random() * 0.45);
            setBorrowed((prev) => prev + Math.random() * 0.28);
        }, 1500);

        return () => clearInterval(interval);
    }, []);

    return (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 py-12">
            {/* TVL Card */}
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
                    ${tvl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-xs text-emerald-400 font-semibold">+4.82% (24h)</span>
            </motion.div>

            {/* Total Borrowed Card */}
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
                    ${borrowed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-xs text-emerald-400 font-semibold">+2.15% (24h)</span>
            </motion.div>

            {/* Average Net APY Card */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="glass-panel p-8 rounded-3xl relative overflow-hidden"
            >
                <div className="flex justify-between items-start mb-4">
                    <span className="text-xs uppercase tracking-wider text-[#8E9FB8]">Average Net APY</span>
                </div>
                <h3 className="text-3xl font-extrabold font-display text-[#00F5FF] mb-2">
                    12.42%
                </h3>
                <span className="text-xs text-[#8E9FB8] font-semibold">Optimized via Arc Gas Model</span>
            </motion.div>
        </section>
    );
}
