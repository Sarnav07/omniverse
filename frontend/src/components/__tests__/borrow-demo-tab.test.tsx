import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BorrowDemoTab } from "../borrow-demo-tab";
import { DemoManifest } from "@/hooks/useDemoManifest";

// Mock wagmi hooks
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890123456789012345678901234567890" as `0x${string}` }),
  useReadContract: () => ({ data: false, refetch: vi.fn() }),
  useWriteContract: () => ({ 
    writeContract: vi.fn(), 
    data: undefined, 
    isPending: false, 
    isError: false, 
    error: null 
  }),
  useWaitForTransactionReceipt: () => ({ 
    isLoading: false, 
    isSuccess: false, 
    isError: false, 
    error: null 
  }),
}));

describe("BorrowDemoTab", () => {
  it("property: collateral input pre-fill equals manifest.lendingCollateral / 1e18", () => {
    const mockManifest: DemoManifest = {
      runId: "test-run",
      createdBlock: 12345678,
      question: "Will test pass?",
      symbol: "TEST",
      conditionId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`,
      wethMarketId: "test-weth-market",
      usdcMarketId: "test-usdc-market",
      poolWeth: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`,
      poolUsdc: "0xcccccccccccccccccccccccccccccccccccccccc" as `0x${string}`,
      yesWethId: "yes-weth",
      noWethId: "no-weth",
      factory: "0xfactoryfactoryfactoryfactoryfactoryfactory0001" as `0x${string}`,
      resolver: "0xresolverresolverresolverresolverresolver0001" as `0x${string}`,
      math: "0xmathmathmathmathmathmathmathmathmath00000001" as `0x${string}`,
      demoAccount: "0xdemoaccountdemoaccountdemoaccountdemo0001" as `0x${string}`,
      weth: "0xwethwethwethwethwethwethwethwethweth000001" as `0x${string}`,
      usdc: "0xusdcusdcusdcusdcusdcusdcusdcusdcusdc000001" as `0x${string}`,
      l0: "500000000000000000000000",
      gammaPrime: "100000000000000000",
      initialLiquidityYes: "1000000000000000000000",
      initialLiquidityNo: "1000000000000000000000",
      lending: "0xlendinglendinglendinglendinglendinglend0001" as `0x${string}`,
      lendingSeed: "1000000000000000000000",
      lendingCollateral: "500000000000000000000", // 500 WETH (18 decimals)
      lendingDebt: "250000000", // 250 USDC (6 decimals, but stored as string)
    };

    const { container } = render(<BorrowDemoTab manifest={mockManifest} />);

    // Find collateral input
    const collateralInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(collateralInput).toBeTruthy();

    const expectedCollateral = (Number(mockManifest.lendingCollateral) / 1e18).toString();
    expect(collateralInput.value).toBe(expectedCollateral);
    expect(collateralInput.value).toBe("500");
  });

  it("property: borrow input pre-fill equals manifest.lendingDebt / 1e6 (USDC decimals)", () => {
    const mockManifest: DemoManifest = {
      runId: "test-run",
      createdBlock: 12345678,
      question: "Will test pass?",
      symbol: "TEST",
      conditionId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`,
      wethMarketId: "test-weth-market",
      usdcMarketId: "test-usdc-market",
      poolWeth: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`,
      poolUsdc: "0xcccccccccccccccccccccccccccccccccccccccc" as `0x${string}`,
      yesWethId: "yes-weth",
      noWethId: "no-weth",
      factory: "0xfactoryfactoryfactoryfactoryfactoryfactory0001" as `0x${string}`,
      resolver: "0xresolverresolverresolverresolverresolver0001" as `0x${string}`,
      math: "0xmathmathmathmathmathmathmathmathmath00000001" as `0x${string}`,
      demoAccount: "0xdemoaccountdemoaccountdemoaccountdemo0001" as `0x${string}`,
      weth: "0xwethwethwethwethwethwethwethwethweth000001" as `0x${string}`,
      usdc: "0xusdcusdcusdcusdcusdcusdcusdcusdcusdc000001" as `0x${string}`,
      l0: "500000000000000000000000",
      gammaPrime: "100000000000000000",
      initialLiquidityYes: "1000000000000000000000",
      initialLiquidityNo: "1000000000000000000000",
      lending: "0xlendinglendinglendinglendinglendinglend0001" as `0x${string}`,
      lendingSeed: "1000000000000000000000",
      lendingCollateral: "500000000000000000000",
      lendingDebt: "250000000", // 250 USDC (6 decimals)
    };

    const { container } = render(<BorrowDemoTab manifest={mockManifest} />);

    // Find all number inputs (collateral is first, borrow is second)
    const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    const borrowInput = inputs[1];
    const expectedBorrow = (Number(mockManifest.lendingDebt) / 1e6).toString();
    expect(borrowInput.value).toBe(expectedBorrow);
    expect(borrowInput.value).toBe("250");
  });

  it("property: pre-fill accuracy for arbitrary manifest values", () => {
    const testCases = [
      { collateral: "1000000000000000000000", debt: "500000000", expectedCol: "1000", expectedDebt: "500" },
      { collateral: "250000000000000000000", debt: "125000000", expectedCol: "250", expectedDebt: "125" },
      { collateral: "750000000000000000000", debt: "375000000", expectedCol: "750", expectedDebt: "375" },
    ];

    testCases.forEach(({ collateral, debt, expectedCol, expectedDebt }) => {
      const mockManifest: DemoManifest = {
        runId: "test-run",
        createdBlock: 12345678,
        question: "Will test pass?",
        symbol: "TEST",
        conditionId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`,
        wethMarketId: "test-weth-market",
        usdcMarketId: "test-usdc-market",
        poolWeth: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`,
        poolUsdc: "0xcccccccccccccccccccccccccccccccccccccccc" as `0x${string}`,
        yesWethId: "yes-weth",
        noWethId: "no-weth",
        factory: "0xfactoryfactoryfactoryfactoryfactoryfactory0001" as `0x${string}`,
        resolver: "0xresolverresolverresolverresolverresolver0001" as `0x${string}`,
        math: "0xmathmathmathmathmathmathmathmathmath00000001" as `0x${string}`,
        demoAccount: "0xdemoaccountdemoaccountdemoaccountdemo0001" as `0x${string}`,
        weth: "0xwethwethwethwethwethwethwethwethweth000001" as `0x${string}`,
        usdc: "0xusdcusdcusdcusdcusdcusdcusdcusdcusdc000001" as `0x${string}`,
        l0: "500000000000000000000000",
        gammaPrime: "100000000000000000",
        initialLiquidityYes: "1000000000000000000000",
        initialLiquidityNo: "1000000000000000000000",
        lending: "0xlendinglendinglendinglendinglendinglend0001" as `0x${string}`,
        lendingSeed: "1000000000000000000000",
        lendingCollateral: collateral,
        lendingDebt: debt,
      };

      const { container } = render(<BorrowDemoTab manifest={mockManifest} />);
      const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;

      expect(inputs[0].value).toBe(expectedCol);
      expect(inputs[1].value).toBe(expectedDebt);
    });
  });
});
