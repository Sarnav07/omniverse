import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

export function MarketsHero() {
  return (
    <section className="flex flex-col lg:flex-row lg:justify-between lg:items-end mt-12 mb-8 gap-8">
      <div className="max-w-xl">
        <span className="text-[10px] uppercase tracking-[0.3em] text-[#8B8D98] mb-4 block">
          OMNIVERSE · MARKETS
        </span>
        <h1 className="text-6xl font-medium tracking-[-0.04em] text-[#F3F4F6] leading-[1.05]">
          liquidity,{" "}
          <span className="italic font-serif text-[#8B8D98] tracking-[-0.02em]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>bounded.</span>
        </h1>
        <p className="max-w-md text-sm text-[#8B8D98] leading-relaxed mt-4">
          A solver-routed orderbook for binary outcomes. Every market is collateralized, every
          quote is reproducible, every settlement is on-chain.
        </p>
        <Link 
          to="/markets/create"
          className="mt-6 bg-transparent border border-white/20 text-white hover:bg-white hover:text-black text-xs font-medium tracking-widest uppercase px-5 py-2.5 rounded-full transition-colors flex items-center gap-2 w-fit outline-none focus-visible:border-white/40"
        >
          <Plus size={14} />
          Create market
        </Link>
      </div>
    </section>
  );
}
