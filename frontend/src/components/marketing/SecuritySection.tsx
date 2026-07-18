import { ArrowRight, Eye, Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { appHref } from "../../lib/marketing";

const principles = [
  [KeyRound, "Self-custody", "Your keys never leave your wallet."],
  [Eye, "Visible actions", "Every call is shown before signature."],
  [Fingerprint, "Explicit consent", "Nothing executes without you."],
] as const;

export default function SecuritySection() {
  return (
    <section id="security" className="night-section mx-auto max-w-[1320px] px-5 py-28 sm:px-8 lg:py-40">
      <div className="security-shell">
        <div className="security-aurora" />
        <div className="relative z-10 grid gap-16 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div><span className="feature-icon feature-icon-green"><ShieldCheck className="size-5" /></span><p className="eyebrow mt-8">Security without compromise</p><h2 className="marketing-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl">The agent proposes.<br />You remain in control.</h2><p className="mt-7 max-w-xl text-base leading-8 text-[#939bb8]">Vitael can understand, simulate and prepare. Only your wallet can approve. That boundary is built into every interaction.</p><a href={appHref("/agent")} className="secondary-cta mt-8">See the agent in action <ArrowRight className="size-4" /></a></div>
          <div className="space-y-3">
            {principles.map(([Icon, title, text], index) => <article key={title} className="security-row" style={{ animationDelay: `${index * 500}ms` }}><span><Icon className="size-4" /></span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-[#7e86a3]">{text}</p></div><i /></article>)}
          </div>
        </div>
      </div>
    </section>
  );
}
