import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { appHref } from "../../lib/marketing";

export default function MarketingFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.07] bg-[#060710]">
      <div className="footer-cloud" />
      <div className="relative z-10 mx-auto max-w-[1320px] px-5 py-16 sm:px-8">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-center"><div><div className="flex items-center gap-3"><span className="logo-shell"><Image src="/vitael_logo.png" alt="" width={28} height={28} /></span><span className="text-[15px] font-bold tracking-[0.18em]">VITAEL</span></div><p className="mt-4 text-sm text-[#737b98]">Intelligent DeFi on Arc Network.</p></div><a href={appHref("/lend")} className="primary-cta">Enter the atmosphere <ArrowUpRight className="size-4" /></a></div>
        <div className="mt-16 flex flex-col justify-between gap-6 border-t border-white/[0.07] pt-7 text-xs text-[#5f6680] sm:flex-row"><p>© 2026 Vitael. Non-custodial DeFi software.</p><div className="flex gap-6"><a href="/docs" className="hover:text-white">Docs</a><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a><a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-white">X / Twitter</a><a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-white">Discord</a></div></div>
      </div>
    </footer>
  );
}
