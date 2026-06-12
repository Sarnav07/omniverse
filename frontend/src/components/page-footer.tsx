export type PageFooterProps = {
  marketCount: number;
};

export function PageFooter({ marketCount }: PageFooterProps) {
  return (
    <footer className="w-full border-t border-white/5 py-6 px-6 mt-auto flex flex-col md:flex-row justify-between items-center gap-3 text-[10px] text-[#8B8D98] tracking-widest uppercase bg-[#08080A]">
      <span>Omniverse Protocol · v4.0.2 · © 2026</span>
      <div className="flex items-center gap-2">
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{marketCount} markets</span>
        <span className="opacity-30">·</span>
        <span className="relative flex">
          <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981] opacity-60 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981]" />
        </span>
        <span>Live mempool</span>
      </div>
    </footer>
  );
}
