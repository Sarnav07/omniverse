"use client";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WalletButton } from "../wallet-button";

const navLinks = [
  { label: "protocol", to: "/" as const },
  { label: "markets", to: "/markets" as const },
  { label: "explorer", to: "/explorer" as const },
] as const;

export function Nav({ appMode = false }: { appMode?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`${appMode ? "relative" : "fixed"} top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled && !appMode ? "py-3 bg-[#08080A]/70 backdrop-blur-xl border-b border-white/5" : "py-4"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-sm border border-white/15 bg-white/[0.02]">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="text-[13px] tracking-tight text-white/90">omniverse</span>
        </Link>

        <nav className="hidden items-center gap-8 text-[13px] md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="text-white/55 transition-colors duration-300 hover:text-white"
              activeProps={{ className: "text-white" }}
              activeOptions={{ exact: true }}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="/gaussian_lambda_star.pdf"
            target="_blank"
            rel="noreferrer"
            className="text-white/55 transition-colors duration-300 hover:text-white"
          >
            docs ↗
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {appMode ? (
            <WalletButton />
          ) : (
            <Link
              to="/markets"
              className="rounded-full border border-white/20 bg-white/[0.04] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md transition-all hover:bg-white hover:text-black"
            >
              Launch App
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
