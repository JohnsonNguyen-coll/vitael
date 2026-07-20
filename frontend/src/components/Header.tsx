"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletConnectButton from "./WalletConnectButton";

const NAV = [
  { label: "Lend", href: "/lend" },
  { label: "Borrow", href: "/borrow" },
  { label: "Swap", href: "/swap" },
  { label: "Pool", href: "/pool" },
  { label: "Agent", href: "/agent" },
  { label: "Analytics", href: "/analytics" },
  { label: "Profile", href: "/profile" },
];

export default function Header() {
  const pathname = usePathname();
  return (
    <header className="app-header sticky top-0 z-50">
      <div className="mx-auto flex h-[72px] max-w-[1480px] items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="app-logo"><Image src="/vitael_logo.png" alt="Vitael" width={27} height={27} priority /></span>
          <span className="hidden text-sm font-bold tracking-[0.18em] text-white sm:block">VITAEL</span>
        </Link>

        <nav className="app-nav-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map(({ label, href }) => {
            const active = pathname === href;
            return <Link key={href} href={href} className={`app-nav-item ${active ? "app-nav-active" : ""}`}><span>{label}</span>{active && <i />}</Link>;
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}
