"use client";

import { ArrowRight, Landmark, ShieldCheck } from "lucide-react";

type Variant = "lend" | "borrow";
const COPY = {
  lend: { title: "Supply any asset to earn yield", lines: ["Deposit USDC, EURC, or cirBTC", "Earn interest automatically", "Use supplied assets as collateral"] },
  borrow: { title: "Borrow with a visible safety margin", lines: ["Deposit collateral", "Review live Stork prices", "Borrow USDC from the pool"] },
} satisfies Record<Variant, { title: string; lines: string[] }>;

export default function ProtocolFlowHint({ variant }: { variant: Variant }) {
  const { title, lines } = COPY[variant];
  const Icon = variant === "lend" ? Landmark : ShieldCheck;
  return (
    <div className="protocol-flow-card">
      <span className="protocol-flow-icon"><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#d9dbe8]">{title}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#747d9a]">{lines.map((line, index) => <span key={line} className="flex items-center gap-2"><b className="font-medium">{line}</b>{index < lines.length - 1 && <ArrowRight className="size-3 text-[#5d6380]" />}</span>)}</div></div>
      <span className="hidden rounded-full border border-[#A998FF]/15 bg-[#A998FF]/[0.06] px-3 py-1 text-[9px] uppercase tracking-wider text-[#9f90e6] sm:block">Wallet controlled</span>
    </div>
  );
}
