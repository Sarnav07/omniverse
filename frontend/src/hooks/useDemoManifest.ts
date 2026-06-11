import { useEffect, useState } from "react";

export type DemoManifest = {
  runId: string;
  createdBlock: number;
  question: string;
  symbol: string;
  conditionId: `0x${string}`;
  wethMarketId: string;
  usdcMarketId: string;
  poolWeth: `0x${string}`;
  poolUsdc: `0x${string}`;
  yesWethId: string;
  noWethId: string;
  factory: `0x${string}`;
  resolver: `0x${string}`;
  math: `0x${string}`;
  demoAccount: `0x${string}`;
  weth: `0x${string}`;
  usdc: `0x${string}`;
  l0: string;
  gammaPrime: string;
  initialLiquidityYes: string;
  initialLiquidityNo: string;
  lending: `0x${string}`;
  lendingSeed: string;
  lendingCollateral: string;
  lendingDebt: string;
};

export function useDemoManifest() {
  const [data, setData] = useState<DemoManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        const res = await fetch("/demo-manifest.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`demo manifest ${res.status}`);
        const json = (await res.json()) as DemoManifest;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error("Manifest unavailable"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    data,
    isLoading,
    isError: !!error,
    error,
    source: data ? ("manifest" as const) : ("unavailable" as const),
  };
}
