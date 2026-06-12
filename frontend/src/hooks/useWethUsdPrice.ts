import { useReadContract } from "wagmi";
import PmAmmPoolAbi from "@/abis/PmAmmPool.abi.json";

/**
 * Returns WETH/USD price by reading currentPrice() from a USDC-denominated pool.
 * The pool's price represents the market's probability, not WETH price directly.
 * For actual WETH/USD pricing, we'd need a dedicated oracle or pool.
 * This is a placeholder that returns a fixed price until proper pricing is implemented.
 */
export function useWethUsdPrice(usdcPool?: `0x${string}`) {
  const { data, isLoading, isError } = useReadContract({
    address: usdcPool,
    abi: PmAmmPoolAbi,
    functionName: "currentPrice",
    query: {
      enabled: !!usdcPool,
      staleTime: 30_000,
      refetchInterval: 30_000,
    },
  });

  // USDC pool price is a probability, not WETH/USD price
  // For demo purposes, use a fixed WETH price of $3000
  const wethUsdPrice = 3000n * 10n ** 18n;

  return {
    price: wethUsdPrice,
    isLoading,
    isError,
    source: "fixed" as const,
  };
}
