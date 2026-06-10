import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { assembleDashboardData, DemoTrade } from "../dashboardData";
import { DemoManifest } from "@/hooks/useDemoManifest";
import { PoolReserves } from "@/hooks/useLiveDemoReads";

const mockManifest = {} as DemoManifest;

describe("assembleDashboardData", () => {
  it("Property 7: Dashboard Price Float Bounds", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 1000000000000000000n }), // 0 to 1e18
        (livePrice) => {
          const result = assembleDashboardData(mockManifest, livePrice, undefined, []);
          expect(result.priceFloat).toBeGreaterThanOrEqual(0);
          expect(result.priceFloat).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  it("Property 8: Reserve Percentage Invariant", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 1000n }),
        fc.bigInt({ min: 0n, max: 1000n }),
        fc.bigInt({ min: 0n, max: 1000n }),
        fc.bigInt({ min: 0n, max: 1000n }),
        (xActive, xPassive, yActive, yPassive) => {
          fc.pre(xActive + xPassive + yActive + yPassive > 0n);
          const reserves = {
            xActive,
            xPassive,
            yActive,
            yPassive,
            ellActive: 0n,
            lambdaWad: 0n,
            lT: 0n,
          } as PoolReserves;
          const result = assembleDashboardData(mockManifest, undefined, reserves, []);

          expect(result.activePct! + result.passivePct!).toBe(100);
        },
      ),
    );
  });

  it("Property 1: Live Data Precedence", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n }), (livePrice) => {
        const trades = [{ priceAfter: 99999n }] as DemoTrade[];
        const result = assembleDashboardData(mockManifest, livePrice, undefined, trades);
        expect(result.price).toBe(livePrice);
        expect(result.priceSource).toBe("live");
      }),
    );
  });

  it("Property 9: Attack Trades Slice Bound", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            side: fc.integer({ min: 0, max: 1 }),
            size: fc.bigInt({ min: 0n }),
          }),
        ),
        (trades) => {
          const result = assembleDashboardData(
            mockManifest,
            undefined,
            undefined,
            trades as DemoTrade[],
          );
          expect(result.attackTrades.length).toBeLessThanOrEqual(3);
          expect(result.attackTrades.every((t) => t.side === 0)).toBe(true);

          for (let i = 1; i < result.attackTrades.length; i++) {
            expect(Number(result.attackTrades[i - 1].size)).toBeLessThanOrEqual(
              Number(result.attackTrades[i].size),
            );
          }
        },
      ),
    );
  });
});
