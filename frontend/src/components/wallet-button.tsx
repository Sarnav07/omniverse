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
              className="bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full transition-all flex items-center gap-2 outline-none focus-visible:border-white/30 text-white"
            >
              <span>Connect</span>
            </button>
          );
        }

        return (
          <button
            onClick={openAccountModal}
            className="bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full transition-all flex items-center gap-2 outline-none focus-visible:border-white/30 text-white"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
            <span className="font-mono normal-case tracking-tight">{account.displayName}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
