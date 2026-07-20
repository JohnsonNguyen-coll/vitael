"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Menu } from "lucide-react";
import { appHref } from "../lib/marketing";

export default function MarketingHeader() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/") return;
    const target = sessionStorage.getItem("vitael:landing-section");
    if (!target) return;
    sessionStorage.removeItem("vitael:landing-section");
    window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [pathname]);

  const goToSection = (event: React.MouseEvent<HTMLAnchorElement>, section: string) => {
    event.preventDefault();
    if (pathname === "/") {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    sessionStorage.setItem("vitael:landing-section", section);
    router.push("/");
  };
  return (
    <header className="night-nav fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-[74px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link href="/" className="group flex items-center gap-3" aria-label="Vitael home">
          <span className="logo-shell">
            <Image src="/vitael_logo.png" alt="" width={28} height={28} priority />
          </span>
          <span className="text-[15px] font-bold tracking-[0.18em] text-white">VITAEL</span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.035] p-1 text-sm text-[#a7acc5] backdrop-blur-xl md:flex">
          <Link className="nav-pill" href="/" onClick={(event) => goToSection(event, "product")}>Product</Link>
          <Link className="nav-pill" href="/" onClick={(event) => goToSection(event, "how")}>How it works</Link>
          <Link className="nav-pill" href="/" onClick={(event) => goToSection(event, "security")}>Security</Link>
          <Link className={`nav-pill ${pathname === "/docs" ? "nav-pill-active" : ""}`} href="/docs">Docs</Link>
        </nav>

        <div className="flex items-center gap-2">
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
