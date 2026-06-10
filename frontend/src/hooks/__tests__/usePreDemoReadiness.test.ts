import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePreDemoReadiness } from "../usePreDemoReadiness";

// Mock wagmi hooks
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890123456789012345678901234567890" }),
  useReadContract: vi.fn((opts) => {
    if (opts.functionName === "balanceOf") return { data: 15000000000000000000000n }; // 15k WETH
    if (opts.functionName === "allowance") return { data: 15000000000000000000000n }; // 15k WETH
    if (opts.functionName === "T")
      return { data: BigInt(Math.floor(Date.now() / 1000)) + 864000n * 2n }; // Expiry way in future
    return { data: undefined };
  }),
  useWriteContract: () => ({ writeContract: vi.fn() }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: true }),
  useBlockNumber: () => ({ data: 280000000n }),
  useChainId: () => 421614,
}));

// Mock custom hooks
vi.mock("../useLiveDemoReads", () => ({
  usePoolPrice: () => ({ price: 500000000000000000n }), // 0.5
}));

// Mock urql
vi.mock("urql", () => ({
  useQuery: () => [{ data: { market: { id: "0xabc" } }, fetching: false }],
}));

const mockManifest = {
  runId: "test",
  createdBlock: 270000000,
  question: "Test?",
  symbol: "TEST",
  conditionId: "0xabc",
  poolWeth: "0xpool",
  wethMarketId: "1",
  usdcMarketId: "2",
  poolUsdc: "0xpoolUsdc",
  yesWethId: "1",
  noWethId: "2",
  factory: "0xfactory",
  resolver: "0xresolver",
  math: "0xmath",
  demoAccount: "0xdemo",
  weth: "0xweth",
  usdc: "0xusdc",
  l0: "5000",
  gammaPrime: "2",
  initialLiquidityYes: "5000",
  initialLiquidityNo: "5000",
  lending: "0xlending",
  lendingSeed: "seed",
  lendingCollateral: "500",
  lendingDebt: "250",
} as any;

describe("usePreDemoReadiness", () => {
  it("evaluates all checks as passing on happy path", () => {
    const { result } = renderHook(() => usePreDemoReadiness(mockManifest, "0xpool"));

    // Check 11: allPass Consistency
    expect(result.current.checks.filter((c) => c.status !== "pass").map((c) => c.label)).toEqual(
      [],
    );
    expect(result.current.allPass).toBe(true);
    expect(result.current.checks.every((c) => c.status === "pass")).toBe(true);
    expect(result.current.checks.length).toBe(8);
  });
});
