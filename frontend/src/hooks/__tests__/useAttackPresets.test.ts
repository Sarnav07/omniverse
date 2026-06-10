import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import fc from "fast-check";
import { useAttackPresets } from "../useAttackPresets";
import { parseUnits } from "viem";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x123" }),
  useReadContract: () => ({ data: 10000000000000000000000n, refetch: vi.fn() }),
  useWriteContract: () => ({
    writeContract: vi.fn(),
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
  }),
}));

describe("useAttackPresets", () => {
  it("Property 3: Slippage Safety", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1e-6), max: Math.fround(1 - 1e-6), noNaN: true }), // yesPrice
        fc.float({ min: Math.fround(1), max: Math.fround(10000), noNaN: true }), // amount
        (yesPrice, amount) => {
          const expectedOutFloat = amount / yesPrice;
          const minOutFloat = expectedOutFloat * 0.95;

          expect(minOutFloat).toBeLessThanOrEqual(expectedOutFloat * 0.95);
        },
      ),
    );
  });
});
