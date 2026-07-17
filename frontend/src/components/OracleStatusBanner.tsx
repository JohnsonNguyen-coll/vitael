"use client";

import { AlertTriangle } from "lucide-react";
import type { OracleAssetStatus } from "../lib/oracleHealth";

type OracleStatusBannerProps = {
  status: OracleAssetStatus[] | null;
  loading?: boolean;
};

export default function OracleStatusBanner({ status, loading }: OracleStatusBannerProps) {
  if (loading || !status?.length) return null;

  const usdc = status.find((s) => s.symbol === "USDC");
  const missing = status.filter((s) => !s.ok).map((s) => s.symbol);
  const rpcUnavailable = status.some((s) => !s.ok && s.error === "rpc");
  if (!usdc || usdc.ok) return null;

  if (rpcUnavailable) {
    return (
      <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-yellow-200 text-sm mb-4">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold text-yellow-100">Oracle connection is temporarily unavailable</span>
          {" — "}Arc Testnet RPC is rate-limiting price checks. Retrying automatically; do not treat this as a missing Stork feed.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <p>
        <span className="font-semibold text-red-200">Oracle prices unavailable</span>
        {" — "}
        Stork has no on-chain price for {missing.join(", ")}. Borrow and health factor checks will fail
        until Stork prices are updated on Arc Testnet (see Stork docs:{" "}
        <code className="text-xs text-[#8E9FB8]">updateTemporalNumericValuesV1</code>
        ). Testnet-only fallback:{" "}
        <code className="text-xs text-[#8E9FB8]">PatchMissingStorkFeeds.s.sol</code>.
      </p>
    </div>
  );
}
