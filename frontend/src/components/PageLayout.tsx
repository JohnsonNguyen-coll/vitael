"use client";

import Header from "./Header";
import Footer from "./Footer";
import WaterfallBackground from "./WaterfallBackground";
import { ReactNode } from "react";

interface PageLayoutProps {
  children: ReactNode;
  variant?: "landing" | "app";
  showFooter?: boolean;
}

export default function PageLayout({ children, variant = "app", showFooter = true }: PageLayoutProps) {
  if (variant === "landing") {
    return <div className="relative min-h-screen text-white font-sans"><WaterfallBackground /><Header />{children}<Footer /></div>;
  }

  return (
    <div className="app-shell min-h-screen text-white">
      <div className="app-sky" aria-hidden="true">
        <div className="app-stars" />
        <div className="app-aurora" />
        <div className="app-cloud app-cloud-one" />
        <div className="app-cloud app-cloud-two" />
      </div>
      <Header />
      <div className="relative z-10">{children}</div>
      {showFooter && <Footer />}
    </div>
  );
}
