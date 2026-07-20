"use client";

import React, { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { formatUnits, parseAbi, type Address } from "viem";
import { Activity, AlertTriangle, BarChart3, RefreshCw, TrendingUp, Users } from "lucide-react";
import { MetricCard } from "../../components/analytics/MetricCard";
import { VolumeChart, type ChartDataPoint } from "../../components/analytics/VolumeChart";
import { LENDING_CONTRACTS } from "../../lib/contracts";
import PageLayout from "../../components/PageLayout";

const POOL_ABI = parseAbi([
  "function getSupportedAssets() external view returns (address[])",
  "function assetStates(address) external view returns (uint256 totalBorrowed, uint256 totalReserves, uint256 borrowIndex, uint256 lastAccruedTime, uint256 totalShares)",
  "function exchangeRate(address asset) external view returns (uint256)",
]);

const ORACLE_ABI = parseAbi([
  "function getAssetPrice(address asset) external view returns (uint256)",
]);

type AnalyticsPayload = {
  metrics: { totalBorrowedUSD: number; totalSupplyUSD: number; assetsCount: number };
  chartData: ChartDataPoint[];
};

const EMPTY_METRICS = { totalBorrowedUSD: 0, totalSupplyUSD: 0, assetsCount: 0 };
const CACHE_TTL_MS = 30_000;
let cachedAnalytics: { payload: AnalyticsPayload; expiresAt: number } | null = null;
let analyticsInFlight: Promise<AnalyticsPayload> | null = null;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /request limit|rate limit|too many requests|429|rpc request failed/i.test(message);
}

async function withRpcRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === 3) throw error;
      await wait(700 * 2 ** attempt + Math.floor(Math.random() * 180));
    }
  }
  throw lastError;
}

function symbolFor(asset: Address) {
  const address = asset.toLowerCase();
  if (address === LENDING_CONTRACTS.USDC.toLowerCase()) return "USDC";
  if (address === LENDING_CONTRACTS.EURC.toLowerCase()) return "EURC";
  if (address === LENDING_CONTRACTS.CIRBTC.toLowerCase()) return "cirBTC";
  return "Unknown";
}

export default function AnalyticsDashboard() {
  const publicClient = usePublicClient();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    if (!publicClient || !LENDING_CONTRACTS.LENDING_POOL) {
      const timer = window.setTimeout(() => {
        setError("Analytics is not configured for this environment.");
        setIsLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let active = true;
    const fetchAnalytics = async (): Promise<AnalyticsPayload> => {
      if (cachedAnalytics && cachedAnalytics.expiresAt > Date.now()) return cachedAnalytics.payload;
      if (analyticsInFlight) return analyticsInFlight;

      analyticsInFlight = (async () => {
        const assets = await withRpcRetry(() => publicClient.readContract({
          address: LENDING_CONTRACTS.LENDING_POOL,
          abi: POOL_ABI,
          functionName: "getSupportedAssets",
        }));

        let totalBorrowedUSD = 0;
        let totalSupplyUSD = 0;
        const nextChartData: ChartDataPoint[] = [];

        // Arc's public RPC throttles bursts. Only request values used by this page,
        // and serialize calls so opening Analytics cannot create an RPC spike.
        for (const asset of assets) {
          const assetState = await withRpcRetry(() => publicClient.readContract({
            address: LENDING_CONTRACTS.LENDING_POOL,
            abi: POOL_ABI,
            functionName: "assetStates",
            args: [asset],
          }));
          await wait(120);

          const exchangeRate = await withRpcRetry(() => publicClient.readContract({
            address: LENDING_CONTRACTS.LENDING_POOL,
            abi: POOL_ABI,
            functionName: "exchangeRate",
            args: [asset],
          }));
          await wait(120);

          const price8 = await withRpcRetry(() => publicClient.readContract({
            address: LENDING_CONTRACTS.ORACLE,
            abi: ORACLE_ABI,
            functionName: "getAssetPrice",
            args: [asset],
          })).catch(() => 0n);

          const totalBorrowed = assetState[0];
          const totalShares = assetState[4];
          const totalSuppliedAsset = (totalShares * exchangeRate) / 10n ** 18n;
          const decimals = asset.toLowerCase() === LENDING_CONTRACTS.CIRBTC.toLowerCase() ? 8 : 6;
          const price = Number(formatUnits(price8, 8));
          const borrowedValue = Number(formatUnits(totalBorrowed, decimals)) * price;
          const suppliedValue = Number(formatUnits(totalSuppliedAsset, decimals)) * price;

          totalBorrowedUSD += borrowedValue;
          totalSupplyUSD += suppliedValue;
          nextChartData.push({ name: symbolFor(asset), Supply: suppliedValue, Borrow: borrowedValue });
          await wait(120);
        }

        const payload = {
          metrics: { totalBorrowedUSD, totalSupplyUSD, assetsCount: assets.length },
          chartData: nextChartData,
        };
        cachedAnalytics = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
        return payload;
      })().finally(() => { analyticsInFlight = null; });

      return analyticsInFlight;
    };

    void fetchAnalytics()
      .then((payload) => {
        if (!active) return;
        setMetrics(payload.metrics);
        setChartData(payload.chartData);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        setError(isRateLimitError(fetchError)
          ? "Arc Testnet RPC is busy. Vitael paused requests to avoid exceeding the public limit."
          : "Analytics data is temporarily unavailable.");
      })
      .finally(() => { if (active) setIsLoading(false); });

    return () => { active = false; };
  }, [publicClient, refreshKey]);

  function retry() {
    cachedAnalytics = null;
    setError(null);
    setIsLoading(true);
    setRefreshKey((key) => key + 1);
  }

  return (
    <PageLayout variant="app">
      <main className="app-page p-5 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div><span className="app-eyebrow mb-3">Arc Testnet · Live protocol data</span><h1 className="app-page-title text-4xl text-white sm:text-5xl">Protocol Analytics</h1><p className="mt-3 text-sm text-[#8991AF]">Real-time lending liquidity and market distribution.</p></div>

          {error && <div className="flex flex-col gap-4 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-4 sm:flex-row sm:items-center"><AlertTriangle className="size-5 shrink-0 text-amber-300" /><p className="flex-1 text-sm text-amber-100/80">{error}</p><button onClick={retry} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/15 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/10"><RefreshCw className="size-3.5" />Try again</button></div>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Total Value Supplied" value={`$${metrics.totalSupplyUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={TrendingUp} isLoading={isLoading} description="Total USD value of all supplied assets" />
            <MetricCard title="Total Borrowed" value={`$${metrics.totalBorrowedUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={Activity} isLoading={isLoading} description="Total USD value currently borrowed" />
            <MetricCard title="Supported Assets" value={metrics.assetsCount.toString()} icon={BarChart3} isLoading={isLoading} description="Assets available in the pool" />
            <MetricCard title="Active Markets" value="3" icon={Users} isLoading={isLoading} description="USDC, EURC and cirBTC" />
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
