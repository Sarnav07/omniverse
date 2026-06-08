import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
        if (!mounted) return null;

        if (!account || !chain) {
          return (
            <button
              onClick={openConnectModal}
              className="group relative overflow-hidden rounded-full border border-white/20 px-5 py-2 text-[12px] text-white transition-colors duration-500 ease-precision hover:text-abyss"
            >
              <span className="absolute inset-0 -translate-x-full bg-white transition-transform duration-500 ease-precision group-hover:translate-x-0" />
              <span className="relative tabular uppercase tracking-[0.2em] text-[11px]">
                connect wallet
              </span>
            </button>
          );
        }

        return (
          <button
            onClick={openAccountModal}
            className="group flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.025] px-4 py-2 tabular text-[11px] uppercase tracking-[0.18em] text-white/85 ease-precision hover:border-white/30 hover:bg-white/[0.05]"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#00FFAA]/60" />
              <span
                className="relative h-1.5 w-1.5 rounded-full bg-[#00FFAA]"
                style={{ boxShadow: "0 0 8px rgba(0,255,170,0.7)" }}
              />
            </span>
            <span>{account.displayName}</span>
            <span className="text-white/30">·</span>
            <span className="text-[#00FFAA]/80">{(chain.name ?? "").toLowerCase()}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
