import { ArrowRight, BookOpen, CircleHelp, GraduationCap } from "lucide-react";

const guides = [
  [BookOpen, "Start on Arc Testnet", "Connect, fund and make your first supply."],
  [GraduationCap, "Understand risk", "LTV, health factor and liquidation explained."],
  [CircleHelp, "Use the AI agent", "Turn an objective into a safe execution plan."],
] as const;

export default function DocsPreview() {
  return (
    <section id="docs" className="night-section mx-auto max-w-[1320px] px-5 py-28 sm:px-8 lg:py-40">
      <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-24">
        <div><p className="eyebrow">Knowledge, illuminated</p><h2 className="marketing-display mt-5 text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">Find your way around.</h2><p className="mt-6 max-w-md text-sm leading-7 text-[#8e96b3]">Short, useful guides for every market, risk concept and protocol action in Vitael.</p><a href="/docs" className="primary-cta mt-8">Open documentation <ArrowRight className="size-4" /></a></div>
        <div className="guide-list">
          {guides.map(([Icon, title, text], index) => <a href="/docs" key={title} className="guide-row"><span className="guide-number">0{index + 1}</span><span className="guide-icon"><Icon className="size-4" /></span><span><b>{title}</b><small>{text}</small></span><ArrowRight className="ml-auto size-4 text-[#68708d] transition-transform group-hover:translate-x-1 group-hover:text-[#b5a5ff]" /></a>)}
        </div>
      </div>
    </section>
  );
}
