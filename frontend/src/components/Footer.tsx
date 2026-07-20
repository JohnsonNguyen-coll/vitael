import Link from "next/link";

export default function Footer() {
  return (
    <footer className="app-footer relative z-10 mt-16 border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-[1320px] flex-col justify-between gap-4 px-6 py-8 text-[11px] text-[#626a86] sm:flex-row sm:items-center">
        <p>© 2026 Vitael. Wallet-controlled finance on Arc.</p>
        <div className="flex items-center gap-5"><Link href="/docs" className="hover:text-white">Documentation</Link><a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="hover:text-white">ArcScan</a><a href="https://docs.arc.network" target="_blank" rel="noreferrer" className="hover:text-white">Arc Network</a></div>
      </div>
    </footer>
  );
}
