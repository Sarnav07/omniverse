import { ArrowUpRight } from "lucide-react";
import { Nav } from "./Nav";

type Stat = {
  label: string;
  value: string;
};

type AppPageShellProps = {
  eyebrow: string;
  title: string;
  body: string;
  stats: Stat[];
  primaryLabel?: string;
};

export function AppPageShell({
  eyebrow,
  title,
  body,
  stats,
  primaryLabel = "Enter Terminal",
}: AppPageShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08080A] text-[#F3F4F6] antialiased">
      <div className="noise-overlay" />
      <Nav />

      <section className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col justify-center px-6 pt-28">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full border border-white/[0.04]" />
          <div className="absolute left-1/2 top-1/3 h-[620px] w-[620px] -translate-x-1/2 rounded-full border border-white/[0.025]" />
        </div>

        <div className="relative z-10 max-w-4xl">
          <div className="mb-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#8B8D98]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] pulse-live" />
            {eyebrow}
          </div>

          <h1 className="max-w-5xl text-5xl font-medium leading-[1.04] tracking-tight text-[#F3F4F6] md:text-7xl">
            {title}
          </h1>

          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-[#8B8D98] md:text-base">
            {body}
          </p>

          <a
            href="/demo"
            className="mt-10 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-8 py-4 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:text-black"
          >
            {primaryLabel}
            <ArrowUpRight size={14} />
          </a>
        </div>

        <div className="relative z-10 mt-16 grid gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/5 bg-[#0E0E11]/80 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#8B8D98]">
                {stat.label}
              </div>
              <div className="mt-3 font-mono text-2xl tracking-tight text-white">{stat.value}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
