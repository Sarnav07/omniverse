import { Link } from "@tanstack/react-router";
import { WalletButton } from "./wallet-button";

export function NavBar({ hideWallet = false }: { hideWallet?: boolean }) {
  return (
    <div className="sticky top-5 z-30 mx-auto w-full max-w-[1180px] px-5">
      <header
        className="relative flex items-center justify-between rounded-full pl-2 pr-2 py-2"
        style={{
          background: "linear-gradient(180deg, #0c0c0e 0%, #050505 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow:
            "0 24px 60px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02) inset, 0 1px 0 rgba(255,255,255,0.05) inset",
        }}
      >
        {/* LEFT — circular white icon + brand + status */}
        <Link to="/" className="group flex items-center gap-3 pl-1">
          <span
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-abyss transition-transform duration-500 ease-precision group-hover:scale-[1.04]"
            style={{ boxShadow: "0 4px 14px -4px rgba(255,255,255,0.35)" }}
          >
            <span className="block h-1.5 w-1.5 rounded-full bg-abyss" />
          </span>
          <span className="hidden text-[13px] tracking-tight text-white/95 sm:block">
            omniverse
          </span>
          <span className="tabular hidden text-[10px] uppercase tracking-[0.22em] text-white/35 md:block">
            v4.0 · arb sepolia
          </span>
        </Link>

        {/* CENTER — links */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 text-[13px] md:flex">
          {[
            { label: "protocol", to: "/" as const },
            { label: "markets", to: "/markets" as const },
            { label: "simulate", to: "/simulate" as const },
            { label: "explorer", to: "/explorer" as const },
          ].map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="text-white/55 transition-colors duration-300 ease-precision hover:text-white"
              activeProps={{ className: "text-white" }}
              activeOptions={{ exact: true }}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://arxiv.org/html/2602.09887"
            target="_blank"
            rel="noreferrer"
            className="text-white/55 transition-colors duration-300 ease-precision hover:text-white"
          >
            docs ↗
          </a>
        </nav>

        {/* RIGHT — nested white pill CTA / wallet */}
        {!hideWallet ? (
          <div className="flex items-center">
            <WalletButton />
          </div>
        ) : (
          <Link
            to="/demo"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-5 py-2 text-[12.5px] font-medium text-abyss transition-colors duration-300 ease-precision hover:bg-white/90"
            style={{ boxShadow: "0 6px 18px -6px rgba(255,255,255,0.35)" }}
          >
            <span className="relative">enter terminal</span>
            <span className="relative -mr-0.5 transition-transform duration-300 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        )}
      </header>
    </div>
  );
}
