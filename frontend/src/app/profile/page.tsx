"use client";

import React, { useState, useEffect } from "react";
import {
  useAccount,
  useBalance,
  useReadContracts,
} from "wagmi";
import { erc20Abi, formatUnits, parseAbi } from "viem";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import {
  Wallet,
  ShieldCheck,
  Layers,
  PieChart as PieChartIcon,
  Activity,
  ArrowUpFromLine,
  ArrowDownToLine,
  Loader2,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { backendApi, BackendApiError, type Profile } from "@/lib/backendApi";

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC as `0x${string}`;
const EURC_ADDRESS = process.env.NEXT_PUBLIC_EURC as `0x${string}`;
const CIRBTC_ADDRESS = process.env.NEXT_PUBLIC_CIRBTC as `0x${string}`;
const POOL_ADDRESS = process.env.NEXT_PUBLIC_LENDING_POOL as `0x${string}`;

const LENDING_POOL_ABI = parseAbi([
  "function getSupplyBalance(address user, address asset) view returns (uint256)",
  "function getBorrowBalance(address user, address asset) view returns (uint256)",
]);

const COLORS = ["#2775CA", "#1C3A66", "#F7931A"]; // USDC, EURC, cirBTC
const BORROW_COLORS = ["#7EE2B7", "#9D00FF", "#FF5500"]; // USDC, EURC, cirBTC

type HistoryEvent = {
  id: string;
  type: string;
  asset: string;
  amount: string;
  status: string;
  time: string;
  icon: any;
  color: string;
  blockNumber: number;
  transactionHash: string;
};

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Native Token Balance (USDC for Arc Testnet)
  const { data: ethBalance } = useBalance({ address, chainId: 5042002 });

  // Fetch ERC20 Balances & Lending Positions
  const { data: contractData } = useReadContracts({
    contracts: [
      // Wallet Balances
      {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        chainId: 5042002,
      },
      {
        address: EURC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        chainId: 5042002,
      },
      {
        address: CIRBTC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        chainId: 5042002,
      },
      // Supply Balances
      {
        address: POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: "getSupplyBalance",
        args: address ? [address, USDC_ADDRESS] : undefined,
        chainId: 5042002,
      },
      {
        address: POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: "getSupplyBalance",
        args: address ? [address, EURC_ADDRESS] : undefined,
        chainId: 5042002,
      },
      {
        address: POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: "getSupplyBalance",
        args: address ? [address, CIRBTC_ADDRESS] : undefined,
        chainId: 5042002,
      },
      // Borrow Balances
      {
        address: POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: "getBorrowBalance",
        args: address ? [address, USDC_ADDRESS] : undefined,
        chainId: 5042002,
      },
      {
        address: POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: "getBorrowBalance",
        args: address ? [address, EURC_ADDRESS] : undefined,
        chainId: 5042002,
      },
      {
        address: POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: "getBorrowBalance",
        args: address ? [address, CIRBTC_ADDRESS] : undefined,
        chainId: 5042002,
      },
    ],
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (!address) return;
    let active = true;
    backendApi.profile(address)
      .catch(async (error) => {
        if (error instanceof BackendApiError && error.status === 404) {
          return backendApi.updateProfile(address, {});
        }
        throw error;
      })
      .then(({ profile: nextProfile }) => { if (active) setProfile(nextProfile); })
      .catch((error) => console.error("Failed to load profile:", error));
    return () => { active = false; };
  }, [address]);

  // Indexed history comes from the Railway API instead of scanning millions of RPC blocks.
  useEffect(() => {
    if (!address) return;

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const formatAsset = (addr: string) => {
          if (addr.toLowerCase() === USDC_ADDRESS.toLowerCase())
            return { name: "USDC", dec: 6 };
          if (addr.toLowerCase() === EURC_ADDRESS.toLowerCase())
            return { name: "EURC", dec: 6 };
          if (addr.toLowerCase() === CIRBTC_ADDRESS.toLowerCase())
            return { name: "cirBTC", dec: 8 };
          return { name: "Unknown", dec: 18 };
        };

        const actionMeta: Record<string, { label: string; icon: typeof ArrowUpFromLine; color: string }> = {
          supply: { label: "Supply", icon: ArrowUpFromLine, color: "text-[#A998FF]" },
          withdraw: { label: "Withdraw", icon: ArrowDownToLine, color: "text-[#7EE2B7]" },
          deposit_collateral: { label: "Deposit collateral", icon: ArrowUpFromLine, color: "text-[#A998FF]" },
          withdraw_collateral: { label: "Withdraw collateral", icon: ArrowDownToLine, color: "text-[#7EE2B7]" },
          borrow: { label: "Borrow", icon: ArrowDownToLine, color: "text-[#F7931A]" },
          repay: { label: "Repay", icon: ArrowUpFromLine, color: "text-[#7EE2B7]" },
          liquidate: { label: "Liquidation", icon: ArrowDownToLine, color: "text-red-400" },
          swap: { label: "Swap", icon: ArrowDownToLine, color: "text-[#A998FF]" },
          add_liquidity: { label: "Add liquidity", icon: ArrowUpFromLine, color: "text-[#7EE2B7]" },
          remove_liquidity: { label: "Remove liquidity", icon: ArrowDownToLine, color: "text-[#F7931A]" },
          bridge: { label: "Bridge", icon: ArrowUpFromLine, color: "text-[#A998FF]" },
        };
        const { items } = await backendApi.transactions(address, 50);
        setHistory(items.map((transaction) => {
          const tokenAddress = transaction.token_in || transaction.token_out || "";
          const assetInfo = formatAsset(tokenAddress);
          const rawAmount = transaction.amount_in || transaction.amount_out || "0";
          const decimals = transaction.amount_in !== null
            ? transaction.amount_in_decimals ?? assetInfo.dec
            : transaction.amount_out_decimals ?? assetInfo.dec;
          const meta = actionMeta[transaction.action] ?? { label: transaction.action, icon: Activity, color: "text-[#8991AF]" };
          return {
            id: `${transaction.transaction_hash}-${transaction.log_index}`,
            transactionHash: transaction.transaction_hash,
            type: meta.label,
            asset: assetInfo.name,
            amount: Number(formatUnits(BigInt(rawAmount), decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 }),
            status: transaction.status === "confirmed" ? "Completed" : transaction.status,
            time: new Date(transaction.block_timestamp).toLocaleString(),
            icon: meta.icon,
            color: meta.color,
            blockNumber: Number(transaction.block_number),
          };
        }));
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    void fetchHistory();
  }, [address]);

  if (!mounted) return null;

  if (!isConnected) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          <Wallet className="w-16 h-16 text-[#8991AF] mb-4 opacity-50" />
          <h2 className="text-2xl font-bold text-white mb-2">
            Wallet Not Connected
          </h2>
          <p className="text-[#8991AF]">
            Please connect your wallet to view your profile.
          </p>
        </div>
      </PageLayout>
    );
  }

  // Wallet Balances
  const usdcBal =
    contractData?.[0]?.result !== undefined
      ? Number(formatUnits(contractData[0].result as bigint, 6))
      : 0;
  const eurcBal =
    contractData?.[1]?.result !== undefined
      ? Number(formatUnits(contractData[1].result as bigint, 6))
      : 0;
  const cirBtcBal =
    contractData?.[2]?.result !== undefined
      ? Number(formatUnits(contractData[2].result as bigint, 8))
      : 0;
  const nativeBal = ethBalance
    ? Number(ethBalance.formatted).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })
    : "0.0000";

  // Lending Positions (Calculate Approx USD Value: USDC=1, EURC=1.08, cirBTC=65000)
  const usdcSupply =
    contractData?.[3]?.result !== undefined
      ? Number(formatUnits(contractData[3].result as bigint, 6))
      : 0;
  const eurcSupply =
    contractData?.[4]?.result !== undefined
      ? Number(formatUnits(contractData[4].result as bigint, 6))
      : 0;
  const cirBtcSupply =
    contractData?.[5]?.result !== undefined
      ? Number(formatUnits(contractData[5].result as bigint, 8))
      : 0;

  const usdcBorrow =
    contractData?.[6]?.result !== undefined
      ? Number(formatUnits(contractData[6].result as bigint, 6))
      : 0;
  const eurcBorrow =
    contractData?.[7]?.result !== undefined
      ? Number(formatUnits(contractData[7].result as bigint, 6))
      : 0;
  const cirBtcBorrow =
    contractData?.[8]?.result !== undefined
      ? Number(formatUnits(contractData[8].result as bigint, 8))
      : 0;

  const supplyData = [
    { name: "USDC", value: usdcSupply * 1 },
    { name: "EURC", value: eurcSupply * 1.08 },
    { name: "cirBTC", value: cirBtcSupply * 65000 },
  ].filter((d) => d.value > 0);

  const borrowData = [
    { name: "USDC", value: usdcBorrow * 1 },
    { name: "EURC", value: eurcBorrow * 1.08 },
    { name: "cirBTC", value: cirBtcBorrow * 65000 },
  ].filter((d) => d.value > 0);

  const totalSupplyUSD = supplyData.reduce((acc, curr) => acc + curr.value, 0);
  const totalBorrowUSD = borrowData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <PageLayout>
      <main className="app-page max-w-7xl mx-auto px-4 py-10 space-y-8">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="app-page-title text-4xl text-white flex items-center gap-3">
              <div className="p-2 bg-[#A998FF]/10 rounded-xl">
                <Wallet className="w-6 h-6 text-[#A998FF]" />
              </div>
              {profile?.display_name || "Your Profile"}
            </h1>
            <p className="text-[#8991AF] mt-2 font-mono text-sm bg-white/5 px-3 py-1.5 rounded-lg inline-block border border-white/5">
              {address}
            </p>
          </div>
          <div className="glass-panel rounded-2xl p-4 min-w-[200px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#A998FF]/10 rounded-full">
                <ShieldCheck className="w-6 h-6 text-[#A998FF]" />
              </div>
              <div>
                <div className="text-xs text-[#8991AF] font-medium uppercase tracking-wider">
                  Health Factor
                </div>
                <div className="text-2xl font-bold text-white">Safe</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Balances */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-4 space-y-6"
          >
            <h2 className="text-xl font-medium text-white flex items-center gap-3">
              <Layers className="w-5 h-5 text-[#A998FF]" />
              Your Assets
            </h2>

            <div className="flex flex-col gap-4">
              {/* USDC */}
              <div className="relative group overflow-hidden rounded-2xl bg-gradient-to-b from-white/5 to-transparent p-[1px]">
                <div className="absolute inset-0 bg-gradient-to-r from-[#A998FF]/0 via-[#A998FF]/10 to-[#A998FF]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="bg-[#070812]/90 backdrop-blur-xl rounded-2xl p-5 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-full bg-[#2775CA]/10 border border-[#2775CA]/20 flex items-center justify-center p-2 shadow-[0_0_15px_rgba(39,117,202,0.2)]">
                      <img
                        src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png"
                        alt="USDC"
                        width={28}
                        height={28}
                      />
                    </div>
                    <div>
                      <div className="font-bold text-white text-lg tracking-wide">
                        USDC
                      </div>
                      <div className="text-sm text-[#8991AF]">
                        USD Coin / Gas
                      </div>
                    </div>
                  </div>
                  <div className="text-right relative z-10">
                    <div className="font-bold text-white text-xl">
                      {usdcBal.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-xs text-[#A998FF] mt-1 tracking-wider">
                      NATIVE
                    </div>
                  </div>
                </div>
              </div>

              {/* EURC */}
              <div className="relative group overflow-hidden rounded-2xl bg-gradient-to-b from-white/5 to-transparent p-[1px]">
                <div className="bg-[#070812]/90 backdrop-blur-xl rounded-2xl p-5 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-full bg-[#1C3A66]/10 border border-[#1C3A66]/20 flex items-center justify-center p-2 shadow-[0_0_15px_rgba(28,58,102,0.2)]">
                      <img
                        src="https://s2.coinmarketcap.com/static/img/coins/64x64/20641.png"
                        alt="EURC"
                        width={28}
                        height={28}
                      />
                    </div>
                    <div>
                      <div className="font-bold text-white text-lg tracking-wide">
                        EURC
                      </div>
                      <div className="text-sm text-[#8991AF]">Euro Coin</div>
                    </div>
                  </div>
                  <div className="text-right relative z-10">
                    <div className="font-bold text-white text-xl">
                      {eurcBal.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* cirBTC */}
              <div className="relative group overflow-hidden rounded-2xl bg-gradient-to-b from-white/5 to-transparent p-[1px]">
                <div className="bg-[#070812]/90 backdrop-blur-xl rounded-2xl p-5 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-full bg-[#F7931A]/10 border border-[#F7931A]/20 flex items-center justify-center p-2 shadow-[0_0_15px_rgba(247,147,26,0.2)]">
                      <img
                        src="https://cryptologos.cc/logos/bitcoin-btc-logo.png"
                        alt="cirBTC"
                        width={28}
                        height={28}
                      />
                    </div>
                    <div>
                      <div className="font-bold text-white text-lg tracking-wide">
                        cirBTC
                      </div>
                      <div className="text-sm text-[#8991AF]">Circle BTC</div>
                    </div>
                  </div>
                  <div className="text-right relative z-10">
                    <div className="font-bold text-white text-xl">
                      {cirBtcBal.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Lending Portfolio & History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-8 space-y-8"
          >
            <h2 className="text-xl font-medium text-white flex items-center gap-3">
              <PieChartIcon className="w-5 h-5 text-[#A998FF]" />
              Lending Portfolio
            </h2>

            <div className="relative group overflow-hidden rounded-3xl bg-gradient-to-b from-white/5 to-transparent p-[1px]">
              <div className="bg-[#070812]/90 backdrop-blur-xl rounded-3xl p-8 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 divide-y md:divide-y-0 md:divide-x divide-white/10">
                  {/* Supply Side */}
                  <div className="pt-4 md:pt-0">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs font-bold text-[#8991AF] uppercase tracking-wider">
                        Total Supplied
                      </h3>
                    </div>
                    <div className="h-[220px] w-full mt-4">
                      {supplyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={supplyData}
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={85}
                              paddingAngle={8}
                              dataKey="value"
                              stroke="none"
                              cornerRadius={4}
                            >
                              {supplyData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: "rgba(15, 20, 25, 0.9)",
                                backdropFilter: "blur(10px)",
                                borderColor: "rgba(255,255,255,0.1)",
                                borderRadius: "12px",
                                color: "#fff",
                                fontSize: "13px",
                              }}
                              itemStyle={{
                                color: "#A998FF",
                                fontWeight: "bold",
                              }}
                              formatter={(value: any) => [
                                `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                                "Value",
                              ]}
                            />
                            <Legend
                              verticalAlign="bottom"
                              height={24}
                              iconType="circle"
                              wrapperStyle={{
                                fontSize: "13px",
                                paddingTop: "20px",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-[#8991AF]">
                          <PieChartIcon className="w-10 h-10 mb-3 opacity-20" />
                          <p className="text-sm">No Supplied Assets</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Borrow Side */}
                  <div className="pt-8 md:pt-0 md:pl-8">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs font-bold text-[#8991AF] uppercase tracking-wider">
                        Total Borrowed
                      </h3>
                    </div>
                    <div className="h-[220px] w-full mt-4">
                      {borrowData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={borrowData}
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={85}
                              paddingAngle={8}
                              dataKey="value"
                              stroke="none"
                              cornerRadius={4}
                            >
                              {borrowData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={
                                    BORROW_COLORS[index % BORROW_COLORS.length]
                                  }
                                />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: "rgba(15, 20, 25, 0.9)",
                                backdropFilter: "blur(10px)",
                                borderColor: "rgba(255,255,255,0.1)",
                                borderRadius: "12px",
                                color: "#fff",
                                fontSize: "13px",
                              }}
                              itemStyle={{
                                color: "#7EE2B7",
                                fontWeight: "bold",
                              }}
                              formatter={(value: any) => [
                                `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                                "Value",
                              ]}
                            />
                            <Legend
                              verticalAlign="bottom"
                              height={24}
                              iconType="circle"
                              wrapperStyle={{
                                fontSize: "13px",
                                paddingTop: "20px",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-[#8991AF]">
                          <PieChartIcon className="w-10 h-10 mb-3 opacity-20" />
                          <p className="text-sm">No Borrowed Assets</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Activity (Full Width) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <h2 className="text-xl font-medium text-white flex items-center gap-3 pt-4">
            <Activity className="w-5 h-5 text-[#A998FF]" />
            Recent Activity
          </h2>
          <div className="relative group overflow-hidden rounded-3xl bg-gradient-to-b from-white/5 to-transparent p-[1px]">
            <div className="bg-[#070812]/90 backdrop-blur-xl rounded-3xl min-h-[200px] overflow-hidden">
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center p-16 text-[#8991AF]">
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#A998FF]" />
                  <p className="text-sm tracking-wide">
                    Scanning blockchain records...
                  </p>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-[#8991AF] group-hover:text-white/70 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Activity className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="text-sm tracking-wide">
                    No recent on-chain activity found.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-[350px] overflow-y-auto custom-scrollbar">
                  {history.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-5 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/5 ${tx.color}`}
                        >
                          <tx.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-white tracking-wide">
                            {tx.type} {tx.asset}
                          </div>
                          <div className="text-xs text-[#8991AF] mt-1">
                            {tx.time}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-white text-lg tracking-wide">
                          {tx.amount}
                        </div>
                        <a
                          href={`https://testnet.arcscan.app/tx/${tx.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#A998FF] mt-1 font-medium hover:underline flex items-center justify-end gap-1"
                        >
                          {tx.status} ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </PageLayout>
  );
}
