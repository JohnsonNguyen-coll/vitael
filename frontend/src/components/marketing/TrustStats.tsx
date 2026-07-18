import { Activity, CircleDollarSign, LockKeyhole, Radio } from "lucide-react";

const stats = [
  [CircleDollarSign, "$48.2M", "Liquidity routed"],
  [Activity, "6.84%", "Best supply APY"],
  [LockKeyhole, "100%", "Non-custodial"],
  [Radio, "24/7", "Oracle monitoring"],
] as const;

export default function TrustStats() {
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
