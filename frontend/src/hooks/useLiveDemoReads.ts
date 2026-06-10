import { useBlockNumber, useReadContract } from "wagmi";
import PmAmmPoolAbi from "@/abis/PmAmmPool.abi.json";
import Erc20Abi from "@/abis/ERC20.abi.json";

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export function useLiveBlockNumber() {
  const result = useBlockNumber({ watch: true });
  return { ...result, source: result.data ? "live" as const : "unavailable" as const };
}

export function usePoolPrice(pool?: `0x${string}`) {
  const result = useReadContract({
    address: pool ?? ZERO,
    abi: PmAmmPoolAbi,
    functionName: "currentPrice",
    query: { enabled: !!pool && pool !== ZERO, refetchInterval: 2_000 },
  });
  return { ...result, price: result.data as bigint | undefined, source: result.data ? "live" as const : "unavailable" as const };
}

export type PoolReserves = {
  xActive: bigint;
  xPassive: bigint;
  yActive: bigint;
  yPassive: bigint;
  ellActive: bigint;
  lambdaWad: bigint;
  lT: bigint;
};

export function usePoolReserves(pool?: `0x${string}`) {
  const result = useReadContract({
    address: pool ?? ZERO,
    abi: PmAmmPoolAbi,
    functionName: "getReserves",
    query: { enabled: !!pool && pool !== ZERO, refetchInterval: 2_000 },
  });
  const raw = result.data as readonly bigint[] | undefined;
  const reserves: PoolReserves | undefined = raw
    ? {
        xActive: raw[0],
        xPassive: raw[1],
        yActive: raw[2],
        yPassive: raw[3],
        ellActive: raw[4],
        lambdaWad: raw[5],
        lT: raw[6],
      }
    : undefined;
  return { ...result, reserves, source: reserves ? "live" as const : "unavailable" as const };
}

export function usePoolLiquidity(pool?: `0x${string}`) {
  const result = useReadContract({
    address: pool ?? ZERO,
    abi: PmAmmPoolAbi,
    functionName: "currentLiquidity",
    query: { enabled: !!pool && pool !== ZERO, refetchInterval: 2_000 },
  });
  return { ...result, liquidity: result.data as bigint | undefined, source: result.data ? "live" as const : "unavailable" as const };
}

export function useMathKernelStatus(pool?: `0x${string}`, expectedMath?: string) {
  const result = useReadContract({
    address: pool ?? ZERO,
    abi: PmAmmPoolAbi,
    functionName: "math",
    query: { enabled: !!pool && pool !== ZERO },
  });
  const mathAddress = result.data as `0x${string}` | undefined;
  const matches =
    !!mathAddress && !!expectedMath && mathAddress.toLowerCase() === expectedMath.toLowerCase();
  return {
    ...result,
    mathAddress,
    matches,
    label: matches ? "Stylus kernel" : mathAddress ? "Fallback math" : "Math unavailable",
    source: mathAddress ? "live" as const : "unavailable" as const,
  };
}

export function useTokenAllowance(token?: `0x${string}`, owner?: `0x${string}`, spender?: `0x${string}`) {
  const result = useReadContract({
    address: token ?? ZERO,
    abi: Erc20Abi,
    functionName: "allowance",
    args: [owner ?? ZERO, spender ?? ZERO],
    query: { enabled: !!token && !!owner && !!spender, refetchInterval: 2_000 },
  });
  return { ...result, allowance: (result.data as bigint | undefined) ?? 0n, source: result.data !== undefined ? "live" as const : "unavailable" as const };
}

export function useTokenBalance(token?: `0x${string}`, owner?: `0x${string}`) {
  const result = useReadContract({
    address: token ?? ZERO,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: [owner ?? ZERO],
    query: { enabled: !!token && !!owner, refetchInterval: 2_000 },
  });
  return { ...result, balance: (result.data as bigint | undefined) ?? 0n, source: result.data !== undefined ? "live" as const : "unavailable" as const };
}
