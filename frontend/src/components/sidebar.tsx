import { Link } from "@tanstack/react-router";
import { WalletButton } from "./wallet-button";

export function Sidebar() {
  return (
    <aside className="flex h-screen w-[260px] flex-col border-r border-white/[0.04] bg-app-bg px-5 py-6 shrink-0">
      <Link to="/" className="flex items-center gap-2.5 mb-10 pl-2">
        <div className="grid h-6 w-6 place-items-center rounded-sm border border-white/15 bg-white/[0.02]">
          <div className="h-1.5 w-1.5 rounded-full bg-white" />
        </div>
        <span className="text-[14px] font-medium tracking-tight text-text-primary">omniverse</span>
      </Link>

      <div className="mb-4 pl-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary/50">
        Markets
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {[
          { label: "Overview", to: "/demo" as const },
          { label: "Portfolio", to: "/markets" as const },
          { label: "Explorer", to: "/explorer" as const },
        ].map((l) => (
          <Link
            key={l.label}
            to={l.to}
            className="group flex items-center rounded-lg px-3 py-2 text-[13px] text-text-secondary transition-all duration-200 ease-precision hover:bg-white/[0.04] hover:text-white"
            activeProps={{ className: "bg-white/[0.04] !text-white font-medium" }}
            activeOptions={{ exact: true }}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="mb-6 flex flex-col gap-1">
          <a
            href="https://arxiv.org/html/2602.09887"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center justify-between rounded-lg px-3 py-2 text-[13px] text-text-secondary transition-all duration-200 ease-precision hover:bg-white/[0.04] hover:text-white"
          >
            <span>Research Paper</span>
            <span className="opacity-0 transition-opacity group-hover:opacity-100">↗</span>
          </a>
        </div>
        <WalletButton />
      </div>
    </aside>
  );
}
