"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import ChainIcon from "./ChainIcon";

const NAV = [
  { label: "Lend / Borrow", href: "/lend" },
  { label: "Swap",          href: "/swap" },
  { label: "Bridge",        href: "/bridge" },
  { label: "Markets",       href: "/#markets" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 w-full flex justify-between items-center py-4 px-8 md:px-16 border-b border-white/5 bg-[#0A1428]/90 backdrop-blur-md z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 group">
        <Image
          src="/vitael_logo.jpg"
          alt="Vitael Logo"
          width={34}
          height={34}
          className="rounded-xl object-cover"
          onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
        />
        <span
          className="font-black text-xl text-white group-hover:text-[#00F5FF] transition duration-200"
          style={{ fontFamily: "var(--font-raleway)", letterSpacing: "0.15em" }}
        >
          VITAEL
        </span>
      </Link>

      {/* Nav */}
      <nav className="hidden md:flex gap-8 text-sm font-medium">
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`transition duration-200 ${
                active
                  ? "text-[#00F5FF] border-b border-[#00F5FF] pb-0.5"
                  : "text-[#8E9FB8] hover:text-[#00F5FF]"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      {/* Right side: Arc badge + wallet */}
      <div className="flex items-center gap-3">
        {/* Arc Testnet pill */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#00F5FF]/8 border border-[#00F5FF]/15 rounded-full px-3 py-1.5">
          <ChainIcon chainId="Arc_Testnet" size={16} />
          <span className="text-xs font-semibold text-[#00F5FF]">Arc Testnet</span>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
