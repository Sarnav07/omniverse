import { Link } from "@tanstack/react-router";
import { WalletButton } from "./wallet-button";

export function NavBar({ hideWallet = false }: { hideWallet?: boolean }) {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-[1600px] items-center justify-between px-8 py-5">
      <Link to="/" className="flex items-center gap-2.5">
        <div className="grid h-6 w-6 place-items-center rounded-sm border border-white/15 bg-white/[0.02]">
          <div className="h-1.5 w-1.5 rounded-full bg-white" />
        </div>
        <span className="text-[13px] tracking-tight text-white/90">omniverse</span>
        <span className="ml-2 tabular text-[10px] uppercase tracking-[0.18em] text-white/30">
          v4.0 · arb sepolia
        </span>
      </Link>

      <nav className="hidden items-center gap-8 text-[13px] md:flex">
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

      {!hideWallet ? (
        <WalletButton />
      ) : (
        <Link
          to="/demo"
          className="group relative overflow-hidden rounded-full border border-white/20 px-5 py-2 text-[12px] text-white transition-colors duration-500 ease-precision hover:text-abyss"
        >
          <span className="absolute inset-0 -translate-x-full bg-white transition-transform duration-500 ease-precision group-hover:translate-x-0" />
          <span className="relative">enter terminal</span>
        </Link>
      )}
    </header>
  );
}
