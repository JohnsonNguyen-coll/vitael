import { CheckCircle2, MessageSquareText, ScanSearch, Wallet } from "lucide-react";

const steps = [
  [MessageSquareText, "Describe", "Tell Vitael what you want to achieve in plain language."],
  [ScanSearch, "Discover", "The agent reads markets, risk and your current position."],
  [CheckCircle2, "Review", "See the route, expected outcome and every transaction."],
  [Wallet, "Sign", "You approve in your wallet. Vitael never takes custody."],
] as const;

export default function HowItWorksSection() {
  return (
    <section id="how" className="constellation-section relative overflow-hidden border-y border-white/[0.06]">
      <div className="constellation-orb" />
      <div className="relative z-10 mx-auto max-w-[1320px] px-5 py-28 sm:px-8 lg:py-40">
        <div className="mx-auto max-w-3xl text-center"><p className="eyebrow">From thought to transaction</p><h2 className="marketing-display mt-5 text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">A clear path through DeFi.</h2><p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-[#8e96b3] sm:text-base">Four deliberate steps. Your wallet remains the final authority at every point.</p></div>
        <div className="steps-grid relative mt-20 grid gap-4 md:grid-cols-4">
          <div className="step-beam hidden md:block"><i /></div>
          {steps.map(([Icon, title, text], index) => (
            <article key={title} className="step-card">
              <div className="step-number">0{index + 1}</div><span className="step-icon"><Icon className="size-5" /></span>
              <h3 className="marketing-display mt-8 text-2xl font-semibold tracking-[-0.035em]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#8991af]">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
