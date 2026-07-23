"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, BarChart3, RefreshCw, TrendingUp, Users } from "lucide-react";
import { MetricCard } from "../../components/analytics/MetricCard";
import { VolumeChart, type ChartDataPoint } from "../../components/analytics/VolumeChart";
import PageLayout from "../../components/PageLayout";
import { backendApi } from "../../lib/backendApi";

type Metrics = {
  tvl: number;
  totalBorrowed: number;
  totalSupplied: number;
  swapVolume: number;
  assetsCount: number;
};

const EMPTY_METRICS: Metrics = { tvl: 0, totalBorrowed: 0, totalSupplied: 0, swapVolume: 0, assetsCount: 0 };
const TOKEN_DECIMALS: Record<string, number> = { USDC: 6, EURC: 6, cirBTC: 8 };

export default function AnalyticsDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { stats } = await backendApi.protocolStats();
      if (!stats) throw new Error("Indexer has not published a protocol snapshot yet.");
      const lending = stats.markets?.lending ?? {};
      const distribution = Object.entries(lending).map(([symbol, market]) => {
        const decimals = TOKEN_DECIMALS[symbol] ?? 18;
        const scale = 10 ** decimals;
        const price = Number(market.price8) / 1e8;
        return {
          name: symbol,
          Supply: Number(market.supplied) / scale * price,
          Borrow: Number(market.borrowed) / scale * price,
        };
      });
      setMetrics({
        tvl: Number(stats.tvl_usd),
        totalBorrowed: Number(stats.total_borrowed_usd),
        totalSupplied: Number(stats.total_supplied_usd),
        swapVolume: Number(stats.swap_volume_usd),
        assetsCount: distribution.length,
      });
      setChartData(distribution);
      setCapturedAt(stats.captured_at);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Analytics data is temporarily unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(load, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [load]);

  return (
    <PageLayout variant="app">
      <main className="app-page p-5 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div>
            <span className="app-eyebrow mb-3">Indexer verified · Arc Testnet</span>
            <h1 className="app-page-title text-4xl text-white sm:text-5xl">Protocol Analytics</h1>
            <p className="mt-3 text-sm text-[#8991AF]">
              Lending and DEX data aggregated from confirmed on-chain events.
              {capturedAt && ` Updated ${new Date(capturedAt).toLocaleString()}.`}
            </p>
          </div>

          {error && <div className="flex flex-col gap-4 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-4 sm:flex-row sm:items-center"><AlertTriangle className="size-5 shrink-0 text-amber-300" /><p className="flex-1 text-sm text-amber-100/80">{error}</p><button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/15 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/10"><RefreshCw className="size-3.5" />Try again</button></div>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Total Value Locked" value={`$${metrics.tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={TrendingUp} isLoading={isLoading} description="Lending assets plus DEX reserves" />
            <MetricCard title="Total Supplied" value={`$${metrics.totalSupplied.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={Activity} isLoading={isLoading} description="Current lender positions" />
            <MetricCard title="Total Borrowed" value={`$${metrics.totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={BarChart3} isLoading={isLoading} description="Outstanding protocol debt" />
            <MetricCard title="24h Swap Volume" value={`$${metrics.swapVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={Users} isLoading={isLoading} description={`${metrics.assetsCount} indexed lending markets`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-[400px]"><VolumeChart title="Supply & Borrow Distribution (USD)" data={chartData} type="bar" keys={[{ key: "Supply", name: "Total Supplied", color: "#A998FF" }, { key: "Borrow", name: "Total Borrowed", color: "#7EE2B7" }]} /></div>
            <div className="h-[400px]"><VolumeChart title="Market Dominance" data={chartData} type="area" keys={[{ key: "Supply", name: "Supplied Liquidity", color: "#8F7CFF" }]} /></div>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
