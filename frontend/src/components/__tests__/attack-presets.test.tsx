import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { AttackPresets } from "../attack-presets";
import { useAttackPresets } from "@/hooks/useAttackPresets";

vi.mock("@/hooks/useAttackPresets");
vi.mock("wagmi", () => ({
  useEstimateGas: () => ({ data: 123456n }),
}));

describe("AttackPresets", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders 3 buttons with correct labels and amounts", () => {
    (useAttackPresets as any).mockReturnValue({
      presets: [
        { label: "Probe", amount: "2000", description: "desc 1" },
        { label: "Whale", amount: "4000", description: "desc 2" },
        { label: "Kill Shot", amount: "6000", description: "desc 3" }
      ],
      txState: { phase: "idle" },
      execute: vi.fn(),
    });

    render(<AttackPresets pool="0xpool" conditionId="0xcond" yesPrice={0.5} onConfirmed={vi.fn()} />);
    
    expect(screen.getByText("Probe")).toBeInTheDocument();
    expect(screen.getByText("2000 WETH")).toBeInTheDocument();
    expect(screen.getByText("Whale")).toBeInTheDocument();
    expect(screen.getByText("4000 WETH")).toBeInTheDocument();
    expect(screen.getByText("Kill Shot")).toBeInTheDocument();
    expect(screen.getByText("6000 WETH")).toBeInTheDocument();
  });

  it("disables buttons and shows error message on Frozen revert", () => {
    (useAttackPresets as any).mockReturnValue({
      presets: [
        { label: "Probe", amount: "2000", description: "desc 1" }
      ],
      txState: { phase: "failed", error: "Pool is frozen — too close to expiry." },
      execute: vi.fn(),
    });

    render(<AttackPresets pool="0xpool" conditionId="0xcond" yesPrice={0.5} onConfirmed={vi.fn()} />);
    
    expect(screen.getByText("Pool is frozen — too close to expiry.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Probe/i })).toBeDisabled();
  });
});
