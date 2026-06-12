"use client";
import { apexSpring } from "@/lib/motion";
import { HeroMesh } from "./HeroMesh";
import { GooeyText } from "@/components/ui/gooey-text-morphing";

const WORDS = ["bots.", "extractors.", "toxic flow.", "MEV."];

export function HeroSection() {

  return (
    <section className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden px-6">
      {/* Geometric particle mesh */}
      <HeroMesh />

      {/* Eyebrow */}
      <div className="relative z-10 text-[10px] font-mono text-[#8B8D98] uppercase tracking-[0.3em] mb-10 flex items-center justify-center gap-3">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10B981] pulse-live" />
        <span>[ ARBITRUM STYLUS ]</span>
        <span className="opacity-40">•</span>
        <span>[ ZERO-LIQUIDATION AMM ]</span>
      </div>

      <h1 className="relative z-10 text-5xl md:text-7xl font-medium tracking-tight text-[#F3F4F6] text-center leading-[1.05]">
        Stop bleeding liquidity to
        <br />
        <span className="inline-block min-h-[1.1em] mt-2 w-full h-[80px] md:h-[100px]">
          <GooeyText 
            texts={WORDS}
            morphTime={1}
            cooldownTime={2.4}
            textClassName="font-serif italic text-[#8B8D98] whitespace-nowrap"
            className="w-full h-full flex items-center justify-center"
          />
        </span>
      </h1>

      <p className="relative z-10 max-w-2xl mx-auto mt-8 text-center text-sm md:text-base text-[#8B8D98] leading-relaxed">
        Omniverse treats prediction-market liquidity as a risk surface. Adaptive defense math bounds
        your exposure as markets reach certainty.
      </p>

      <div className="relative z-10 flex items-center gap-6 mt-12">
        <a
          href="/demo"
          className="bg-white/[0.04] border border-white/10 backdrop-blur-md px-8 py-4 rounded-full text-xs font-bold tracking-widest uppercase text-white transition-all duration-300 hover:bg-white hover:text-black hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
        >
          Enter Terminal
        </a>
        <a
          href="https://arxiv.org/html/2602.09887"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-mono text-[#8B8D98] uppercase tracking-widest underline underline-offset-8 hover:text-white transition-colors cursor-pointer"
        >
          Read the Paper
        </a>
      </div>

      {/* scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 text-[10px] font-mono text-[#8B8D98] uppercase tracking-[0.3em] flex flex-col items-center gap-2">
        <span>scroll</span>
        <span className="block w-px h-10 bg-gradient-to-b from-[#8B8D98] to-transparent" />
      </div>
    </section>
  );
}
