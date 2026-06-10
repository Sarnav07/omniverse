import { useQuery } from "urql";
import { useEffect, useState, useCallback } from "react";
import { DemoTrade } from "@/lib/dashboardData";

const TRADES_QUERY = `
  query GetTrades($conditionId: String!, $poolType: String!) {
    trades(
      where: { conditionId: $conditionId, poolType: $poolType }
      orderBy: "size"
      orderDirection: "asc"
      limit: 8
    ) {
      items {
        id
        side
        size
        priceAfter
        lambdaWad
        ellWad
        gapWad
        trader
        txHash
        blockNumber
        timestamp
      }
    }
  }
`;

export function useDemoTrades(conditionId: string | undefined, poolType: "WETH" | "USDC" = "WETH") {
  const [requestPolicy, setRequestPolicy] = useState<"cache-and-network" | "network-only">(
    "cache-and-network",
  );
  const [retryCount, setRetryCount] = useState(0);

  const [{ data, fetching, error }, reexecuteQuery] = useQuery({
    query: TRADES_QUERY,
    variables: { conditionId: conditionId || "", poolType },
    pause: !conditionId,
    requestPolicy,
  });

  const triggerRefetch = useCallback(() => {
    setRequestPolicy("network-only");
    setRetryCount(5); // start 5 retries
    reexecuteQuery({ requestPolicy: "network-only" });
  }, [reexecuteQuery]);

  // Retry logic
  useEffect(() => {
    if (retryCount > 0 && !fetching) {
      const items = data?.trades?.items || [];
      // If we don't have trades yet and we are retrying
      if (items.length === 0) {
        const timer = setTimeout(() => {
          setRetryCount((c) => c - 1);
          reexecuteQuery({ requestPolicy: "network-only" });
        }, 3000);
        return () => clearTimeout(timer);
      } else {
        // Stop retrying if we got data
        setRetryCount(0);
        setRequestPolicy("cache-and-network");
      }
    }
  }, [retryCount, fetching, data, reexecuteQuery]);

  const items: any[] = data?.trades?.items || [];

  const trades: DemoTrade[] = items.map((item) => ({
    id: item.id,
    side: Number(item.side),
    sideLabel: Number(item.side) === 0 ? "BUY YES" : "BUY NO",
    size: BigInt(item.size),
    priceAfter: BigInt(item.priceAfter),
    lambdaWad: BigInt(item.lambdaWad),
    ellWad: BigInt(item.ellWad),
    gapWad: BigInt(item.gapWad),
    trader: item.trader as `0x${string}`,
    txHash: item.txHash,
    blockNumber: Number(item.blockNumber),
    timestamp: Number(item.timestamp),
  }));

  const source =
    trades.length > 0 ? "indexed" : error || retryCount > 0 ? "unavailable" : "indexed";

  return { trades, isLoading: fetching || retryCount > 0, source, refetch: triggerRefetch };
}
