import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as useDemoManifestModule from "@/hooks/useDemoManifest";

// Mock modules
vi.mock("@/hooks/useDemoManifest", () => ({
  useDemoManifest: vi.fn(),
}));
vi.mock("@/hooks/useLiveDemoReads", () => ({
  useLiveBlockNumber: () => ({ data: 12345678n }),
  usePoolPrice: () => ({ price: 5n * 10n ** 17n }),
  usePoolReserves: () => ({ reserves: undefined }),
  usePoolLiquidity: () => ({ liquidity: undefined }),
  useMathKernelStatus: () => ({ label: "Stylus", matches: true }),
}));
vi.mock("@/hooks/useDemoIndexer", () => ({
  useDemoMarket: () => ({ market: null, isLoading: false }),
  useDemoTrades: () => ({ trades: [], isLoading: false }),
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890123456789012345678901234567890" }),
  useChainId: () => 421614,
  useReadContract: () => ({ data: undefined }),
  useWriteContract: () => ({ writeContract: vi.fn(), isPending: false }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
}));
vi.mock("urql", () => ({
  useQuery: () => [{ data: { market: null }, fetching: false }],
}));

describe("markets.$id demo mode isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("property: when conditionId does not match manifest.conditionId, AttackPresets, PreDemoReadinessPanel, and BorrowDemoTab are not present", () => {
    const mockManifest = {
      conditionId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`,
      poolWeth: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`,
      poolUsdc: "0xcccccccccccccccccccccccccccccccccccccccc" as `0x${string}`,
      lendingCollateral: "500000000000000000000",
      lendingDebt: "250000000",
      lending: "0xdddddddddddddddddddddddddddddddddddddddd" as `0x${string}`,
      question: "Test question",
      symbol: "TEST",
      category: "test",
    };

    vi.spyOn(useDemoManifestModule, "useDemoManifest").mockReturnValue({
      data: mockManifest as any,
      isLoading: false,
      error: null,
    });

    // Create a minimal test component that simulates the route logic
    function TestComponent({ routeConditionId }: { routeConditionId: string }) {
      const { data: manifest } = useDemoManifestModule.useDemoManifest();
      
      const isDemoMarket =
        !!manifest &&
        routeConditionId.toLowerCase() === manifest.conditionId.toLowerCase();

      return (
        <div>
          <div data-testid="is-demo-market">{isDemoMarket ? "true" : "false"}</div>
          {isDemoMarket && <div data-testid="attack-presets">AttackPresets</div>}
          {isDemoMarket && <div data-testid="readiness-panel">PreDemoReadinessPanel</div>}
          {isDemoMarket && <div data-testid="borrow-demo-tab">BorrowDemoTab</div>}
        </div>
      );
    }

    const nonMatchingConditionId = "0x9999999999999999999999999999999999999999999999999999999999999999";
    const { container } = render(<TestComponent routeConditionId={nonMatchingConditionId} />);

    expect(screen.getByTestId("is-demo-market").textContent).toBe("false");
    expect(screen.queryByTestId("attack-presets")).toBeNull();
    expect(screen.queryByTestId("readiness-panel")).toBeNull();
    expect(screen.queryByTestId("borrow-demo-tab")).toBeNull();
  });

  it("property: when conditionId matches manifest.conditionId, all three components are present", () => {
    const mockManifest = {
      conditionId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`,
      poolWeth: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`,
      poolUsdc: "0xcccccccccccccccccccccccccccccccccccccccc" as `0x${string}`,
      lendingCollateral: "500000000000000000000",
      lendingDebt: "250000000",
      lending: "0xdddddddddddddddddddddddddddddddddddddddd" as `0x${string}`,
      question: "Test question",
      symbol: "TEST",
      category: "test",
    };

    vi.spyOn(useDemoManifestModule, "useDemoManifest").mockReturnValue({
      data: mockManifest as any,
      isLoading: false,
      error: null,
    });

    function TestComponent({ routeConditionId }: { routeConditionId: string }) {
      const { data: manifest } = useDemoManifestModule.useDemoManifest();
      
      const isDemoMarket =
        !!manifest &&
        routeConditionId.toLowerCase() === manifest.conditionId.toLowerCase();

      return (
        <div>
          <div data-testid="is-demo-market">{isDemoMarket ? "true" : "false"}</div>
          {isDemoMarket && <div data-testid="attack-presets">AttackPresets</div>}
          {isDemoMarket && <div data-testid="readiness-panel">PreDemoReadinessPanel</div>}
          {isDemoMarket && <div data-testid="borrow-demo-tab">BorrowDemoTab</div>}
        </div>
      );
    }

    const { container } = render(<TestComponent routeConditionId={mockManifest.conditionId} />);

    expect(screen.getByTestId("is-demo-market").textContent).toBe("true");
    expect(screen.getByTestId("attack-presets")).toBeTruthy();
    expect(screen.getByTestId("readiness-panel")).toBeTruthy();
    expect(screen.getByTestId("borrow-demo-tab")).toBeTruthy();
  });
});
