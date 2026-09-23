"use client";

import { AlertTriangle } from "lucide-react";
import type { OracleAssetStatus } from "../lib/oracleHealth";

type OracleStatusBannerProps = {
  status: OracleAssetStatus[] | null;
  loading?: boolean;
};

export default function OracleStatusBanner({ status, loading }: OracleStatusBannerProps) {
  if (loading || !status?.length) return null;

  const missing = status.filter((s) => !s.ok).map((s) => s.symbol);
  const rpcUnavailable = status.some((s) => !s.ok && s.error === "rpc");
  if (missing.length === 0) return null;

  if (rpcUnavailable) {
    return (
      <div className="app-notice app-notice-warning mb-4 flex items-start gap-3 border px-4 py-3 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold text-yellow-100">Oracle connection is temporarily unavailable</span>
          {" — "}Unable to read prices from Arc Mainnet. Retrying automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="app-notice app-notice-error mb-4 flex items-start gap-3 border px-4 py-3 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <p>
        <span className="font-semibold text-red-200">Oracle prices unavailable</span>
        {" — "}
        A valid, recent price is unavailable for {missing.join(", ")}. Actions requiring these prices
        may be unavailable until the oracle recovers.
      </p>
    </div>
  );
}
