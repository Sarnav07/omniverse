/**
 * Pool → conditionId cache.
 *
 * When MarketFactory emits EventCreated, we learn which pool address belongs
 * to which conditionId (and whether it's the WETH or USDC universe). This
 * in-memory map lets trade/rebalance/liquidity handlers tag their rows with
 * the correct conditionId without an extra on-chain read per event.
 *
 * Safe because Ponder processes events sequentially — EventCreated always
 * fires before any pool events for that pool address.
 */

interface PoolMeta {
  conditionId: string;
  poolType: "WETH" | "USDC";
}

const poolMetaCache = new Map<string, PoolMeta>();

/** Register a pool address → conditionId + poolType mapping. */
export function registerPool(
  poolAddress: string,
  conditionId: string,
  poolType: "WETH" | "USDC",
): void {
  poolMetaCache.set(poolAddress.toLowerCase(), { conditionId, poolType });
}

/** Look up cached metadata for a pool address. */
export function getPoolMeta(poolAddress: string): PoolMeta | undefined {
  return poolMetaCache.get(poolAddress.toLowerCase());
}

/** Side codes → human-readable labels. */
const SIDE_LABELS: Record<number, string> = {
  0: "Buy YES",
  1: "Sell YES",
  2: "Buy NO",
  3: "Sell NO",
};

export function sideLabel(side: number): string {
  return SIDE_LABELS[side] ?? `Unknown(${side})`;
}

/** Default WAD probability for a fresh market (50%). */
export const DEFAULT_PRICE_WAD = 500_000_000_000_000_000n; // 0.5e18
