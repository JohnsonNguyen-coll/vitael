"use client";

import { ArrowRight, Bot, Check, ChevronDown, Coins, Sparkles, TrendingUp } from "lucide-react";
import { appHref } from "../../lib/marketing";
import TokenIcon from "../TokenIcon";

const StarField = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div className="stars stars-one" />
    <div className="stars stars-two" />
    <div className="shooting-star shooting-star-one" />
    <div className="shooting-star shooting-star-two" />
    <div className="sky-orb" />
    <div className="cloud cloud-a"><i /><i /><i /></div>
    <div className="cloud cloud-b"><i /><i /><i /></div>
    <div className="cloud cloud-c"><i /><i /><i /></div>
  </div>
);

export default function HeroSection() {
  return (
    <section className="hero-night relative isolate min-h-[960px] overflow-hidden pt-20 lg:min-h-[920px]">
      <StarField />
      <div className="relative z-10 mx-auto max-w-[1440px] px-5 pb-28 pt-20 sm:px-8 sm:pt-24 lg:px-12 lg:pt-28">
        <div className="mx-auto max-w-5xl text-center">
          <div className="hero-reveal hero-kicker mx-auto">
            <Sparkles className="size-3.5 text-[#bda7ff]" />
            Intelligent finance, clear as the night sky
          </div>
          <h1 className="hero-reveal marketing-display mt-7 text-[clamp(4.25rem,10vw,9rem)] font-semibold leading-[0.82] tracking-[-0.075em]" style={{ animationDelay: "80ms" }}>
            DeFi, above<br /><span className="sky-text">the noise.</span>
          </h1>
          <p className="hero-reveal mx-auto mt-8 max-w-2xl text-base leading-7 text-[#a9aec5] sm:text-lg sm:leading-8" style={{ animationDelay: "150ms" }}>
            Supply, borrow, swap and bridge from one calm command center. Vitael turns your intent into precise, wallet-controlled onchain actions.
          </p>
          <div className="hero-reveal mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "220ms" }}>
            <a href={appHref("/agent")} className="primary-cta">Start with Vitael <ArrowRight className="size-4" /></a>
            <button type="button" onClick={() => document.getElementById("product")?.scrollIntoView({ behavior: "smooth" })} className="secondary-cta">Explore the protocol <ChevronDown className="size-4" /></button>
          </div>
        </div>

        <div className="cockpit-wrap hero-reveal mx-auto mt-20 max-w-6xl" style={{ animationDelay: "300ms" }}>
          <div className="cockpit-glow" />
          <div className="float-card rate-card">
            <div className="flex items-center justify-between"><span className="mini-label">USDC market</span><TokenIcon symbol="USDC" size={28} className="shadow-[0_0_18px_rgba(39,117,202,.35)]" /></div>
            <p className="mt-5 text-[11px] text-[#8f96b3]">Supply APY</p>
            <p className="marketing-display mt-1 text-4xl font-semibold tracking-[-0.04em]">6.84<span className="text-lg text-[#bca8ff]">%</span></p>
            <div className="mt-5 flex items-center gap-2 text-[11px] text-[#7ee7bd]"><TrendingUp className="size-3.5" /> +0.32% this week</div>
          </div>

          <div className="float-card health-card">
            <div className="health-ring"><span>92</span></div>
            <div><p className="mini-label">Position health</p><p className="mt-1 text-sm font-medium text-[#91e7c2]">Excellent</p></div>
          </div>

          <div className="cockpit-panel">
            <div className="cockpit-topbar">
              <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#7f6cff] shadow-[0_0_12px_#7f6cff]" /><span>Vitael cockpit</span></div>
              <div className="flex items-center gap-2"><span className="hidden text-[#737a98] sm:inline">Oracle synced</span><span className="size-1.5 rounded-full bg-[#73e2b5]" /></div>
            </div>
            <div className="grid min-h-[360px] gap-px bg-white/[0.07] md:grid-cols-[1.05fr_1.5fr_1fr]">
              <div className="cockpit-cell hidden md:block">
                <p className="mini-label">Your position</p>
                <div className="mt-8"><p className="text-xs text-[#7f87a5]">Net worth</p><p className="marketing-display mt-2 text-3xl font-semibold tracking-[-0.04em]">$24,860.20</p></div>
                <div className="mt-8 space-y-3">
                  <div className="position-row"><span>Supplied</span><b>$31,240</b></div>
                  <div className="position-row"><span>Borrowed</span><b>$6,380</b></div>
                  <div className="position-row"><span>Net APY</span><b className="text-[#84e6bd]">+5.12%</b></div>
                </div>
              </div>
              <div className="cockpit-cell agent-cell">
                <span className="agent-orbit"><span><Bot className="size-5" /></span></span>
                <p className="mini-label mt-6">Vitael AI agent</p>
                <h3 className="marketing-display mt-3 text-2xl font-semibold tracking-[-0.035em]">Your strategy is ready.</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-[#9098b6]">Supply 8,000 USDC, use up to 35% as collateral and keep your health factor above 2.4.</p>
                <div className="mt-6 w-full rounded-2xl border border-white/[0.08] bg-[#090b19]/70 p-3 text-left">
                  <div className="flow-step"><span><Coins className="size-3.5" /></span><p>Supply USDC</p><b>$8,000</b></div>
                  <div className="flow-rail"><i /></div>
                  <div className="flow-step"><span><Check className="size-3.5" /></span><p>Wallet approval</p><b className="text-[#b8a4ff]">Ready</b></div>
                </div>
              </div>
              <div className="cockpit-cell hidden md:block">
                <p className="mini-label">Live markets</p>
                <div className="mt-6 space-y-2">
                  {[["USDC", "6.84%"], ["EURC", "4.20%"], ["cirBTC", "2.76%"]].map(([token, apy]) => (
                    <div key={token} className="market-row"><TokenIcon symbol={token} size={26} /><span>{token}</span><b>{apy}</b></div>
                  ))}
                </div>
                <a href={appHref("/lend")} className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] py-3 text-xs font-semibold text-[#c4b5ff] transition hover:bg-white/[0.05]">View all markets <ArrowRight className="size-3" /></a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="horizon-fade" />
    </section>
  );
}
