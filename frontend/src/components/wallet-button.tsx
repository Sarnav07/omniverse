import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { toast } from "sonner";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = () => {
    connect(
      { connector: injected() },
      {
        onError: (error) => {
          toast.error(error.message || "Failed to connect wallet");
        },
      }
    );
  };

  if (!isConnected || !address) {
    return (
      <button
        onClick={handleConnect}
        className="bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full transition-all flex items-center gap-2 outline-none focus-visible:border-white/30 text-white"
      >
        <span>Connect</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => disconnect()}
      className="bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full transition-all flex items-center gap-2 outline-none focus-visible:border-white/30 text-white"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
      <span className="font-mono normal-case tracking-tight">
        {`${address.slice(0, 6)}...${address.slice(-4)}`}
      </span>
    </button>
  );
}
