import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { useState, useEffect } from "react";
import OmniverseRouterAbi from "@/abis/OmniverseRouter.abi.json";
import Erc20Abi from "@/abis/ERC20.abi.json";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { parseUnits } from "viem";

const MAX_UINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;

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
  router?: `0x${string}`,
) {
  const { address: walletAddress } = useAccount();
  const [txState, setTxState] = useState<TxState>({ phase: "idle" });

  // Prefer the manifest router (passed in); fall back to the verified-live config address.
  const routerAddress = router ?? CONTRACT_ADDRESSES.OmniverseRouter;

  const { data: wethBalanceRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.WETH,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!walletAddress, refetchInterval: 2_000 },
  });
  const wethBalance = (wethBalanceRaw as bigint | undefined) ?? 0n;

  const { data: wethAllowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.WETH,
    abi: Erc20Abi,
    functionName: "allowance",
    args: [walletAddress ?? "0x0000000000000000000000000000000000000000", routerAddress],
    query: { enabled: !!walletAddress, refetchInterval: 2_000 },
  });
  const wethAllowance = (wethAllowanceRaw as bigint | undefined) ?? 0n;

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

  const mintWeth = () => {
    const mintAmount = parseUnits("10000", 18);
    writeContract({
      address: CONTRACT_ADDRESSES.WETH,
      abi: [
        {
          name: "mint",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" }
          ],
          outputs: []
        }
      ],
      functionName: "mint",
      args: [walletAddress, mintAmount],
    });
  };

  const execute = (preset: Preset) => {
    if (!pool || !conditionId) return;

    const amountWad = parseUnits(preset.amount, 18);

    // Check balance first
    if (wethBalance < amountWad) {
      setTxState({ 
        phase: "failed", 
        error: `Insufficient WETH. You need ${preset.amount} WETH but have ${(Number(wethBalance) / 1e18).toFixed(2)} WETH. Use "Mint Test WETH" button.`
      });
      return;
    }

    // Check allowance — approve WETH (collateral) to the router, never ConditionalTokens.
    if (wethAllowance < amountWad) {
      writeApprove({
        address: CONTRACT_ADDRESSES.WETH,
        abi: Erc20Abi,
        functionName: "approve",
        args: [routerAddress, MAX_UINT256],
      });
      return;
    }

    // Slippage calc
    // expectedOut = (amountWad * 1e18) / yesPriceWad
    // yesPriceWad is yesPrice * 1e18, so expectedOut = amountWad / yesPrice
    const amountFloat = Number(preset.amount);
    const expectedOutFloat = amountFloat / yesPrice;

    // Wider slippage for rapid sequential trades (price shifts between presets)
    // Whale and Kill Shot: 25% (0.75), Probe: 15% (0.85)
    const slippageMultiplier = 
      preset.label === "Whale" || preset.label === "Kill Shot" ? 0.75 : 0.85;
    const minOutFloat = expectedOutFloat * slippageMultiplier;
    // We safely parse back to BigInt avoiding fractional decimals
    const minOut = parseUnits(minOutFloat.toFixed(18), 18);

    writeContract({
      address: routerAddress,
      abi: OmniverseRouterAbi,
      functionName: "buyYes",
      args: [pool, conditionId, amountWad, minOut],
      gas: 500000n,
    });
  };

  return { presets: PRESETS, txState, execute, mintWeth, wethBalance };
}
