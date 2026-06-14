import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Lock,
  Loader2,
  CheckCircle,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, parseGwei, formatUnits } from "viem";
import Erc20Abi from "@/abis/ERC20.abi.json";
import OmniverseRouterAbi from "@/abis/OmniverseRouter.abi.json";
import MultiverseLendingAbi from "@/abis/MultiverseLending.abi.json";
import PmAmmPoolAbi from "@/abis/PmAmmPool.abi.json";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import type { DemoManifest } from "@/hooks/useDemoManifest";
import type { TxState } from "@/hooks/useAttackPresets";
import { arbiscanTxUrl } from "@/lib/formatters";

type TabKey = "swap" | "borrow" | "manage" | "provide" | "redeem";

export interface ExecutionTerminalProps {
  poolWeth?: `0x${string}`;
  poolUsdc?: `0x${string}`;
  lending?: `0x${string}`;
  yesPrice?: number;
  conditionId?: string;
  manifest?: DemoManifest | null;
  onConfirmed?: () => void;
}
type ButtonState = "approve" | "executing" | "ready";

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const MAX_UINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// Every writeContract needs explicit gas or MetaMask estimation fails / shows absurd fees.
const GAS_CONFIG = {
  gas: 1_500_000n,
  maxPriorityFeePerGas: parseGwei("0.02"),
  maxFeePerGas: parseGwei("0.2"),
} as const;

const TABS: { key: TabKey; label: string }[] = [
  { key: "swap", label: "Swap" },
  { key: "borrow", label: "Borrow" },
  { key: "manage", label: "Manage" },
  { key: "provide", label: "Provide" },
  { key: "redeem", label: "Redeem" },
];

const sanitize = (v: string) => v.replace(/[^0-9.]/g, "");

function toWad(v: string): bigint {
  try {
    return v ? parseUnits(v, 18) : 0n;
  } catch {
    return 0n;
  }
}

function decodeTxError(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string } | null;
  const msg = err?.shortMessage || err?.message || "Transaction failed";
  if (/slippage/i.test(msg)) return "Price moved before your trade landed. Try the next preset size.";
  if (/frozen/i.test(msg)) return "Pool is frozen — too close to expiry.";
  return msg;
}

/* ---------------- Shared wallet reads ---------------- */
function useWethReads(spender: `0x${string}`) {
  const { address } = useAccount();
  const { data: balanceRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.WETH,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: [address ?? ZERO],
    query: { enabled: !!address, refetchInterval: 4_000 },
  });
  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.WETH,
    abi: Erc20Abi,
    functionName: "allowance",
    args: [address ?? ZERO, spender],
    query: { enabled: !!address, refetchInterval: 4_000 },
  });
  return {
    address,
    balance: (balanceRaw as bigint | undefined) ?? 0n,
    allowance: (allowanceRaw as bigint | undefined) ?? 0n,
    refetchAllowance,
  };
}

/* ---------------- Shared two-step (approve → action) tx ---------------- */
function useRouterAction(onConfirmed?: () => void) {
  const [txState, setTxState] = useState<TxState>({ phase: "idle" });
  const firedRef = useRef(false);

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: approvePending,
  } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash });

  const {
    writeContract: writeAction,
    data: actionHash,
    isPending: actionPending,
    isError: actionError,
    error,
  } = useWriteContract();
  const {
    isLoading: actionConfirming,
    isSuccess: actionSuccess,
    isError: receiptError,
    error: receiptErr,
  } = useWaitForTransactionReceipt({ hash: actionHash });

  useEffect(() => {
    if (approvePending || approveConfirming) setTxState({ phase: "wallet" });
    else if (approveSuccess) setTxState({ phase: "idle" });
  }, [approvePending, approveConfirming, approveSuccess]);

  useEffect(() => {
    if (actionPending) setTxState({ phase: "wallet" });
    else if (actionHash && actionConfirming) setTxState({ phase: "pending", hash: actionHash });
    else if (actionSuccess && actionHash) {
      setTxState({ phase: "confirmed", hash: actionHash });
      if (!firedRef.current) {
        firedRef.current = true;
        onConfirmed?.();
      }
    } else if (actionError || receiptError) {
      setTxState({ phase: "failed", error: decodeTxError(error || receiptErr) });
    }
  }, [
    actionPending,
    actionHash,
    actionConfirming,
    actionSuccess,
    actionError,
    receiptError,
    error,
    receiptErr,
    onConfirmed,
  ]);

  return { txState, writeApprove, writeAction, approveSuccess };
}

/* ---------------- Universal Input ---------------- */
function AmountInput({
  label,
  asset,
  assetClass = "bg-indigo-500/10 text-indigo-300",
  balance,
  value,
  onChange,
  placeholder = "0.00",
}: {
  label: string;
  asset: string;
  assetClass?: string;
  balance: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex flex-col gap-3 p-5 bg-white/[0.02] border border-white/5 rounded-xl transition-colors focus-within:bg-white/[0.04] focus-within:border-white/20">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
          {label}
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${assetClass}`}
        >
          {asset}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-4xl text-[#F3F4F6] placeholder-white/20 font-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
        <span className="text-[10px] text-[#8B8D98] whitespace-nowrap pb-1">
          Balance: {balance}
        </span>
      </div>
    </div>
  );
}

/* ---------------- Readout (recessed) ---------------- */
function Readout({
  label,
  asset,
  value,
}: {
  label: string;
  asset: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-2 p-5 bg-black/20 border border-white/5 rounded-xl">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
          {label}
        </span>
        <span className="text-[10px] text-[#8B8D98] uppercase tracking-wider">
          {asset}
        </span>
      </div>
      <span
        className="text-3xl text-white font-mono"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value || "0.00"}
      </span>
    </div>
  );
}

/* ---------------- Two-step Button ---------------- */
function ExecuteButton({
  state,
  approveLabel,
  readyLabel,
  onClick,
  disabled,
}: {
  state: ButtonState;
  approveLabel: string;
  readyLabel: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const base =
    "w-full mt-6 py-4 rounded-xl border font-medium tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300 overflow-hidden whitespace-nowrap uppercase disabled:opacity-40 disabled:cursor-not-allowed";

  if (state === "executing") {
    return (
      <button
        disabled
        className={`${base} bg-white/[0.05] border-white/20 text-white`}
      >
        <Loader2 className="animate-spin" size={16} />
        Signing...
      </button>
    );
  }
  if (state === "ready") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${base} bg-white text-black hover:bg-gray-200 border-transparent shadow-[0_0_20px_rgba(255,255,255,0.2)]`}
      >
        {readyLabel}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/[0.05] hover:border-white/20 hover:text-white`}
    >
      <Lock size={14} />
      {approveLabel}
    </button>
  );
}

/* ---------------- Tx status line ---------------- */
function TxStatus({ txState }: { txState: TxState }) {
  if (txState.phase === "confirmed") {
    return (
      <div className="mt-3 rounded border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-400">
        Confirmed ✓
        {txState.hash && (
          <a
            href={arbiscanTxUrl(txState.hash)}
            target="_blank"
            rel="noreferrer"
            className="ml-2 underline"
          >
            View on Arbiscan
          </a>
        )}
      </div>
    );
  }
  if (txState.phase === "failed") {
    return (
      <div className="mt-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
        {txState.error}
      </div>
    );
  }
  if (txState.phase === "pending") {
    return (
      <div className="mt-3 rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
        Transaction pending on Arbitrum Sepolia…
      </div>
    );
  }
  return null;
}

/* ---------------- Meta Row ---------------- */
function MetaRow({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="flex justify-between mt-4 px-1">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-1">
          <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
            {it.label}
          </span>
          <span
            className="text-xs text-white/80 font-mono"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const SWAP_PRESETS = [
  { label: "Probe", amount: "2000" },
  { label: "Whale", amount: "4000" },
  { label: "Kill Shot", amount: "6000" },
];

/* ---------------- SWAP (real buyYes / buyNo) ---------------- */
function SwapTab({
  poolWeth,
  conditionId,
  yesPrice,
  router,
  onConfirmed,
}: {
  poolWeth?: `0x${string}`;
  conditionId?: string;
  yesPrice: number;
  router?: `0x${string}`;
  onConfirmed?: () => void;
}) {
  const routerAddress = (router ?? CONTRACT_ADDRESSES.OmniverseRouter) as `0x${string}`;
  const { address, balance, allowance, refetchAllowance } = useWethReads(routerAddress);
  const { txState, writeApprove, writeAction, approveSuccess } = useRouterAction(onConfirmed);

  const [side, setSide] = useState<"yes" | "no">("yes");
  const [pay, setPay] = useState<string>("");

  useEffect(() => {
    if (approveSuccess) refetchAllowance();
  }, [approveSuccess, refetchAllowance]);

  const yes = yesPrice > 0 && yesPrice < 1 ? yesPrice : 0.5;
  const price = side === "yes" ? yes : 1 - yes;
  const amountWad = toWad(pay);
  const expectedOut = price > 0 && pay ? Number(pay) / price : 0;
  const shares = expectedOut ? expectedOut.toFixed(2) : "";

  const ready = !!poolWeth && !!conditionId && !!address && amountWad > 0n;
  const needsApprove = allowance < amountWad;
  const pending = txState.phase === "wallet" || txState.phase === "pending";
  const frozen = txState.phase === "failed" && txState.error?.toLowerCase().includes("frozen");
  const btnState: ButtonState = pending ? "executing" : needsApprove ? "approve" : "ready";

  const handle = () => {
    if (!ready || frozen) return;
    if (needsApprove) {
      writeApprove({
        address: CONTRACT_ADDRESSES.WETH,
        abi: Erc20Abi,
        functionName: "approve",
        args: [routerAddress, MAX_UINT256],
        ...GAS_CONFIG,
      });
      return;
    }
    // minOut = 0: the demo pool is deliberately shallow so trades move the price a lot
    // (that's the point of the "attack"). A 5% slippage cap reverts here, and a reverting
    // tx makes MetaMask show an absurd fallback gas fee. Slippage protection is not
    // meaningful for a scripted testnet demo, so accept any output.
    const minOut = 0n;
    writeAction({
      address: routerAddress,
      abi: OmniverseRouterAbi,
      functionName: side === "yes" ? "buyYes" : "buyNo",
      args: [poolWeth, conditionId as `0x${string}`, amountWad, minOut],
      ...GAS_CONFIG,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* YES / NO toggle */}
      <div className="flex p-1 bg-[#08080A] border border-white/5 rounded-lg">
        <button
          onClick={() => setSide("yes")}
          className={`flex-1 py-2 text-xs uppercase tracking-widest rounded-md transition-colors ${
            side === "yes"
              ? "bg-emerald-500/20 text-emerald-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
              : "text-[#8B8D98] hover:text-white"
          }`}
        >
          Yes · {yes.toFixed(2)}
        </button>
        <button
          onClick={() => setSide("no")}
          className={`flex-1 py-2 text-xs uppercase tracking-widest rounded-md transition-colors ${
            side === "no"
              ? "bg-red-500/20 text-red-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
              : "text-[#8B8D98] hover:text-white"
          }`}
        >
          No · {(1 - yes).toFixed(2)}
        </button>
      </div>

      <AmountInput
        label="Pay"
        asset="WETH"
        assetClass="bg-indigo-500/10 text-indigo-300"
        balance={`${Number(formatUnits(balance, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        value={pay}
        onChange={setPay}
      />

      {/* Quick-fill attack presets */}
      <div className="flex gap-2">
        {SWAP_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPay(p.amount)}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] py-2 text-[10px] uppercase tracking-widest text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            {p.label} · {Number(p.amount) / 1000}k
          </button>
        ))}
      </div>

      <Readout
        label="Receive · Est. Shares"
        asset={side === "yes" ? "YES" : "NO"}
        value={shares}
      />
      <MetaRow
        items={[
          { label: "Max Slippage", value: "Unlimited" },
          { label: "Pool", value: "WETH" },
          { label: "Gas", value: "0.2 gwei" },
        ]}
      />

      <ExecuteButton
        state={btnState}
        approveLabel="Approve WETH"
        readyLabel={frozen ? "Pool Frozen" : side === "yes" ? "Buy YES" : "Buy NO"}
        onClick={handle}
        disabled={!ready || frozen}
      />
      <TxStatus txState={txState} />
    </div>
  );
}

/* ---------------- BORROW (real executeBorrow) ---------------- */
function BorrowTab({
  manifest,
  onConfirmed,
}: {
  manifest?: DemoManifest | null;
  onConfirmed?: () => void;
}) {
  const routerAddress = (manifest?.router ?? CONTRACT_ADDRESSES.OmniverseRouter) as `0x${string}`;
  const { address, balance, allowance, refetchAllowance } = useWethReads(routerAddress);
  const { txState, writeApprove, writeAction, approveSuccess } = useRouterAction(onConfirmed);

  // Pre-fill from manifest (WAD / 1e18). Both WETH and USDC are 18-decimal here.
  const defaultCollateral = manifest ? (Number(manifest.lendingCollateral) / 1e18).toString() : "";
  const defaultBorrow = manifest ? (Number(manifest.lendingDebt) / 1e18).toString() : "";
  const [collateral, setCollateral] = useState(defaultCollateral);
  const [borrow, setBorrow] = useState(defaultBorrow);

  useEffect(() => {
    if (approveSuccess) refetchAllowance();
  }, [approveSuccess, refetchAllowance]);

  if (!manifest) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
        <span className="text-xs text-[#8B8D98] uppercase tracking-widest">
          Borrow unavailable
        </span>
        <span className="text-[10px] text-white/30">
          The demo manifest could not be loaded.
        </span>
      </div>
    );
  }

  const wethCollateral = toWad(collateral);
  const usdcBorrow = toWad(borrow);
  const ltv = parseFloat(collateral) > 0 ? (parseFloat(borrow) / parseFloat(collateral)) * 100 : 0;

  const ready = !!address && wethCollateral > 0n && usdcBorrow > 0n;
  const needsApprove = allowance < wethCollateral;
  const pending = txState.phase === "wallet" || txState.phase === "pending";
  const btnState: ButtonState = pending ? "executing" : needsApprove ? "approve" : "ready";

  const handle = () => {
    if (!ready) return;
    if (needsApprove) {
      writeApprove({
        address: CONTRACT_ADDRESSES.WETH,
        abi: Erc20Abi,
        functionName: "approve",
        args: [routerAddress, MAX_UINT256],
        ...GAS_CONFIG,
      });
      return;
    }
    // router.executeBorrow(lending, conditionId, weth, usdc)
    writeAction({
      address: routerAddress,
      abi: OmniverseRouterAbi,
      functionName: "executeBorrow",
      args: [manifest.lending, manifest.conditionId, wethCollateral, usdcBorrow],
      ...GAS_CONFIG,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <AmountInput
        label="Collateral"
        asset="WETH"
        assetClass="bg-indigo-500/10 text-indigo-300"
        balance={`${Number(formatUnits(balance, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        value={collateral}
        onChange={setCollateral}
      />
      <AmountInput
        label="Borrow Against"
        asset="USDC"
        assetClass="bg-sky-500/10 text-sky-300"
        balance="—"
        value={borrow}
        onChange={setBorrow}
      />

      {/* LTV Bar */}
      <div className="mt-2 flex flex-col gap-2 px-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
            Loan to Value
          </span>
          <span
            className="text-[10px] text-emerald-300 font-mono"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {ltv.toFixed(1)}%
          </span>
        </div>
        <div className="h-[2px] w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, ltv)}%` }}
          />
        </div>
      </div>

      <MetaRow
        items={[
          { label: "Health", value: "∞" },
          { label: "Liquidation", value: "None" },
          { label: "Gas", value: "0.2 gwei" },
        ]}
      />

      <ExecuteButton
        state={btnState}
        approveLabel="Approve WETH"
        readyLabel="Execute Borrow"
        onClick={handle}
        disabled={!ready}
      />
      <TxStatus txState={txState} />
    </div>
  );
}

/* ---------------- MANAGE ---------------- */
function ManageTab({ lending }: { lending?: `0x${string}` }) {
  const { address } = useAccount();
  const [mode, setMode] = useState<"repay" | "withdraw">("repay");
  const [amount, setAmount] = useState<string>("");

  const lendingAddress = lending ?? CONTRACT_ADDRESSES.MultiverseLending;

  const { data: collateralRaw, isLoading: collateralLoading, isError: collateralError } = useReadContract({
    address: lendingAddress,
    abi: MultiverseLendingAbi,
    functionName: "collateralOf",
    args: [address ?? ZERO],
    query: { enabled: !!address, refetchInterval: 5_000 },
  });

  const { data: debtRaw, isLoading: debtLoading, isError: debtError } = useReadContract({
    address: lendingAddress,
    abi: MultiverseLendingAbi,
    functionName: "debtOf",
    args: [address ?? ZERO],
    query: { enabled: !!address, refetchInterval: 5_000 },
  });

  const { data: healthRaw, isLoading: healthLoading, isError: healthError } = useReadContract({
    address: lendingAddress,
    abi: MultiverseLendingAbi,
    functionName: "healthFactor",
    args: [address ?? ZERO],
    query: { enabled: !!address, refetchInterval: 5_000 },
  });

  const collateralWad = (collateralRaw as bigint | undefined) ?? 0n;
  const debtWad = (debtRaw as bigint | undefined) ?? 0n;
  const healthWad = (healthRaw as bigint | undefined) ?? 0n;

  const isLoading = collateralLoading || debtLoading || healthLoading;
  const hasError = collateralError || debtError || healthError;

  const collateral = isLoading ? "⋯" : hasError ? "error" : `${(Number(collateralWad) / 1e18).toFixed(2)} WETH`;
  const debt = isLoading ? "⋯" : hasError ? "error" : `${(Number(debtWad) / 1e18).toFixed(0)} USDC`;
  const healthNum = Number(healthWad) / 1e18;
  const health = isLoading ? "⋯" : hasError ? "error" : healthNum > 0 ? healthNum.toFixed(2) : "∞";
  const healthColor = hasError ? "text-red-400" : healthNum === 0 || !isFinite(healthNum) ? "text-emerald-400" : healthNum < 1.2 ? "text-red-400" : healthNum < 1.5 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="flex p-1 bg-[#08080A] border border-white/5 rounded-lg">
        <button
          onClick={() => setMode("repay")}
          className={`flex-1 py-2 text-xs uppercase tracking-widest rounded-md flex items-center justify-center gap-1.5 transition-colors ${
            mode === "repay"
              ? "bg-white/10 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
              : "text-[#8B8D98] hover:text-white"
          }`}
        >
          <ArrowUp size={14} />
          Repay Debt
        </button>
        <button
          onClick={() => setMode("withdraw")}
          className={`flex-1 py-2 text-xs uppercase tracking-widest rounded-md flex items-center justify-center gap-1.5 transition-colors ${
            mode === "withdraw"
              ? "bg-white/10 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
              : "text-[#8B8D98] hover:text-white"
          }`}
        >
          <ArrowDown size={14} />
          Withdraw
        </button>
      </div>

      {/* Portfolio dashboard */}
      <div className="grid grid-cols-3 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden">
        {[
          { label: "Collateral", value: collateral },
          { label: "Debt", value: debt },
          { label: "Health", value: health, className: healthColor },
        ].map((c, i) => (
          <div key={i} className="bg-[#0E0E11] p-4 flex flex-col gap-1.5">
            <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
              {c.label}
            </span>
            <span
              className={`text-sm font-mono ${c.className || "text-white"}`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {c.value}
            </span>
          </div>
        ))}
      </div>

      <AmountInput
        label={mode === "repay" ? "Repay Amount" : "Withdraw Amount"}
        asset={mode === "repay" ? "USDC" : "WETH"}
        assetClass={
          mode === "repay"
            ? "bg-sky-500/10 text-sky-300"
            : "bg-indigo-500/10 text-indigo-300"
        }
        balance="—"
        value={amount}
        onChange={setAmount}
      />
    </div>
  );
}

/* ---------------- PROVIDE ---------------- */
function ProvideTab({ poolWeth, poolUsdc, manifest }: { poolWeth?: `0x${string}`; poolUsdc?: `0x${string}`; manifest?: DemoManifest | null }) {
  const { address } = useAccount();
  const [deposit, setDeposit] = useState<string>("");
  const lp = deposit ? (Number(deposit) * 0.97).toFixed(2) : "";

  const pool = poolUsdc ?? poolWeth ?? ZERO;

  const { data: reservesRaw, isLoading: reservesLoading, isError: reservesError } = useReadContract({
    address: pool,
    abi: PmAmmPoolAbi,
    functionName: "getReserves",
    query: { enabled: !!pool && pool !== ZERO, refetchInterval: 5_000 },
  });

  const { data: totalSharesRaw, isLoading: totalSharesLoading, isError: totalSharesError } = useReadContract({
    address: pool,
    abi: PmAmmPoolAbi,
    functionName: "totalShares",
    query: { enabled: !!pool && pool !== ZERO, refetchInterval: 5_000 },
  });

  const { data: userSharesRaw, isLoading: userSharesLoading, isError: userSharesError } = useReadContract({
    address: pool,
    abi: PmAmmPoolAbi,
    functionName: "sharesOf",
    args: [address ?? ZERO],
    query: { enabled: !!address && !!pool && pool !== ZERO, refetchInterval: 5_000 },
  });

  const reserves = reservesRaw as [bigint, bigint, bigint, bigint, bigint, bigint, bigint] | undefined;
  const xActive = reserves?.[0] ?? 0n;
  const yActive = reserves?.[2] ?? 0n;

  // For USDC pool, liquidity is already in USD
  // For WETH pool, convert using fixed $3000 WETH price
  const isWethPool = pool === poolWeth;
  const wethPrice = 3000n * 10n ** 18n;
  const liquidityWad = isWethPool 
    ? (xActive * wethPrice / 10n ** 18n) + yActive 
    : xActive + yActive;

  const totalShares = (totalSharesRaw as bigint | undefined) ?? 0n;
  const userShares = (userSharesRaw as bigint | undefined) ?? 0n;
  const userSharePct = totalShares > 0n ? (Number(userShares) / Number(totalShares)) * 100 : 0;

  const isLoading = reservesLoading || totalSharesLoading || userSharesLoading;
  const hasError = reservesError || totalSharesError || userSharesError;

  const liquidity = isLoading ? "⋯" : hasError ? "error" : liquidityWad > 0n ? `$${(Number(liquidityWad) / 1e18 / 1000).toFixed(1)}k` : "$0";
  const share = isLoading ? "⋯" : hasError ? "error" : userSharePct > 0 ? `${userSharePct.toFixed(2)}%` : "0%";

  return (
    <div className="flex flex-col gap-3">
      <AmountInput
        label="Deposit"
        asset="USDC"
        assetClass="bg-sky-500/10 text-sky-300"
        balance="—"
        value={deposit}
        onChange={setDeposit}
      />
      <Readout label="Estimated LP Shares" asset="LP" value={lp} />
      <MetaRow
        items={[
          { label: "Pool Liquidity", value: liquidity },
          { label: "Est. APY", value: "—" },
          { label: "Your Share", value: share },
        ]}
      />
    </div>
  );
}

/* ---------------- REDEEM ---------------- */
function RedeemTab() {
  return (
    <div className="flex flex-col items-center gap-4 py-8 px-4 bg-white/[0.02] border border-white/5 rounded-xl">
      <div className="grid place-items-center h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
        <CheckCircle className="text-emerald-400" size={32} />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xl text-white">Market Resolved</span>
        <span className="text-xs text-[#8B8D98] uppercase tracking-widest">
          Oracle Attested · Final
        </span>
      </div>
      <div className="w-full grid grid-cols-2 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden mt-2">
        <div className="bg-[#0E0E11] p-4 flex flex-col gap-1.5">
          <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
            Winning Shares
          </span>
          <span
            className="text-lg text-white font-mono"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            1,240.50
          </span>
        </div>
        <div className="bg-[#0E0E11] p-4 flex flex-col gap-1.5">
          <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
            Receivable
          </span>
          <span
            className="text-lg text-emerald-300 font-mono"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            1,240.50 USDC
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main ---------------- */
export function ExecutionTerminal({
  poolWeth,
  yesPrice = 0.5,
  conditionId,
  manifest,
  onConfirmed,
}: ExecutionTerminalProps) {
  const [tab, setTab] = useState<TabKey>("swap");
  const [btnState, setBtnState] = useState<ButtonState>("approve");

  // Swap and Borrow render their own real Execute buttons; the shared bottom
  // button is cosmetic and only used by the visual-only tabs.
  const wiredTabs: TabKey[] = ["swap", "borrow"];
  const showBottomButton = !wiredTabs.includes(tab);

  const labels: Record<TabKey, { approve: string; ready: string }> = {
    swap: { approve: "Approve WETH", ready: "Buy YES" },
    borrow: { approve: "Approve WETH", ready: "Execute Borrow" },
    manage: { approve: "Approve Asset", ready: "Confirm Manage" },
    provide: { approve: "Approve USDC", ready: "Provide Liquidity" },
    redeem: { approve: "Approve Burn", ready: "Redeem Winnings" },
  };

  const cycle = () => {
    setBtnState((s) =>
      s === "approve" ? "executing" : s === "executing" ? "ready" : "approve"
    );
  };

  return (
    <div className="w-full flex flex-col bg-[#0E0E11] border border-white/5 rounded-2xl overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      {/* Tab Strip */}
      <div className="flex p-1.5 mx-6 mt-6 bg-[#08080A] border border-white/5 rounded-xl">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 text-center py-2 text-xs font-medium tracking-widest uppercase transition-colors cursor-pointer ${
                active
                  ? "bg-white/10 text-white rounded-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                  : "text-[#8B8D98] hover:text-white"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="flex flex-col px-6 pt-6 flex-1 overflow-y-auto">
        {tab === "swap" && (
          <SwapTab
            poolWeth={poolWeth}
            conditionId={conditionId}
            yesPrice={yesPrice}
            router={manifest?.router}
            onConfirmed={onConfirmed}
          />
        )}
        {tab === "borrow" && <BorrowTab manifest={manifest} onConfirmed={onConfirmed} />}
        {tab === "manage" && <ManageTab lending={manifest?.lending} />}
        {tab === "provide" && <ProvideTab poolWeth={poolWeth} poolUsdc={manifest?.poolUsdc} manifest={manifest} />}
        {tab === "redeem" && <RedeemTab />}
      </div>

      {/* Execute Button — visual-only tabs */}
      {showBottomButton && (
        <div className="px-6 pb-6 mt-auto shrink-0">
          <ExecuteButton
            state={btnState}
            approveLabel={labels[tab].approve}
            readyLabel={labels[tab].ready}
            onClick={cycle}
          />
        </div>
      )}
    </div>
  );
}

export default ExecutionTerminal;
