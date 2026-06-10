import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { useState, useEffect } from "react";
import OmniverseRouterAbi from "@/abis/OmniverseRouter.abi.json";
import Erc20Abi from "@/abis/ERC20.abi.json";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { parseUnits } from "viem";

export type TxPhase = "idle" | "wallet" | "pending" | "confirmed" | "failed";

export type TxState = {
  phase: TxPhase;
  hash?: `0x${string}`;
  error?: string;
};

export type Preset = { label: string; amount: string; description: string };

const PRESETS: Preset[] = [
  { label: "Probe", amount: "2000", description: "Small test trade to check the waters" },
  { label: "Whale", amount: "4000", description: "Large trade, normally shifts market heavily" },
  { label: "Kill Shot", amount: "6000", description: "Massive trade meant to wipe out LP" },
];

export function useAttackPresets(
  pool: `0x${string}` | undefined,
  conditionId: `0x${string}` | undefined,
  yesPrice: number,
  onConfirmed?: () => void,
) {
  const { address: walletAddress } = useAccount();
  const [txState, setTxState] = useState<TxState>({ phase: "idle" });

  const { data: wethAllowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.WETH,
    abi: Erc20Abi,
    functionName: "allowance",
    args: [
      walletAddress ?? "0x0000000000000000000000000000000000000000",
      CONTRACT_ADDRESSES.OmniverseRouter,
    ],
    query: { enabled: !!walletAddress },
  });

  const { writeContract, data: txHash, isPending, isError, error } = useWriteContract();

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApproving,
  } = useWriteContract();
  const { isLoading: isConfirmingApprove, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const {
    isLoading: isConfirming,
    isSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // Handle Approve Tx
  useEffect(() => {
    if (isApproving || isConfirmingApprove) {
      setTxState({ phase: "wallet" });
    }
  }, [isApproving, isConfirmingApprove]);

  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
      // NOTE: User has to click the button again after approval in this simplified flow
      setTxState({ phase: "idle" });
    }
  }, [isApproveSuccess, refetchAllowance]);

  // Handle Swap Tx
  useEffect(() => {
    if (isPending) {
      setTxState({ phase: "wallet" });
    } else if (txHash && isConfirming) {
      setTxState({ phase: "pending", hash: txHash });
    } else if (isSuccess && txHash) {
      setTxState({ phase: "confirmed", hash: txHash });
      if (onConfirmed) onConfirmed();
    } else if (isError || isReceiptError) {
      const err = (error || receiptError) as any;
      let msg = "Transaction failed";

      // Basic decoding of custom errors
      if (err?.message?.includes("Slippage")) {
        msg = "Price moved before your trade landed. Try the next preset size.";
      } else if (err?.message?.includes("Frozen")) {
        msg = "Pool is frozen — too close to expiry. Contact team to extend T or deploy new pool.";
      } else {
        msg = err?.shortMessage || err?.message || msg;
      }

      setTxState({ phase: "failed", error: msg });
    }
  }, [
    isPending,
    txHash,
    isConfirming,
    isSuccess,
    isError,
    isReceiptError,
    error,
    receiptError,
    onConfirmed,
  ]);

  const execute = (preset: Preset) => {
    if (!pool || !conditionId) return;

    const amountWad = parseUnits(preset.amount, 18);

    // Check allowance
    if (wethAllowance < amountWad) {
      writeApprove({
        address: CONTRACT_ADDRESSES.WETH,
        abi: Erc20Abi,
        functionName: "approve",
        args: [
          CONTRACT_ADDRESSES.OmniverseRouter,
          115792089237316195423570985008687907853269984665640564039457584007913129639935n,
        ],
      });
      return;
    }

    // Slippage calc
    // expectedOut = (amountWad * 1e18) / yesPriceWad
    // yesPriceWad is yesPrice * 1e18, so expectedOut = amountWad / yesPrice
    const amountFloat = Number(preset.amount);
    const expectedOutFloat = amountFloat / yesPrice;

    // 5% slippage -> 95% minimum
    const minOutFloat = expectedOutFloat * 0.95;
    // We safely parse back to BigInt avoiding fractional decimals
    const minOut = parseUnits(minOutFloat.toFixed(18), 18);

    writeContract({
      address: CONTRACT_ADDRESSES.OmniverseRouter,
      abi: OmniverseRouterAbi,
      functionName: "buyYes",
      args: [pool, conditionId, amountWad, minOut],
    });
  };

  return { presets: PRESETS, txState, execute };
}
