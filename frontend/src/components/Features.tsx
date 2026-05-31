"use client";

import { motion } from "framer-motion";
import { Download, RefreshCw, Landmark, ShieldAlert } from "lucide-react";

export default function Features() {
    const steps = [
        {
            icon: <Landmark className="w-8 h-8 text-cyan" />,
            title: "1. Supply USDC",
            desc: "Deposit your USDC stablecoins to receive vUSDC yield shares. Instantly begin earning compounded interest."
        },
        {
            icon: <RefreshCw className="w-8 h-8 text-magenta" />,
            title: "2. Earn vUSDC",
            desc: "vUSDC continuously appreciates in value relative to USDC as borrower interest accrues to the pool."
        },
        {
            icon: <Download className="w-8 h-8 text-purple-400" />,
            title: "3. Over-collateralized Borrowing",
            desc: "Lock WETH or WBTC as collateral to borrow USDC gas tokens up to a safe 80-85% LTV limit."
        },
        {
            icon: <ShieldAlert className="w-8 h-8 text-amber-400" />,
            title: "4. Liquidation Safeguards",
            desc: "A standard 50% close factor protects positions from total liquidation while keeping the pool safe."
        }
    ];

    return (
        <section className="py-16">
            <div className="text-center max-w-2xl mx-auto mb-16">
                <span className="text-xs uppercase tracking-widest text-cyan font-bold mb-3 block">Architecture</span>
                <h2 className="text-4xl font-extrabold font-display text-white mb-4">How Vitael Capital Works</h2>
                <p className="text-text-secondary text-sm">A highly secure over-collateralized pool structure delivering automatic stablecoin efficiency.</p>
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
                        className="glass-panel p-6 rounded-3xl relative overflow-hidden group"
                    >
                        {/* Hover Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 to-magenta/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                        <div className="mb-4">{step.icon}</div>
                        <h4 className="text-lg font-bold text-white mb-2">{step.title}</h4>
                        <p className="text-xs text-text-secondary leading-relaxed">{step.desc}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
