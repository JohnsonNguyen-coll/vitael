import { ArrowUpRight, Bot, ChevronRight, Landmark, Repeat2, ShieldCheck, Waypoints, Waves } from "lucide-react";
import { appHref } from "../../lib/marketing";

const capabilities = [
  { Icon: Landmark, label: "Lend", href: "/lend", color: "#8b7cff" },
  { Icon: Repeat2, label: "Swap", href: "/swap", color: "#4ed5bd" },
  { Icon: Waves, label: "Pool", href: "/pool", color: "#ef83ca" },
  { Icon: Waypoints, label: "Bridge", href: "/bridge", color: "#f0ad6b" },
];

export default function FeaturesSection() {
  return (
    <section id="product" className="night-section mx-auto max-w-[1320px] px-5 py-28 sm:px-8 lg:py-40">
      <div className="section-heading">
        <div><p className="eyebrow">One intelligent layer</p><h2 className="marketing-display mt-5 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">Everything you need to move onchain.</h2></div>
        <p className="max-w-md text-sm leading-7 text-[#8e96b3] sm:text-base">Vitael brings fragmented DeFi actions into one coherent system—with an AI agent that understands the full journey.</p>
      </div>

      <div className="mt-16 grid gap-4 lg:grid-cols-12">
        <article className="bento-card bento-agent lg:col-span-7">
          <div className="card-aura" />
          <div className="relative z-10 max-w-md"><span className="feature-icon"><Bot className="size-5" /></span><p className="eyebrow mt-8">Agentic execution</p><h3 className="marketing-display mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Say the outcome.<br />Vitael maps the route.</h3><p className="mt-5 text-sm leading-7 text-[#929ab8]">The agent reads your position, current markets and protocol state before preparing each wallet-controlled transaction.</p></div>
          <div className="agent-preview">
            <p className="text-xs leading-5 text-[#c5c9dc]">“Put 5,000 USDC to work with moderate risk.”</p>
            <div className="mt-4 flex items-center gap-3"><span className="thinking-pulse"><i /><i /><i /></span><span className="text-[11px] text-[#8d82c8]">Building optimal route</span></div>
          </div>
        </article>

        <article className="bento-card lg:col-span-5">
          <span className="feature-icon feature-icon-green"><ShieldCheck className="size-5" /></span>
          <p className="eyebrow mt-8">Risk-aware by design</p>
          <h3 className="marketing-display mt-3 text-3xl font-semibold tracking-[-0.045em]">Clarity before commitment.</h3>
          <p className="mt-5 text-sm leading-7 text-[#929ab8]">Preview health factor, price impact and the exact transaction before you sign.</p>
          <div className="risk-meter mt-10"><div className="flex items-end justify-between"><span className="text-xs text-[#858daa]">Health factor</span><b className="marketing-display text-3xl font-semibold text-[#7ee2b7]">2.84</b></div><div className="meter-track mt-4"><i /></div><div className="mt-2 flex justify-between text-[9px] uppercase tracking-wider text-[#5f6682]"><span>Risk</span><span>Safe</span></div></div>
        </article>

        <article className="bento-card lg:col-span-5">
          <p className="eyebrow">Unified workspace</p>
          <h3 className="marketing-display mt-3 text-3xl font-semibold tracking-[-0.045em]">Four paths. One sky.</h3>
          <div className="mt-8 grid grid-cols-2 gap-2">
            {capabilities.map(({ Icon, label, href, color }, index) => <a key={label} href={appHref(href)} className="capability-chip" style={{ animationDelay: `${index * 400}ms` }}><span style={{ color }}><Icon className="size-4" /></span>{label}<ChevronRight className="ml-auto size-3 text-[#59617e]" /></a>)}
          </div>
        </article>

        <article className="bento-card bento-yield lg:col-span-7">
          <div><p className="eyebrow">Markets, always in motion</p><h3 className="marketing-display mt-3 text-3xl font-semibold tracking-[-0.045em]">Yield that stays visible.</h3><p className="mt-5 max-w-sm text-sm leading-7 text-[#929ab8]">Compare live rates and move capital without losing sight of risk.</p></div>
          <div className="yield-chart" aria-hidden="true"><div className="chart-grid" /><svg viewBox="0 0 420 150" preserveAspectRatio="none"><defs><linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a78ff" stopOpacity=".35"/><stop offset="1" stopColor="#8a78ff" stopOpacity="0"/></linearGradient></defs><path className="area-path" d="M0,125 C35,115 54,128 88,105 S142,95 170,103 S220,82 252,76 S302,90 333,55 S385,52 420,25 L420,150 L0,150Z" fill="url(#lineFill)"/><path className="line-path" d="M0,125 C35,115 54,128 88,105 S142,95 170,103 S220,82 252,76 S302,90 333,55 S385,52 420,25" fill="none" stroke="#a998ff" strokeWidth="3" /></svg><span className="chart-value">6.84% APY</span></div>
          <a href={appHref("/analytics")} className="absolute right-6 top-6 grid size-10 place-items-center rounded-full border border-white/10 text-[#a99aff] transition hover:bg-white/5"><ArrowUpRight className="size-4" /></a>
        </article>
      </div>
    </section>
  );
}
