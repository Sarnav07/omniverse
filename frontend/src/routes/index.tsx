import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/marketing/Nav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { ScrollManifesto } from "@/components/marketing/ScrollManifesto";
import { BentoGrid } from "@/components/marketing/BentoGrid";
import { ParallaxFeatures } from "@/components/marketing/ParallaxFeatures";
import { FooterCTA } from "@/components/marketing/FooterCTA";
import { Preloader } from "@/components/marketing/Preloader";
import { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Omniverse — Bounded Liquidity for Prediction Markets" },
      {
        name: "description",
        content:
          "Omniverse treats prediction-market liquidity as a risk surface. Adaptive Gaussian defense math bounds LP exposure as markets reach certainty.",
      },
      { property: "og:title", content: "Omniverse — Bounded Liquidity for Prediction Markets" },
      {
        property: "og:description",
        content:
          "A quantitative, zero-liquidation AMM on Arbitrum Stylus. Defend yield with probability-bounded math.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [showPreloader, setShowPreloader] = useState(true);

  // Prevent scrolling while preloader is active
  useEffect(() => {
    if (showPreloader) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showPreloader]);

  return (
    <main className="relative bg-[#08080A] text-[#F3F4F6] antialiased">
      <AnimatePresence>
        {showPreloader && (
          <Preloader onComplete={() => setShowPreloader(false)} />
        )}
      </AnimatePresence>

      <div className="noise-overlay" />
      <Nav />
      <HeroSection />
      <ScrollManifesto />
      <BentoGrid />
      <ParallaxFeatures />
      <FooterCTA />
    </main>
  );
}
