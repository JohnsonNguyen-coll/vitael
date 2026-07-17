"use client";

import Header from "./Header";
import Footer from "./Footer";
import WaterfallBackground from "./WaterfallBackground";
import { ReactNode } from "react";

interface PageLayoutProps {
  children: ReactNode;
  variant?: "landing" | "app";
}

export default function PageLayout({ children, variant = "app" }: PageLayoutProps) {
  if (variant === "landing") {
    return (
      <div className="relative min-h-screen text-white font-sans">
        <WaterfallBackground />
        <Header />
        {children}
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f1419] via-[#141920] to-[#0f1419] text-white font-sans">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
