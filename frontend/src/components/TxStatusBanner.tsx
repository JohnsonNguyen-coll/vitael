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
      <div className="app-notice app-notice-warning mb-4 flex items-start gap-2 border px-4 py-3 text-sm">
        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }

  if (error && step === "error") {
    return (
      <div className="app-notice app-notice-error mb-4 flex items-start gap-2 border px-4 py-3 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span className="break-all">{error}</span>
      </div>
    );
  }

  if (step === "done" && txHash) {
    return (
      <div className="app-notice app-notice-success mb-4 flex items-center justify-between border px-4 py-3">
        <span className="text-sm font-semibold">Transaction confirmed</span>
        <a
          href={`${EXPLORER}/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#A998FF] hover:underline"
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
      ? "border-[#7EE2B7]/30 border-t-[#7EE2B7]"
      : "border-[#A998FF]/30 border-t-[#A998FF]";
  const box =
    accent === "pink"
      ? "bg-[#7EE2B7]/5 border-[#7EE2B7]/15 text-[#7EE2B7]"
      : "bg-[#A998FF]/5 border-[#A998FF]/15 text-[#A998FF]";

  return (
    <div className={`app-notice app-notice-info mb-4 flex items-center gap-3 border px-4 py-3 ${box}`}>
      <div className={`w-4 h-4 border-2 rounded-full animate-spin shrink-0 ${spin}`} />
      <p className="text-sm">{label}</p>
    </div>
  );
}
