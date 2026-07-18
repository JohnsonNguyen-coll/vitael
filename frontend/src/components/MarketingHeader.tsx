"use client";

import Image from "next/image";
import { ArrowUpRight, Menu } from "lucide-react";
import { appHref } from "../lib/marketing";

export default function MarketingHeader() {
  return (
    <header className="night-nav fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-[74px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a href="#top" className="group flex items-center gap-3" aria-label="Vitael home">
          <span className="logo-shell">
            <Image src="/vitael_logo.png" alt="" width={28} height={28} priority />
          </span>
          <span className="text-[15px] font-bold tracking-[0.18em] text-white">VITAEL</span>
        </a>

        <nav className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.035] p-1 text-sm text-[#a7acc5] backdrop-blur-xl md:flex">
          <a className="nav-pill" href="#product">Product</a>
          <a className="nav-pill" href="#how">How it works</a>
          <a className="nav-pill" href="#security">Security</a>
          <a className="nav-pill" href="#docs">Docs</a>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 text-xs text-[#8e94af] lg:flex">
            <span className="status-dot" /> Arc testnet
          </span>
          <a href={appHref("/lend")} className="launch-button">
            Enter app <ArrowUpRight className="size-3.5" />
          </a>
          <button className="grid size-10 place-items-center rounded-full border border-white/10 text-white md:hidden" aria-label="Open navigation">
            <Menu className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
