"use client";

import { AlertTriangle, ExternalLink, XCircle } from "lucide-react";

type TxStatusBannerProps = {
  step: string;
  error: string | null;
  txHash?: string | null;
  stepLabels?: Record<string, string>;
  accent?: "cyan" | "pink";
};

const EXPLORER = "https://testnet.arcscan.app/tx";

export default function TxStatusBanner({
  step,
  error,
  txHash = null,
  stepLabels = {},
  accent = "cyan",
}: TxStatusBannerProps) {
  if (step === "cancelled" && error) {
    return (
      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-amber-200 text-sm mb-4">
        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }

  if (error && step === "error") {
    return (
      <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span className="break-all">{error}</span>
      </div>
    );
  }

  if (step === "done" && txHash) {
    return (
      <div className="flex items-center justify-between bg-emerald-400/8 border border-emerald-400/20 rounded-xl px-4 py-3 mb-4">
        <span className="text-sm text-emerald-400 font-semibold">Transaction confirmed ✓</span>
        <a
          href={`${EXPLORER}/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#00F5FF] hover:underline"
        >
          ArcScan <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  const label = stepLabels[step];
  if (!label) return null;

  const spin =
    accent === "pink"
      ? "border-[#FF00C8]/30 border-t-[#FF00C8]"
      : "border-[#00F5FF]/30 border-t-[#00F5FF]";
  const box =
    accent === "pink"
      ? "bg-[#FF00C8]/5 border-[#FF00C8]/15 text-[#FF00C8]"
      : "bg-[#00F5FF]/5 border-[#00F5FF]/15 text-[#00F5FF]";

  return (
    <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 mb-4 ${box}`}>
      <div className={`w-4 h-4 border-2 rounded-full animate-spin shrink-0 ${spin}`} />
      <p className="text-sm">{label}</p>
    </div>
  );
}
