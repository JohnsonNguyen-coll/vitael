"use client";

import { Activity } from "lucide-react";

export default function Footer() {
    return (
        <footer className="border-t border-white/5 py-12 text-center text-text-secondary text-sm">
            <div className="max-w-md mx-auto flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xl text-cyan">⚡</span>
                    <span className="font-extrabold font-display text-white tracking-widest">VITAEL</span>
                </div>
                <p className="text-xs leading-relaxed max-w-xs">
                    The most capital-efficient stablecoin-native yield engine on Arc Network. Built for over-collateralized borrowing safely.
                </p>
                <div className="flex gap-6 mt-2 text-xs">
                    <a href="#" className="hover:text-cyan transition">Terms</a>
                    <a href="#" className="hover:text-cyan transition">Privacy</a>
                    <a href="https://docs.arc.network" target="_blank" className="hover:text-cyan transition">Docs</a>
                </div>
                <p className="text-[10px] text-white/40 mt-4">
                    © 2026 Vitael Lending Protocol. Powered by Circle & Arc Network. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
