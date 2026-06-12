import { useState, type ReactNode } from "react";
import {
  Lock,
  Loader2,
  CheckCircle,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { AttackPresets } from "./attack-presets";
import { BorrowDemoTab } from "./borrow-demo-tab";
import type { DemoManifest } from "@/hooks/useDemoManifest";

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

const TABS: { key: TabKey; label: string }[] = [
  { key: "swap", label: "Swap" },
  { key: "borrow", label: "Borrow" },
  { key: "manage", label: "Manage" },
  { key: "provide", label: "Provide" },
  { key: "redeem", label: "Redeem" },
];

const sanitize = (v: string) => v.replace(/[^0-9.]/g, "");

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
}: {
  state: ButtonState;
  approveLabel: string;
  readyLabel: string;
  onClick?: () => void;
}) {
  const base =
    "w-full mt-6 py-4 rounded-xl border font-medium tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300 overflow-hidden whitespace-nowrap uppercase";

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
        className={`${base} bg-white text-black hover:bg-gray-200 border-transparent shadow-[0_0_20px_rgba(255,255,255,0.2)]`}
      >
        {readyLabel}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`${base} bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/[0.05] hover:border-white/20 hover:text-white`}
    >
      <Lock size={14} />
      {approveLabel}
    </button>
  );
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

/* ---------------- SWAP (real attack presets) ---------------- */
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
  if (!poolWeth || !conditionId) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
        <span className="text-xs text-[#8B8D98] uppercase tracking-widest">
          Market not loaded
        </span>
        <span className="text-[10px] text-white/30">
          Connect to the live demo market to execute trades.
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
        Buy YES · live on-chain
      </span>
      <AttackPresets
        pool={poolWeth}
        conditionId={conditionId as `0x${string}`}
        yesPrice={yesPrice}
        onConfirmed={onConfirmed ?? (() => {})}
        router={router}
      />
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
  return <BorrowDemoTab manifest={manifest} onConfirmed={onConfirmed} />;
}

/* ---------------- MANAGE ---------------- */
function ManageTab() {
  const [mode, setMode] = useState<"repay" | "withdraw">("repay");
  const [amount, setAmount] = useState<string>("");
  const health = 1.84;
  const healthColor =
    health > 1.5
      ? "text-emerald-400"
      : health > 1.1
      ? "text-orange-400"
      : "text-red-400";

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
          { label: "Collateral", value: "1.5 WETH" },
          { label: "Debt", value: "2,000 USDC" },
          {
            label: "Health",
            value: <span className={healthColor}>{health.toFixed(2)}</span>,
          },
        ].map((c, i) => (
          <div key={i} className="bg-[#0E0E11] p-4 flex flex-col gap-1.5">
            <span className="text-[10px] text-[#8B8D98] uppercase tracking-widest">
              {c.label}
            </span>
            <span
              className="text-sm text-white font-mono"
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
        balance={mode === "repay" ? "1,820.50" : "1.5"}
        value={amount}
        onChange={setAmount}
      />
    </div>
  );
}

/* ---------------- PROVIDE ---------------- */
function ProvideTab() {
  const [deposit, setDeposit] = useState<string>("");
  const lp = deposit ? (Number(deposit) * 0.97).toFixed(2) : "";

  return (
    <div className="flex flex-col gap-3">
      <AmountInput
        label="Deposit"
        asset="USDC"
        assetClass="bg-sky-500/10 text-sky-300"
        balance="1,820.50"
        value={deposit}
        onChange={setDeposit}
      />
      <Readout label="Estimated LP Shares" asset="LP" value={lp} />
      <MetaRow
        items={[
          { label: "Pool Liquidity", value: "$1.24M" },
          { label: "Est. APY", value: "12.4%" },
          { label: "Your Share", value: "0.08%" },
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

  // Swap and Borrow tabs render their own real execution buttons (AttackPresets /
  // BorrowDemoTab); the shared bottom button is only for the visual-only tabs.
  const wiredTabs: TabKey[] = ["swap", "borrow"];
  const showBottomButton = !wiredTabs.includes(tab);

  const labels: Record<TabKey, { approve: string; ready: string }> = {
    swap: { approve: "Approve USDC", ready: "Swap Shares" },
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
        {tab === "manage" && <ManageTab />}
        {tab === "provide" && <ProvideTab />}
        {tab === "redeem" && <RedeemTab />}
      </div>

      {/* Execute Button — only for the visual-only tabs */}
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