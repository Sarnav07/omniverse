import { Loader2 } from "lucide-react";
import { Preset, TxState, useAttackPresets } from "@/hooks/useAttackPresets";
import { useEstimateGas } from "wagmi";
import { parseUnits } from "viem";
import OmniverseRouterAbi from "@/abis/OmniverseRouter.abi.json";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { useState } from "react";

interface AttackPresetsProps {
  pool: `0x${string}`;
  conditionId: `0x${string}`;
  yesPrice: number;
  onConfirmed: () => void;
  disabled?: boolean;
}

function PresetButton({ 
  preset, 
  execute, 
  disabled, 
  pool, 
  conditionId, 
  yesPrice 
}: { 
  preset: Preset; 
  execute: (p: Preset) => void; 
  disabled: boolean;
  pool: `0x${string}`;
  conditionId: `0x${string}`;
  yesPrice: number;
}) {
  const [hovered, setHovered] = useState(false);
  const amountWad = parseUnits(preset.amount, 18);
  const minOutFloat = (Number(preset.amount) / yesPrice) * 0.95;
  const minOut = parseUnits(minOutFloat.toFixed(18), 18);

  // Attempt to estimate gas when hovered
  const { data: gasEstimate } = useEstimateGas({
    address: CONTRACT_ADDRESSES.OmniverseRouter,
    abi: OmniverseRouterAbi,
    functionName: "buyYes",
    args: [pool, conditionId, amountWad, minOut],
    query: { enabled: hovered && !disabled },
  });

  return (
    <button
      disabled={disabled}
      onClick={() => execute(preset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex flex-col items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10 disabled:opacity-50"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="mb-1 text-sm font-medium text-white">{preset.label}</span>
      <span className="mb-2 text-xs text-white/50">{preset.description}</span>
      <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-white/90">
        {preset.amount} WETH
      </span>
      {hovered && gasEstimate && (
        <span className="absolute bottom-1 right-2 text-[9px] text-white/30">
          Gas: {gasEstimate.toString()}
        </span>
      )}
    </button>
  );
}

export function AttackPresets({ pool, conditionId, yesPrice, onConfirmed, disabled }: AttackPresetsProps) {
  const { presets, txState, execute } = useAttackPresets(pool, conditionId, yesPrice, onConfirmed);

  const isFrozenError = txState.phase === "failed" && txState.error?.includes("frozen");
  const isPending = txState.phase === "wallet" || txState.phase === "pending";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {presets.map((preset) => (
          <PresetButton
            key={preset.label}
            preset={preset}
            execute={execute}
            disabled={disabled || isFrozenError || isPending}
            pool={pool}
            conditionId={conditionId}
            yesPrice={yesPrice}
          />
        ))}
      </div>

      {txState.phase === "wallet" && (
        <div className="flex items-center justify-center gap-2 rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Waiting for wallet confirmation...</span>
        </div>
      )}

      {txState.phase === "pending" && (
        <div className="flex items-center justify-center gap-2 rounded border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Transaction pending on Arbitrum Sepolia...</span>
        </div>
      )}

      {txState.phase === "failed" && (
        <div className="rounded border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
          {txState.error}
        </div>
      )}
    </div>
  );
}
