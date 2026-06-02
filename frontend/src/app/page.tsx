"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import PageLayout from "../components/PageLayout";
import TokenIcon from "../components/TokenIcon";
import {
  ArrowRight, Zap, Shield, TrendingUp, Repeat2,
  GitBranch, ExternalLink, ChevronRight,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────
const STATS = [
  { label: "Supported Assets",   value: "3",       sub: "USDC · EURC · cirBTC" },
  { label: "Oracle",             value: "Stork",   sub: "Real-time prices" },
  { label: "Max LTV",            value: "90%",     sub: "USDC collateral" },
  { label: "Network",            value: "Arc",     sub: "Testnet live" },
];

const FEATURES = [
  {
    icon: TrendingUp,
    color: "#00F5FF",
    title: "Multi-Asset Lending",
    desc: "Supply USDC, EURC, or cirBTC to earn yield. Your balance compounds automatically via a share-based accounting system — no manual claiming.",
  },
  {
    icon: Shield,
    color: "#8B00FF",
    title: "Over-Collateralized Borrowing",
    desc: "Borrow any supported asset against your collateral. Health factor is monitored in real time using Stork oracle prices on Arc Testnet.",
  },
  {
    icon: Zap,
    color: "#FF00C8",
    title: "Kinked Interest Rate Model",
    desc: "Rates adjust dynamically based on pool utilization. Below 80% optimal: low rates. Above 80%: rates spike to incentivize repayment.",
  },
  {
    icon: Repeat2,
    color: "#00F5FF",
    title: "Instant Liquidations",
    desc: "Positions below the liquidation threshold can be liquidated by anyone. Liquidators receive a bonus on seized collateral.",
  },
  {
    icon: GitBranch,
    color: "#8B00FF",
    title: "DEX + Liquidity Pools",
    desc: "Swap tokens and provide liquidity via Vitael DEX V2 — a Uniswap V2-style AMM with 0.3% fees distributed to LPs.",
  },
  {
    icon: ExternalLink,
    color: "#FF00C8",
    title: "CCTP Bridge",
    desc: "Bridge USDC cross-chain using Circle's Cross-Chain Transfer Protocol. Native USDC on Arc Testnet, no wrapped tokens.",
  },
];

const ASSETS = [
  { symbol: "USDC",   name: "USD Coin",    ltv: 90, liqThresh: 92, bonus: 5,  decimals: 6 },
  { symbol: "EURC",   name: "Euro Coin",   ltv: 85, liqThresh: 88, bonus: 5,  decimals: 6 },
  { symbol: "cirBTC", name: "Circle BTC",  ltv: 70, liqThresh: 75, bonus: 10, decimals: 8 },
] as const;

const PROTOCOL_FLOW = [
  { step: "01", title: "Get testnet tokens",  desc: "Claim USDC, EURC, or cirBTC from Circle Faucet on Arc Testnet.", href: "https://faucet.circle.com", cta: "Faucet →" },
  { step: "02", title: "Supply to earn",      desc: "Deposit any asset into the lending pool. Earn yield as borrowers pay interest.", href: "/lend", cta: "Lend →" },
  { step: "03", title: "Borrow against it",   desc: "Use your supplied assets as collateral to borrow other tokens.", href: "/borrow", cta: "Borrow →" },
  { step: "04", title: "Swap & add liquidity",desc: "Trade tokens or provide liquidity to earn 0.3% swap fees.", href: "/swap", cta: "Swap →" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5, delay },
  };
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <PageLayout variant="landing">
      <main className="relative z-10">

        {/* ── Hero ── */}
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-7">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="inline-flex items-center gap-2 bg-[#00F5FF]/10 border border-[#00F5FF]/20 text-[#00F5FF] text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-pulse" />
              Live on Arc Testnet
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="text-5xl md:text-6xl font-extrabold leading-[1.08] tracking-tight"
              style={{ fontFamily: "var(--font-raleway)" }}
            >
              DeFi on Arc.<br />
              <span className="text-[#00F5FF]">Lend. Borrow.</span><br />
              <span className="text-[#FF00C8]">Earn.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-[#8E9FB8] text-lg leading-relaxed max-w-lg"
            >
              Vitael is a multi-asset lending & DEX protocol on Arc Testnet.
              Supply USDC, EURC, or cirBTC — earn yield, borrow against collateral,
              and swap with real Stork oracle prices.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="flex flex-wrap gap-4"
            >
              <Link
                href="/lend"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#00F5FF] text-[#0A1428] font-bold rounded-full hover:bg-white transition shadow-[0_0_20px_rgba(0,245,255,0.25)]"
              >
                Start Lending <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/5 border border-white/10 text-white font-semibold rounded-full hover:bg-white/10 transition"
              >
                Read Docs <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>

          {/* Stats grid */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1, type: "spring", damping: 18 }}
            className="grid grid-cols-2 gap-4"
          >
            {STATS.map((s) => (
              <div key={s.label} className="glass-panel rounded-2xl p-6 space-y-1">
                <p className="text-3xl font-extrabold text-[#00F5FF]">{s.value}</p>
                <p className="text-sm font-bold text-white">{s.label}</p>
                <p className="text-xs text-[#8E9FB8]">{s.sub}</p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ── Protocol flow ── */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-3 block">How it works</span>
            <h2 className="text-4xl font-extrabold text-white" style={{ fontFamily: "var(--font-raleway)" }}>
              Four steps to DeFi on Arc
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PROTOCOL_FLOW.map((s, i) => (
              <motion.div key={s.step} {...fadeUp(i * 0.08)}
                className="glass-panel rounded-2xl p-6 flex flex-col gap-3 hover:border-[#00F5FF]/30 transition group"
              >
                <span className="text-3xl font-extrabold text-[#00F5FF]/60" style={{ fontFamily: "var(--font-raleway)" }}>
                  {s.step}
                </span>
                <h3 className="font-bold text-white text-base">{s.title}</h3>
                <p className="text-xs text-[#8E9FB8] leading-relaxed flex-1">{s.desc}</p>
                <a
                  href={s.href}
                  className="text-xs font-semibold text-[#00F5FF] hover:underline inline-flex items-center gap-1 mt-1"
                >
                  {s.cta} <ArrowRight className="w-3 h-3" />
                </a>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="text-xs uppercase tracking-widest text-[#FF00C8] font-bold mb-3 block">Features</span>
            <h2 className="text-4xl font-extrabold text-white" style={{ fontFamily: "var(--font-raleway)" }}>
              Everything you need
            </h2>
            <p className="text-[#8E9FB8] mt-3 max-w-xl mx-auto text-sm">
              A complete DeFi stack — lending, borrowing, swapping, liquidity, and bridging — all on Arc Testnet.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} {...fadeUp(i * 0.07)}
                className="glass-panel rounded-2xl p-6 flex flex-col gap-4 hover:border-white/20 transition"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}
                >
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-[#8E9FB8] leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Asset table ── */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="text-xs uppercase tracking-widest text-[#8B00FF] font-bold mb-3 block">Markets</span>
            <h2 className="text-4xl font-extrabold text-white" style={{ fontFamily: "var(--font-raleway)" }}>
              Supported assets
            </h2>
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="glass-panel rounded-3xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-[#8E9FB8]">
                  <th className="py-4 px-6">Asset</th>
                  <th className="py-4 px-6">Max LTV</th>
                  <th className="py-4 px-6">Liq. Threshold</th>
                  <th className="py-4 px-6">Liq. Bonus</th>
                  <th className="py-4 px-6">Decimals</th>
                </tr>
              </thead>
              <tbody>
                {ASSETS.map((a) => (
                  <tr key={a.symbol} className="border-b border-white/5 last:border-0 hover:bg-white/2 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <TokenIcon symbol={a.symbol} size={32} />
                        <div>
                          <p className="font-bold text-white text-sm">{a.symbol}</p>
                          <p className="text-xs text-[#8E9FB8]">{a.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-white font-semibold">{a.ltv}%</td>
                    <td className="py-4 px-6 text-[#FF00C8] font-semibold">{a.liqThresh}%</td>
                    <td className="py-4 px-6 text-emerald-400 font-semibold">+{a.bonus}%</td>
                    <td className="py-4 px-6 text-[#8E9FB8]">{a.decimals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.div
            {...fadeUp()}
            className="glass-panel rounded-3xl p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#00F5FF]/5 via-transparent to-[#FF00C8]/5 pointer-events-none" />
            <h2 className="text-4xl font-extrabold text-white mb-4 relative" style={{ fontFamily: "var(--font-raleway)" }}>
              Ready to start?
            </h2>
            <p className="text-[#8E9FB8] mb-8 max-w-md mx-auto relative">
              Connect your wallet, get testnet tokens from Circle Faucet, and start earning yield on Arc Testnet.
            </p>
            <div className="flex flex-wrap gap-4 justify-center relative">
              <Link
                href="/lend"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#00F5FF] text-[#0A1428] font-bold rounded-full hover:bg-white transition shadow-[0_0_20px_rgba(0,245,255,0.2)]"
              >
                Launch App <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/5 border border-white/10 text-white font-semibold rounded-full hover:bg-white/10 transition"
              >
                Get Testnet Tokens <ExternalLink className="w-4 h-4" />
              </a>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/5 border border-white/10 text-white font-semibold rounded-full hover:bg-white/10 transition"
              >
                Read Docs <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </section>

      </main>
    </PageLayout>
  );
}
