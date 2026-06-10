const WAD_DECIMALS = 18;
const WAD_NUMBER = 1e18;

export function wadToNumber(value?: bigint | string | number | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) / WAD_NUMBER;
  return Number(value) / WAD_NUMBER;
}

export function formatWad(value?: bigint | string | number | null, decimals = 2): string {
  const n = wadToNumber(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatProbability(value?: bigint | string | number | null, decimals = 1): string {
  if (value === undefined || value === null) return "—";
  const n = typeof value === "bigint" || typeof value === "string" ? wadToNumber(value) : value;
  const pct = n <= 1 ? n * 100 : n;
  if (!Number.isFinite(pct)) return "—";
  return `${pct.toFixed(decimals)}%`;
}

export function formatCompactToken(
  value?: bigint | string | number | null,
  symbol?: string,
  decimals = 1,
): string {
  const n = wadToNumber(value);
  if (!Number.isFinite(n)) return "—";
  const suffix = symbol ? ` ${symbol}` : "";
  return `${Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: decimals,
  }).format(n)}${suffix}`;
}

export function formatAddress(address?: string | null, head = 6, tail = 4): string {
  if (!address) return "—";
  if (address.length <= head + tail) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function formatBlockNumber(block?: bigint | number | null): string {
  if (block === undefined || block === null) return "—";
  return Number(block).toLocaleString("en-US");
}

export function arbiscanTxUrl(hash?: string | null): string {
  return `https://sepolia.arbiscan.io/tx/${hash ?? ""}`;
}

export function arbiscanAddressUrl(address?: string | null): string {
  return `https://sepolia.arbiscan.io/address/${address ?? ""}`;
}

export function parseWadInput(value: string): bigint {
  const [wholeRaw, fracRaw = ""] = value.split(".");
  const whole = wholeRaw.replace(/\D/g, "") || "0";
  const frac = fracRaw.replace(/\D/g, "").slice(0, WAD_DECIMALS).padEnd(WAD_DECIMALS, "0");
  return BigInt(`${whole}${frac}`);
}

export function secondsUntil(timestampSeconds?: bigint | number | null): number | null {
  if (timestampSeconds === undefined || timestampSeconds === null) return null;
  return Number(timestampSeconds) - Math.floor(Date.now() / 1000);
}
