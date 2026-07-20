import type { Metadata } from "next";
import MarketingHeader from "../components/MarketingHeader";
import AboutSection from "../components/marketing/AboutSection";
import DocsPreview from "../components/marketing/DocsPreview";
import FeaturesSection from "../components/marketing/FeaturesSection";
import HeroSection from "../components/marketing/HeroSection";
import HowItWorksSection from "../components/marketing/HowItWorksSection";
import MarketingFooter from "../components/marketing/MarketingFooter";
import SecuritySection from "../components/marketing/SecuritySection";
import TrustStats from "../components/marketing/TrustStats";

export const metadata: Metadata = {
  title: "Vitael",
  description: "A non-custodial AI command center for lending, borrowing, swaps, liquidity and bridging on Arc Network.",
  openGraph: {
    title: "Vitael",
    description: "Move through DeFi with a clear, intelligent and wallet-controlled experience.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vitael",
    description: "Move through DeFi with a clear, intelligent and wallet-controlled experience.",
  },
};

export default function LandingPage() {
  return (
    <div id="top" className="marketing-site min-h-screen">
      <MarketingHeader />
      <main>
        <HeroSection />
        <TrustStats />
        <FeaturesSection />
        <HowItWorksSection />
        <SecuritySection />
        <AboutSection />
        <DocsPreview />
      </main>
      <MarketingFooter />
    </div>
  );
}
