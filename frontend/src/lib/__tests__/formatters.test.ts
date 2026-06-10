import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatProbability, formatWad, arbiscanTxUrl } from "../formatters";

describe("formatters", () => {
  it("Property 10: Formatter Safety", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 1000000000000000000n }), // 0 to 1e18
        (price) => {
          const probStr = formatProbability(price);
          expect(probStr.endsWith("%")).toBe(true);
          const probNum = parseFloat(probStr.slice(0, -1));
          expect(probNum).toBeGreaterThanOrEqual(0);
          expect(probNum).toBeLessThanOrEqual(100);
        },
      ),
    );

    fc.assert(
      fc.property(fc.bigInt({ min: 0n }), (wad) => {
        expect(() => formatWad(wad)).not.toThrow();
      }),
    );

    fc.assert(
      fc.property(fc.string(), (hash) => {
        const url = arbiscanTxUrl(hash);
        expect(url.startsWith("https://sepolia.arbiscan.io/tx/")).toBe(true);
        expect(url.endsWith(hash)).toBe(true);
      }),
    );
  });
});
