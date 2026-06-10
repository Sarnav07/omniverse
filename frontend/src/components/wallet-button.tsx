import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useEffect } from "react";
import { toast } from "sonner";

export function WalletButton() {
  const { address, chain } = useAccount();
  const { connect, error, isError } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (isError && error) {
      toast.error("Connection Failed", {
        description: error.message,
      });
    }
  }, [isError, error]);

  if (!address) {
    return (
      <button
        onClick={() => connect({ connector: injected() })}
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
      onClick={() => disconnect()}
      className="group flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.025] px-4 py-2 tabular text-[11px] uppercase tracking-[0.18em] text-white/85 ease-precision hover:border-white/30 hover:bg-white/[0.05]"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#00FFAA]/60" />
        <span
          className="relative h-1.5 w-1.5 rounded-full bg-[#00FFAA]"
          style={{ boxShadow: "0 0 8px rgba(0,255,170,0.7)" }}
        />
      </span>
      <span>{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
      <span className="text-white/30">·</span>
      <span className="text-[#00FFAA]/80">{(chain?.name ?? "").toLowerCase()}</span>
    </button>
  );
}
