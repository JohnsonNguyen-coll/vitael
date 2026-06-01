"use client";

type Variant = "lend" | "borrow";

const COPY: Record<Variant, { title: string; lines: string[] }> = {
  lend: {
    title: "Lend = supply USDC to earn yield",
    lines: [
      "You supply USDC and receive interest-bearing vUSDC.",
      "EURC / cirBTC are not supplied here — use them as collateral on the Borrow page.",
    ],
  },
  borrow: {
    title: "Borrow = collateral → borrow USDC",
    lines: [
      "Step 1: Deposit EURC, cirBTC, or USDC as collateral (right panel).",
      "Step 2: Borrow USDC — only USDC can be borrowed from the pool.",
    ],
  },
};

export default function ProtocolFlowHint({ variant }: { variant: Variant }) {
  const { title, lines } = COPY[variant];
  const accent = variant === "lend" ? "text-[#00F5FF] border-[#00F5FF]/20 bg-[#00F5FF]/5" : "text-[#FF00C8] border-[#FF00C8]/20 bg-[#FF00C8]/5";

  return (
    <div className={`rounded-xl border px-4 py-3 text-xs ${accent}`}>
      <p className="font-bold text-white mb-1.5">{title}</p>
      <ul className="space-y-1 text-[#8E9FB8] list-disc list-inside">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
