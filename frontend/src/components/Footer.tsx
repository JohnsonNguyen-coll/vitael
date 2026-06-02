"use client";

import React from "react";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 text-[#8E9FB8] text-sm bg-[#0f1419] w-full">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">

        {/* Logo + brand */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-3">
            <Image
              src="/vitael_logo.png"
              alt="Vitael"
              width={40}
              height={40}
              className="rounded-xl"
              unoptimized
            />
            <span
              className="text-2xl font-bold tracking-[0.12em] text-white"
              style={{ fontFamily: "var(--font-raleway)", letterSpacing: "0.12em" }}
            >
              VITAEL
            </span>
          </div>
          <p className="text-xs text-[#8E9FB8]/70 max-w-xs text-center md:text-left leading-relaxed">
            Institutional-grade over-collateralized lending pool on Arc Network.
            Built for stablecoin-native market efficiency.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-8 text-xs font-semibold text-[#8E9FB8]">
          <a href="#" className="hover:text-[#00F5FF] transition duration-200">Terms of Service</a>
          <a href="#" className="hover:text-[#00F5FF] transition duration-200">Privacy Policy</a>
          <a href="https://docs.arc.network" target="_blank" className="hover:text-[#00F5FF] transition duration-200">Arc Docs</a>
          <a href="https://testnet.arcscan.app" target="_blank" className="hover:text-[#00F5FF] transition duration-200">ArcScan Explorer</a>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[11px] text-[#8E9FB8]/50">
        <p>© 2026 Vitael Lending Protocol. Powered by Circle & Arc Network. All rights reserved.</p>
        <p className="mt-2 md:mt-0">Institutional Liquidity Engine</p>
      </div>
    </footer>
  );
}
