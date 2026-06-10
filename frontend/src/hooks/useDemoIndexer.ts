import { useQuery } from "urql";

const DEMO_MARKET_QUERY = `
  query DemoMarket($id: String!) {
    market(id: $id) {
      id
      question
      symbol
      category
      poolWeth
      poolUsdc
      lastPriceWeth
      totalVolumeWeth
      totalVolumeUsdc
      resolved
      createdAt
      createdBlock
      useDynamicLambda
      tradeCount
    }
  }
`;

const DEMO_TRADES_QUERY = `
  query DemoTrades($conditionId: String!, $poolType: String!) {
    trades(
      where: { conditionId: $conditionId, poolType: $poolType }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: 8
    ) {
      items {
        id
        side
        sideLabel
        size
        priceAfter
        ellWad
        lambdaWad
        gapWad
        trader
        timestamp
        blockNumber
        txHash
      }
    }
  }
`;

export function useDemoMarket(conditionId?: string) {
  const [result, reexecute] = useQuery({
    query: DEMO_MARKET_QUERY,
    variables: { id: conditionId ?? "" },
    pause: !conditionId,
    requestPolicy: "cache-and-network",
  });

  return {
    market: result.data?.market ?? null,
    isLoading: result.fetching,
    isError: !!result.error,
    error: result.error,
    refetch: () => reexecute({ requestPolicy: "network-only" }),
    source: result.data?.market ? ("indexed" as const) : ("unavailable" as const),
  };
}

export function useDemoTrades(conditionId?: string, poolType = "WETH") {
  const [result, reexecute] = useQuery({
    query: DEMO_TRADES_QUERY,
    variables: { conditionId: conditionId ?? "", poolType },
    pause: !conditionId,
    requestPolicy: "cache-and-network",
  });

  const trades = result.data?.trades?.items ?? [];
  return {
    trades,
    isLoading: result.fetching,
    isError: !!result.error,
    error: result.error,
    isEmpty: !result.fetching && trades.length === 0,
    refetch: () => reexecute({ requestPolicy: "network-only" }),
    source: trades.length > 0 ? ("indexed" as const) : ("unavailable" as const),
  };
}
