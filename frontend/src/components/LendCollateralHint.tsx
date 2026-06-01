"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function LendCollateralHint() {
  return (
    <div className="glass-panel rounded-2xl p-4 border border-[#00F5FF]/15 bg-[#00F5FF]/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-sm text-[#8E9FB8]">
        <span className="text-white font-semibold">EURC / cirBTC</span> are Arc collateral — deposit on Borrow to borrow{" "}
        <span className="text-[#FF00C8]">USDC</span>. Prices from Stork oracle.
      </p>
      <Link
        href="/borrow"
        className="inline-flex items-center justify-center gap-1.5 shrink-0 px-4 py-2 rounded-xl bg-[#FF00C8]/15 text-[#FF00C8] text-xs font-bold border border-[#FF00C8]/30 hover:bg-[#FF00C8]/25 transition"
      >
        Borrow USDC <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
