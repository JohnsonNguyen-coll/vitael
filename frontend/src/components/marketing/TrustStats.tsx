"use client";

import { useEffect, useState } from "react";
import { Activity, CircleDollarSign, LockKeyhole, Radio } from "lucide-react";
import { backendApi } from "@/lib/backendApi";
import { formatUsd } from "@/lib/format";

export default function TrustStats() {
  const [tvl, setTvl] = useState<number | null>(null);
  const [volume, setVolume] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    backendApi.protocolStats()
      .then(({ stats }) => {
        if (!active || !stats) return;
        setTvl(Number(stats.tvl_usd));
        setVolume(Number(stats.swap_volume_usd));
      })
      .catch(() => {
        // Keep the landing page available while the independent indexer is offline.
      });
    return () => { active = false; };
  }, []);

  const stats = [
    [CircleDollarSign, tvl === null ? "—" : formatUsd(tvl), "Protocol TVL"],
    [Activity, volume === null ? "—" : formatUsd(volume), "24h swap volume"],
    [LockKeyhole, "100%", "Non-custodial"],
    [Radio, "24/7", "Oracle monitoring"],
  ] as const;

  return (
    <section id="stats" className="relative z-10 mx-auto -mt-8 max-w-[1320px] px-5 sm:px-8">
      <div className="stats-rail">
        {stats.map(([Icon, value, label]) => (
          <article key={label} className="stat-item">
            <Icon className="size-4 text-[#9f8cff]" />
            <div><p className="marketing-display text-xl font-semibold tracking-[-0.03em]">{value}</p><p className="mt-0.5 text-[10px] uppercase tracking-[0.13em] text-[#737b9b]">{label}</p></div>
          </article>
        ))}
      </div>
    </section>
  );
}
