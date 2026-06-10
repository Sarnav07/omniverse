import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, parseGwei } from "viem";
import OmniverseRouterAbi from "@/abis/OmniverseRouter.abi.json";
import ConditionalTokensAbi from "@/abis/ConditionalTokens.abi.json";
import Erc20Abi from "@/abis/ERC20.abi.json";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { DemoManifest } from "@/hooks/useDemoManifest";
import { TxPhase, TxState } from "@/hooks/useAttackPresets";
import { Loader2 } from "lucide-react";

interface BorrowDemoTabProps {
  manifest: DemoManifest;
  onConfirmed?: () => void;
}

export function BorrowDemoTab({ manifest, onConfirmed }: BorrowDemoTabProps) {
  const { address: walletAddress } = useAccount();

  // Pre-fill from manifest: WETH collateral uses 18 decimals, USDC debt uses 6 decimals
  const defaultCollateral = (Number(manifest.lendingCollateral) / 1e18).toString();
  const defaultBorrow = (Number(manifest.lendingDebt) / 1e6).toString();

  const [collateral, setCollateral] = useState(defaultCollateral);
  const [borrow, setBorrow] = useState(defaultBorrow);
  const [txState, setTxState] = useState<TxState>({ phase: "idle" });

  const ltv = parseFloat(collateral) > 0 ? (parseFloat(borrow) / parseFloat(collateral)) * 100 : 0;

  const wethCollateral = parseUnits(collateral || "0", 18);
  const usdcBorrow = parseUnits(borrow || "0", 6); // USDC is 6 decimals

  // Check WETH approval
  const { data: wethAllowance, refetch: refetchApproval } = useReadContract({
    address: CONTRACT_ADDRESSES.WETH,
    abi: Erc20Abi,
    functionName: "allowance",
    args: [walletAddress ?? "0x0000000000000000000000000000000000000000", CONTRACT_ADDRESSES.OmniverseRouter],
    query: { enabled: !!walletAddress },
  });

  const isApproved = wethAllowance !== undefined && (wethAllowance as bigint) >= wethCollateral;

  // Approval write
  const { writeContract: writeApprove, data: approveTxHash } = useWriteContract();
  const { isLoading: isApprovePending, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });

  // Borrow write
  const { writeContract: writeBorrow, data: borrowTxHash, isPending: isBorrowWallet, isError: isBorrowError, error: borrowError } = useWriteContract();
  const { isLoading: isBorrowPending, isSuccess: isBorrowSuccess, isError: isReceiptError, error: receiptError } = useWaitForTransactionReceipt({ hash: borrowTxHash });

  // Approval flow
  useEffect(() => {
    if (isApprovePending) setTxState({ phase: "wallet" });
    if (isApproveSuccess) {
      refetchApproval();
      setTxState({ phase: "idle" });
    }
  }, [isApprovePending, isApproveSuccess, refetchApproval]);

  // Borrow flow
  useEffect(() => {
    if (isBorrowWallet) setTxState({ phase: "wallet" });
    if (borrowTxHash && isBorrowPending) setTxState({ phase: "pending", hash: borrowTxHash });
    if (isBorrowSuccess && borrowTxHash) {
      setTxState({ phase: "confirmed", hash: borrowTxHash });
      if (onConfirmed) onConfirmed();
    }
    if (isBorrowError || isReceiptError) {
      const err = (borrowError || receiptError) as Error | null;
      setTxState({ phase: "failed", error: err?.message || "Borrow failed" });
    }
  }, [isBorrowWallet, borrowTxHash, isBorrowPending, isBorrowSuccess, isBorrowError, isReceiptError, borrowError, receiptError, onConfirmed]);

  const handleSubmit = () => {
    if (!walletAddress) return;

    // Step 1: Approve if needed
    if (!isApproved) {
      writeApprove({
        address: CONTRACT_ADDRESSES.WETH,
        abi: Erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.OmniverseRouter, wethCollateral],
        maxPriorityFeePerGas: parseGwei("0.01"),
        maxFeePerGas: parseGwei("0.05"),
      });
      return;
    }

    // Step 2: Execute borrow
    writeBorrow({
      address: CONTRACT_ADDRESSES.OmniverseRouter,
      abi: OmniverseRouterAbi,
      functionName: "executeBorrow",
      args: [manifest.lending, manifest.conditionId as `0x${string}`, wethCollateral, usdcBorrow],
      maxPriorityFeePerGas: parseGwei("0.01"),
      maxFeePerGas: parseGwei("0.05"),
    });
  };

  const isPending = txState.phase === "wallet" || txState.phase === "pending";

  return (
    <div className="space-y-5 rounded-lg border border-white/10 bg-white/5 p-5">
      <div>
        <h3 className="text-sm font-medium text-white">Zero-Liquidation Borrow</h3>
        <p className="mt-1 text-xs text-white/50">
          Borrow USDC against YES tokens as collateral. No forced liquidations — settled at expiry.
        </p>
      </div>

      {/* Collateral input */}
      <div>
        <label className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/45">
          Collateral (WETH)
        </label>
        <input
          type="number"
          value={collateral}
          onChange={(e) => setCollateral(e.target.value)}
          className="w-full rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
          placeholder="500"
        />
      </div>

      {/* Borrow input */}
      <div>
        <label className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/45">
          Borrow (USDC)
        </label>
        <input
          type="number"
          value={borrow}
          onChange={(e) => setBorrow(e.target.value)}
          className="w-full rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
          placeholder="250"
        />
      </div>

      {/* LTV + health factor */}
      <div className="rounded border border-white/[0.06] bg-white/[0.02] p-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-white/45">LTV Ratio</span>
          <span className="font-mono text-white">{ltv.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/45">Health Factor</span>
          <span className="font-mono text-green-400">∞ (settled at expiry)</span>
        </div>
        <div className="border-t border-white/[0.05] pt-2 text-white/35">
          No forced liquidation. Borrow is resolved when market expires.
        </div>
      </div>

      {/* Approval step — prominent action when WETH not yet approved */}
      {!isApproved && walletAddress && (
        <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-yellow-400">
                Step 1 of 2 — WETH Approval
              </div>
              <div className="mt-0.5 text-[10px] text-yellow-400/60">
                The Router needs permission to move your WETH collateral
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="shrink-0 rounded border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-xs font-medium text-yellow-300 transition-all hover:bg-yellow-500/20 disabled:opacity-50"
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {txState.phase === "wallet" ? "Wallet..." : "Confirming..."}
                </span>
              ) : (
                "Approve"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Submit button — Execute Borrow (only active after approval) */}
      <button
        onClick={handleSubmit}
        disabled={!walletAddress || isPending || (!isApproved && !!walletAddress)}
        className="w-full rounded border border-white/10 bg-white/5 py-3 text-sm text-white transition-all hover:bg-white/10 disabled:opacity-50"
      >
        {isPending && isApproved ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {txState.phase === "wallet" ? "Waiting for wallet..." : "Confirming..."}
          </span>
        ) : isApproved ? (
          "Execute Borrow"
        ) : walletAddress ? (
          <span className="text-white/30">Step 2 of 2 — Execute Borrow</span>
        ) : (
          "Connect Wallet"
        )}
      </button>

      {txState.phase === "confirmed" && (
        <div className="rounded border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-400">
          Borrow confirmed! ✓
          {txState.hash && (
            <a
              href={`https://sepolia.arbiscan.io/tx/${txState.hash}`}
              target="_blank"
              rel="noreferrer"
              className="ml-2 underline"
            >
              View on Arbiscan
            </a>
          )}
        </div>
      )}

      {txState.phase === "failed" && (
        <div className="rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {txState.error}
        </div>
      )}
    </div>
  );
}
