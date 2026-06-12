import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { parseUnits, isAddress } from "viem";
import { toast } from "sonner";
import { Nav } from "@/components/marketing/Nav";
import { SpotlightCard } from "@/components/spotlight-card";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import MarketFactoryAbi from "@/abis/MarketFactory.abi.json";

export const Route = createFileRoute("/markets/create")({
  head: () => ({
    meta: [
      { title: "Create Prediction — Omniverse" },
      {
        name: "description",
        content: "Deploy a new prediction market on the Omniverse Protocol.",
      },
    ],
  }),
  component: CreateMarketPage,
});

function CreateMarketPage() {
  const router = useRouter();
  const { isConnected, address: user } = useAccount();

  // Basic Form States
  const [question, setQuestion] = useState("");
  const [symbol, setSymbol] = useState("");
  const [category, setCategory] = useState("macro");
  const [expiryDate, setExpiryDate] = useState("");

  // Advanced States
  const [l0, setL0] = useState("5000"); // default L0 = 5000
  const [gammaPrime, setGammaPrime] = useState("2.0"); // default gammaPrime = 2.0
  const [useDynamicLambda, setUseDynamicLambda] = useState(false);
  const [resolver, setResolver] = useState(CONTRACT_ADDRESSES.Resolver);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Contract Write hook
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Handle transaction states with toasts
  useEffect(() => {
    if (isPending) {
      toast.loading("Confirm market creation in wallet...", { id: "create-market" });
    } else if (isConfirming) {
      toast.loading("Deploying pools on-chain...", { id: "create-market" });
    } else if (isSuccess) {
      toast.success("Prediction Market Created Successfully!", { id: "create-market" });
    }
  }, [isPending, isConfirming, isSuccess]);

  const categories = ["macro", "yield", "rates", "vol", "stable", "rwa", "lst"];

  // Form Validation
  const isValid =
    question.trim().length > 0 &&
    symbol.trim().length > 0 &&
    expiryDate.length > 0 &&
    new Date(expiryDate).getTime() > Date.now() &&
    parseFloat(l0) > 0 &&
    parseFloat(gammaPrime) > 0 &&
    isAddress(resolver);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (!isValid) {
      toast.error("Please fill in all fields correctly.");
      return;
    }

    const expiryTimestamp = Math.floor(new Date(expiryDate).getTime() / 1000);
    const parsedL0 = parseUnits(l0, 18);
    const parsedGammaPrime = parseUnits(gammaPrime, 18);

    writeContract(
      {
        address: CONTRACT_ADDRESSES.MarketFactory,
        abi: MarketFactoryAbi,
        functionName: "createEvent",
        args: [
          question,
          symbol,
          category,
          BigInt(expiryTimestamp),
          resolver as `0x${string}`,
          parsedL0,
          parsedGammaPrime,
          useDynamicLambda,
        ],
      },
      {
        onError: (err) => {
          toast.error(`Deployment failed: ${err.message}`, { id: "create-market" });
        },
      },
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-abyss text-foreground pb-32">
      <div className="noise-overlay" />
      <div className="border-b border-white/[0.05]">
        <Nav appMode />
      </div>

      <section className="relative z-10 mx-auto mt-20 w-full max-w-[1600px] px-8">
        <div>
          <span className="tabular text-[10px] uppercase tracking-[0.32em] text-white/40">
            / 02 · deploy event
          </span>
          <h1 className="mt-4 font-display text-[54px] font-light leading-[0.92] tracking-[-0.04em]">
            initiate, <span className="italic font-extralight text-white/55">deploy.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-white/55">
            decentralized market synthesis. configure a binary outcome condition and spin up fully
            isolated WETH and USDC pm-AMM liquidity pools.
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-12 w-full max-w-[1600px] px-8">
        {isSuccess ? (
          <SpotlightCard className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#00FFAA]/30 bg-[#00FFAA]/5">
              <span className="text-[#00FFAA] text-xl">✓</span>
            </div>
            <h3 className="mt-6 font-display text-2xl font-light text-white">Market Synthesized</h3>
            <p className="mt-3 text-[13px] text-white/55 max-w-md mx-auto leading-relaxed">
              Your pools have been successfully deployed to Arbitrum Sepolia. The Ponder indexer is
              processing the block logs and the market will appear on the dashboard shortly.
            </p>

            {txHash && (
              <div className="mt-6 p-4 rounded-lg bg-white/[0.02] border border-white/5 inline-block text-left max-w-md w-full">
                <div className="text-[10px] uppercase tracking-wider text-white/35">
                  Transaction Hash
                </div>
                <div className="mt-1 font-mono text-[11px] text-white/80 break-all select-all">
                  {txHash}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-center gap-4">
              <Link
                to="/markets"
                className="rounded-full border border-white/20 bg-white/[0.04] px-6 py-2.5 tabular text-[11px] uppercase tracking-[0.22em] text-white transition-all hover:bg-white/[0.08]"
              >
                Back to Markets
              </Link>
            </div>
          </SpotlightCard>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            <SpotlightCard className="p-8 space-y-6">
              {/* Basic Parameters */}
              <div className="space-y-4">
                <h3 className="text-[13px] uppercase tracking-[0.22em] text-white/70 border-b border-white/5 pb-2">
                  Market Parameters
                </h3>

                <div className="flex flex-col gap-2">
                  <label className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
                    Event Question
                  </label>
                  <input
                    type="text"
                    required
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. Will ETH exceed $10,000 in 2026?"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px] text-white placeholder-white/20 outline-none transition-colors focus:border-white/30"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
                      Market Symbol / Ticker
                    </label>
                    <input
                      type="text"
                      required
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      placeholder="e.g. ETH-10K-2026"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px] text-white placeholder-white/20 outline-none transition-colors focus:border-white/30"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      required
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-white/30 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`rounded-full border px-4 py-2 tabular text-[10px] uppercase tracking-[0.22em] transition-colors ${
                          category === cat
                            ? "border-white bg-white text-black font-medium"
                            : "border-white/10 bg-white/[0.01] text-white/50 hover:border-white/35 hover:text-white/80"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Advanced Toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 tabular text-[10px] uppercase tracking-[0.22em] text-white/40 hover:text-white/70 transition-colors"
                >
                  <span>{showAdvanced ? "▼" : "▶"} Advanced Settings</span>
                </button>
              </div>

              {showAdvanced && (
                <div className="space-y-6 pt-4 border-t border-white/5 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
                        Initial Liquidity Parameter (L0)
                      </label>
                      <input
                        type="number"
                        required
                        value={l0}
                        onChange={(e) => setL0(e.target.value)}
                        placeholder="5000"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px] text-white placeholder-white/20 outline-none transition-colors focus:border-white/30"
                      />
                      <span className="text-[10px] text-white/35">
                        Starting liquidity index (converted to WAD on deployment).
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
                        Gamma Prime (LVR weight)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={gammaPrime}
                        onChange={(e) => setGammaPrime(e.target.value)}
                        placeholder="2.0"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px] text-white placeholder-white/20 outline-none transition-colors focus:border-white/30"
                      />
                      <span className="text-[10px] text-white/35">
                        Governance factor weighting LVR losses vs. tracking error.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.01] border border-white/5">
                    <div className="flex flex-col gap-1 pr-4">
                      <span className="tabular text-[11px] uppercase tracking-[0.2em] text-white/80">
                        Dynamic LP Activeness (λ*)
                      </span>
                      <span className="text-[10px] text-white/35">
                        Automatically decay liquidity depth near event resolution to protect LPs.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseDynamicLambda(!useDynamicLambda)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        useDynamicLambda ? "bg-white" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-abyss shadow ring-0 transition duration-200 ease-in-out ${
                          useDynamicLambda ? "translate-x-5 bg-black" : "translate-x-0 bg-white/60"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="tabular text-[10px] uppercase tracking-[0.22em] text-white/45">
                      Resolver Address
                    </label>
                    <input
                      type="text"
                      required
                      value={resolver}
                      onChange={(e) => setResolver(e.target.value as `0x${string}`)}
                      placeholder="0x..."
                      className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px] text-white placeholder-white/20 outline-none transition-colors focus:border-white/30 font-mono"
                    />
                    <span className="text-[10px] text-white/35">
                      The oracle/resolver authorized to settle this market condition.
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Container */}
              <div className="border-t border-white/5 pt-6">
                {!isConnected ? (
                  <div className="text-center py-2">
                    <span className="tabular text-[11px] uppercase tracking-[0.2em] text-white/40 block mb-4">
                      Connect your wallet to deploy the market contracts
                    </span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={!isValid || isPending || isConfirming}
                    className={`group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-full border ease-precision transition-all ${
                      isValid && !isPending && !isConfirming
                        ? "border-white/25 bg-white/[0.04] hover:border-white/40 hover:bg-white/[0.07] cursor-pointer"
                        : "cursor-not-allowed border-white/10 bg-white/[0.01]"
                    }`}
                  >
                    {isPending || isConfirming ? (
                      <span className="flex items-center gap-3">
                        <span
                          className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white"
                          aria-hidden
                        />
                        <span className="tabular text-[11px] uppercase tracking-[0.32em] text-white/80">
                          {isPending ? "Confirming Wallet..." : "Deploying Pools..."}
                        </span>
                      </span>
                    ) : (
                      <span
                        className={`tabular text-[12px] uppercase tracking-[0.32em] ${
                          isValid ? "text-white" : "text-white/30"
                        }`}
                      >
                        Launch Prediction Market
                      </span>
                    )}
                  </button>
                )}
              </div>
            </SpotlightCard>
          </form>
        )}
      </section>
    </div>
  );
}
