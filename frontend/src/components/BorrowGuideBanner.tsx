"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, Shield, Wallet } from "lucide-react";
import { CIRCLE_FAUCET_URL } from "../lib/arcTokens";

const STEPS = [
  {
    icon: ExternalLink,
    title: "1. Get tokens",
    body: "USDC / EURC / cirBTC from Circle Faucet on Arc Testnet.",
  },
  {
    icon: Shield,
    title: "2. Deposit collateral",
    body: "EURC, cirBTC, or USDC in the Collateral panel (Stork prices).",
  },
  {
    icon: Wallet,
    title: "3. Borrow USDC",
    body: "Only USDC is borrowable from the pool.",
  },
];

export default function BorrowGuideBanner({ hasCollateral }: { hasCollateral: boolean }) {
  if (hasCollateral) return null;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-[#FF00C8]/20 bg-[#FF00C8]/5">
      <p className="text-sm font-bold text-white mb-1">How to borrow on Vitael (Arc + Stork)</p>
      <p className="text-xs text-[#8E9FB8] mb-4">
        Collateral: <strong className="text-white">EURC, cirBTC, USDC</strong>. Borrow asset:{" "}
        <strong className="text-[#FF00C8]">USDC</strong>.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3 rounded-xl bg-black/20 p-3">
            <Icon className="w-5 h-5 text-[#FF00C8] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white">{title}</p>
              <p className="text-xs text-[#8E9FB8] mt-0.5">{body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 mt-4">
        <a
          href={CIRCLE_FAUCET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[#00F5FF] hover:underline"
        >
          Circle Faucet <ExternalLink className="w-3 h-3" />
        </a>
        <Link href="/lend" className="inline-flex items-center gap-1 text-xs text-[#8E9FB8] hover:text-white">
          Supply USDC on Lend <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
