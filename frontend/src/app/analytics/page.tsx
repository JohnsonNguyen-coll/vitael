"use client";

import React, { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { formatUnits, parseAbi, parseAbiItem } from "viem";
import { Activity, BarChart3, TrendingUp, Users } from "lucide-react";
import { MetricCard } from "../../components/analytics/MetricCard";
import { VolumeChart, ChartDataPoint } from "../../components/analytics/VolumeChart";
import { LENDING_CONTRACTS } from "../../lib/contracts";
import PageLayout from "../../components/PageLayout";

const POOL_ABI = parseAbi([
  "function getSupportedAssets() external view returns (address[])",
  "function getUtilization(address asset) external view returns (uint256)",
  "function getBorrowRate(address asset) external view returns (uint256)",
  "function getSupplyRate(address asset) external view returns (uint256)",
  "function assetStates(address) external view returns (uint256 totalBorrowed, uint256 totalReserves, uint256 borrowIndex, uint256 lastAccruedTime, uint256 totalShares)",
  "function exchangeRate(address asset) external view returns (uint256)",
]);

const ORACLE_ABI = parseAbi([
  "function getAssetPrice(address asset) external view returns (uint256)",
]);



export default function AnalyticsDashboard() {
  const publicClient = usePublicClient();
  const [isLoading, setIsLoading] = useState(true);
  
  const [metrics, setMetrics] = useState({
    totalBorrowedUSD: 0,
    totalSupplyUSD: 0,
    assetsCount: 0,
  });

  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!publicClient || !LENDING_CONTRACTS.LENDING_POOL) return;

      try {
        setIsLoading(true);
        // 1. Get supported assets
        const assets = await publicClient.readContract({
          address: LENDING_CONTRACTS.LENDING_POOL,
          abi: POOL_ABI,
          functionName: "getSupportedAssets",
        });

        let totalBorrowedUSD = 0;
        let totalSupplyUSD = 0;
        const newChartData: ChartDataPoint[] = [];

        for (const asset of assets) {
          // Read stats
          const [
            utilization,
            borrowRate,
            supplyRate,
            assetState,
            exchangeRate,
            price8
          ] = await Promise.all([
            publicClient.readContract({ address: LENDING_CONTRACTS.LENDING_POOL, abi: POOL_ABI, functionName: "getUtilization", args: [asset] }),
            publicClient.readContract({ address: LENDING_CONTRACTS.LENDING_POOL, abi: POOL_ABI, functionName: "getBorrowRate", args: [asset] }),
            publicClient.readContract({ address: LENDING_CONTRACTS.LENDING_POOL, abi: POOL_ABI, functionName: "getSupplyRate", args: [asset] }),
            publicClient.readContract({ address: LENDING_CONTRACTS.LENDING_POOL, abi: POOL_ABI, functionName: "assetStates", args: [asset] }),
            publicClient.readContract({ address: LENDING_CONTRACTS.LENDING_POOL, abi: POOL_ABI, functionName: "exchangeRate", args: [asset] }),
            publicClient.readContract({ address: LENDING_CONTRACTS.ORACLE, abi: ORACLE_ABI, functionName: "getAssetPrice", args: [asset] }).catch(() => 0n),
          ]);

          const totalBorrowed = assetState[0];
          const totalShares = assetState[4];
          const totalSuppliedAsset = (totalShares * exchangeRate) / 10n**18n;

          // Determine decimals (simplified: assume 6 for USDC/EURC, 8 for BTC based on token address if known, else assume 6 as default)
          const decimals = asset.toLowerCase() === LENDING_CONTRACTS.CIRBTC.toLowerCase() ? 8 : 6;
          
          const price = Number(formatUnits(price8 as bigint, 8));
          const borrowedAmount = Number(formatUnits(totalBorrowed, decimals));
          const suppliedAmount = Number(formatUnits(totalSuppliedAsset, decimals));

          const borrowedValue = borrowedAmount * price;
          const suppliedValue = suppliedAmount * price;

          totalBorrowedUSD += borrowedValue;
          totalSupplyUSD += suppliedValue;

          // Symbol mapping
          let symbol = "Unknown";
          if (asset.toLowerCase() === LENDING_CONTRACTS.USDC.toLowerCase()) symbol = "USDC";
          else if (asset.toLowerCase() === LENDING_CONTRACTS.EURC.toLowerCase()) symbol = "EURC";
          else if (asset.toLowerCase() === LENDING_CONTRACTS.CIRBTC.toLowerCase()) symbol = "cirBTC";

          newChartData.push({
            name: symbol,
            Supply: suppliedValue,
            Borrow: borrowedValue,
          });
        }

        setMetrics({
          totalBorrowedUSD,
          totalSupplyUSD,
          assetsCount: assets.length,
        });
        setChartData(newChartData);
      } catch (err) {
        console.error("Error fetching analytics data", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [publicClient]);

  return (
    <PageLayout variant="app">
      <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Protocol Analytics</h1>
          <p className="text-[#A0AEC0]">Real-time on-chain data for Vitael Lending Pool.</p>
        </div>

        {/* Top Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Value Supplied"
            value={`$${metrics.totalSupplyUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={TrendingUp}
            isLoading={isLoading}
            description="Total USD value of all supplied assets"
          />
          <MetricCard
            title="Total Borrowed"
            value={`$${metrics.totalBorrowedUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={Activity}
            isLoading={isLoading}
            description="Total USD value currently borrowed"
          />
          <MetricCard
            title="Supported Assets"
            value={metrics.assetsCount.toString()}
            icon={BarChart3}
            isLoading={isLoading}
            description="Number of assets available in pool"
          />
          <MetricCard
            title="Active Markets"
            value="3"
            icon={Users}
            isLoading={isLoading}
            description="USDC, EURC, cirBTC"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div className="h-[400px]">
            <VolumeChart
              title="Supply & Borrow Distribution (USD)"
              data={chartData}
              type="bar"
              keys={[
                { key: "Supply", name: "Total Supplied", color: "#3B82F6" },
                { key: "Borrow", name: "Total Borrowed", color: "#F59E0B" },
              ]}
            />
          </div>
          <div className="h-[400px]">
            <VolumeChart
              title="Market Dominance"
              data={chartData}
              type="area"
              keys={[
                { key: "Supply", name: "Supplied Liquidity", color: "#10B981" },
              ]}
            />
          </div>
        </div>
      </div>
      </div>
    </PageLayout>
  );
}
