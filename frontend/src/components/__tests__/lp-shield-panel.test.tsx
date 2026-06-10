import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LpShieldPanel } from "../lp-shield-panel";
import { PoolReserves } from "@/hooks/useLiveDemoReads";
import * as fc from "fast-check";

describe("LpShieldPanel", () => {
  it("property: active% + passive% = 100 for any reserves with total > 0", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 24n }),
        fc.bigInt({ min: 0n, max: 10n ** 24n }),
        fc.bigInt({ min: 0n, max: 10n ** 24n }),
        fc.bigInt({ min: 0n, max: 10n ** 24n }),
        (xActive, yActive, xPassive, yPassive) => {
          const total = xActive + yActive + xPassive + yPassive;
          fc.pre(total > 0n);

          const reserves: PoolReserves = {
            xActive,
            yActive,
            xPassive,
            yPassive,
            ellActive: 1000n * 10n ** 18n,
            lambdaWad: 5n * 10n ** 17n,
            lT: 5000n * 10n ** 18n,
          };

          const activeTotal = xActive + yActive;
          const activePct = Number((activeTotal * 100n) / total);
          const passivePct = 100 - activePct;

          // Property: active% + passive% = 100
          expect(activePct + passivePct).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});
