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
