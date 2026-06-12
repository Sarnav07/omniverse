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
  router: `0x${string}`;
};

const ZERO = "0x0000000000000000000000000000000000000000";

// Returns null (not throws) when the manifest is missing required fields, so downstream
// components fall back to live on-chain reads instead of crashing.
function validateManifest(json: DemoManifest): DemoManifest | null {
  const okConditionId = /^0x[0-9a-fA-F]{64}$/.test(json.conditionId ?? "");
  const okPools =
    !!json.poolWeth &&
    json.poolWeth !== ZERO &&
    !!json.poolUsdc &&
    json.poolUsdc !== ZERO;
  let okL0 = false;
  try {
    okL0 = BigInt(json.l0) > 0n;
  } catch {
    okL0 = false;
  }
  return okConditionId && okPools && okL0 ? json : null;
}

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
        const valid = validateManifest(json);
        if (!cancelled) {
          if (valid) {
            setData(valid);
            setError(null);
          } else {
            setData(null);
            setError(new Error("Manifest failed validation"));
          }
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
