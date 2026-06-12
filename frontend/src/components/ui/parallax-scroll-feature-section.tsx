"use client";
import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowDown } from "lucide-react";

export interface SectionData {
  id: number;
  title: string;
  description: string;
  visual: ReactNode;
  reverse: boolean;
}

function Row({ section }: { section: SectionData }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const maskImage = useTransform(
    scrollYProgress,
    [0.1, 0.7],
    [
      "linear-gradient(to right, black -5%, transparent 0%)",
      "linear-gradient(to right, black 100%, transparent 105%)"
    ]
  );
  const ty = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <div
      ref={ref}
      className={`grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-center min-h-[80vh] py-24 ${
        section.reverse ? "md:[&>*:first-child]:order-2" : ""
      }`}
    >
      <motion.div style={{ opacity, y: ty }} className="md:col-span-5">
        <div className="text-[10px] font-mono text-[#8B8D98] uppercase tracking-[0.3em] mb-6">
          / 0{section.id}
        </div>
        <h3 className="text-3xl md:text-4xl font-medium tracking-tight text-[#F3F4F6]">
          {section.title}
        </h3>
        <p className="mt-6 text-sm md:text-base text-[#8B8D98] leading-relaxed max-w-md">
          {section.description}
        </p>
      </motion.div>
      <motion.div
        style={{ WebkitMaskImage: maskImage, maskImage }}
        className="md:col-span-7 rounded-2xl border border-white/10 bg-[#0A0A0C] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.5)] min-h-[380px] flex items-center justify-center"
      >
        {section.visual}
      </motion.div>
    </div>
  );
}

export function ParallaxFeatureSection({ sections }: { sections: SectionData[] }) {
  return (
    <section className="relative bg-[#08080A]">
      <div className="pointer-events-none absolute -top-px inset-x-0 h-48 bg-gradient-to-b from-transparent via-[#08080A]/70 to-[#08080A]" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 pt-32">
        <p className="text-[10px] font-mono text-[#8B8D98] uppercase tracking-[0.3em] mb-6">
          / 04 · Protocol Workflow
        </p>
        <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-[#F3F4F6] max-w-3xl">
          A terminal built for <span className="font-serif italic text-[#8B8D98]">precision.</span>
        </h2>
        <p className="mt-6 max-w-xl text-[#8B8D98] text-sm md:text-base leading-relaxed">
          No generic AMMs. No retail interfaces. Step into the quantitative execution layer.
        </p>
        <div className="mt-10 inline-flex items-center gap-3 text-[10px] font-mono text-[#8B8D98] uppercase tracking-[0.3em]">
          Descend <ArrowDown size={12} />
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 pb-32">
        {sections.map((s) => (
          <Row key={s.id} section={s} />
        ))}
      </div>
    </section>
  );
}
