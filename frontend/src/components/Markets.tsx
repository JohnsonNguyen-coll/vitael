"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import TokenIcon from "./TokenIcon";
import { useLending, COLLATERAL_TOKENS } from "../hooks/useLending";

function fmtUsdCompact(value: string): string {
  const n = parseFloat(value);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function Markets() {
  const { getProtocolStats } = useLending();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getProtocolStats>>>(null);

  const load = useCallback(async () => {
    setStats(await getProtocolStats());
  }, [getProtocolStats]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const markets = [
    {
      name: "USDC",
      sub: "Gas Native",
      supplied: stats ? fmtUsdCompact(stats.totalSuppliedUsdc) : "—",
      supplyAPY: stats ? `${stats.supplyApyPct.toFixed(2)}%` : "—",
      borrowed: stats ? fmtUsdCompact(stats.totalBorrowedUsdc) : "—",
      borrowAPY: stats ? `${stats.borrowApyPct.toFixed(2)}%` : "—",
      href: "/lend",
    },
    {
      name: "WETH",
      sub: "Collateral Token",
      supplied: "—",
      supplyAPY: "—",
      borrowed: "—",
      borrowAPY: "—",
      href: "/borrow",
      ltv: `${COLLATERAL_TOKENS.WETH.ltv}%`,
    },
    {
      name: "WBTC",
      sub: "Collateral Token",
      supplied: "—",
      supplyAPY: "—",
      borrowed: "—",
      borrowAPY: "—",
      href: "/borrow",
      ltv: `${COLLATERAL_TOKENS.WBTC.ltv}%`,
    },
  ];

  const totalLiquidity = stats
    ? fmtUsdCompact(stats.poolUsdcLiquidity)
    : "—";

  return (
    <section id="markets" className="py-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-3 block">Markets</span>
          <h2 className="text-4xl font-extrabold font-display text-white">Active Borrowing Hubs</h2>
        </div>
        <div className="mt-4 md:mt-0 text-sm text-[#8E9FB8]">
          Pool liquidity: <span className="text-white font-semibold">{totalLiquidity}</span>
        </div>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-[#8E9FB8]">
                <th className="py-5 px-6 font-semibold">Asset</th>
                <th className="py-5 px-6 font-semibold">Total Supplied</th>
                <th className="py-5 px-6 font-semibold text-[#00F5FF]">Supply APY</th>
                <th className="py-5 px-6 font-semibold">Total Borrowed</th>
                <th className="py-5 px-6 font-semibold text-[#FF00C8]">Borrow APY</th>
                <th className="py-5 px-6 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m, i) => (
                <motion.tr
                  key={m.name}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="border-b border-white/5 hover:bg-white/2 transition duration-200"
                >
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <TokenIcon symbol={m.name} size={36} />
                      <div>
                        <div className="font-bold text-white text-base">{m.name}</div>
                        <div className="text-xs text-[#8E9FB8]">
                          {m.sub}
                          {"ltv" in m && m.ltv ? ` · LTV ${m.ltv}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6 text-sm text-white font-medium">{m.supplied}</td>
                  <td className="py-5 px-6 text-sm text-[#00F5FF] font-bold">{m.supplyAPY}</td>
                  <td className="py-5 px-6 text-sm text-white font-medium">{m.borrowed}</td>
                  <td className="py-5 px-6 text-sm text-[#FF00C8] font-bold">{m.borrowAPY}</td>
                  <td className="py-5 px-6 text-right">
                    <Link
                      href={m.href}
                      className="px-5 py-2 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-[#00F5FF] text-sm font-semibold hover:bg-[#00F5FF] hover:text-[#0A1428] transition duration-300"
                    >
                      Transact
                    </Link>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
