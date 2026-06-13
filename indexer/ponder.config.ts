import { createConfig, factory } from "ponder";
import { http } from "viem";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PmAmmPoolAbi } from "./abis/PmAmmPool";
import { MarketFactoryAbi } from "./abis/MarketFactory";
import { ResolverAbi } from "./abis/Resolver";
import { MultiverseLendingAbi } from "./abis/MultiverseLending";

// Single source of truth: the live demo manifest that the deploy script writes and the
// frontend reads. Sourcing addresses + start block from here keeps the indexer pinned to
// the *current* deployment. Hardcoding a stale factory or a start block far below the
// deploy is what made the indexer scan ~1.8M empty blocks (~100h) on the public RPC.
// In Docker the manifest is copied alongside the indexer; on a PaaS (Railway/Render)
// where contracts-sol/ isn't shipped, the file may be absent — in that case every
// address + START_BLOCK MUST be provided via env vars below. MANIFEST_PATH lets a
// deploy override the location.
const manifestPath =
  process.env.MANIFEST_PATH ??
  join(process.cwd(), "../contracts-sol/deployments/demo-manifest.json");
let manifest: Record<string, unknown> = {};
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  console.warn(
    `[ponder.config] No manifest at ${manifestPath}; relying on FACTORY_ADDRESS / RESOLVER_ADDRESS / LENDING_ADDRESS / START_BLOCK env vars.`,
  );
}

const ZERO = "0x0000000000000000000000000000000000000000";
// An env override only wins when it is actually set to something real. A copied
// .env.example (zero addresses, START_BLOCK=0) must NOT drag us back to genesis.
const addr = (envVal: string | undefined, fallback: unknown): string =>
  envVal && envVal !== ZERO ? envVal : (fallback as string | undefined) ?? ZERO;

const FACTORY_ADDRESS = addr(process.env.FACTORY_ADDRESS, manifest.factory) as `0x${string}`;
const RESOLVER_ADDRESS = addr(process.env.RESOLVER_ADDRESS, manifest.resolver) as `0x${string}`;
const LENDING_ADDRESS = addr(process.env.LENDING_ADDRESS, manifest.lending) as `0x${string}`;

const envStart = Number(process.env.START_BLOCK ?? 0);
const START_BLOCK = envStart > 0 ? envStart : Number(manifest.createdBlock ?? 0);

export default createConfig({
  networks: {
    arbitrumSepolia: {
      chainId: 421614,
      transport: http(process.env.PONDER_RPC_URL_421614 ?? "https://sepolia-rollup.arbitrum.io/rpc"),
    },
  },

  contracts: {
    // ── 1. MarketFactory ─────────────────────────────────────────────────────
    // Static contract — known address from deployment.
    MarketFactory: {
      network: "arbitrumSepolia",
      abi: MarketFactoryAbi,
      address: FACTORY_ADDRESS,
      startBlock: START_BLOCK,
    },

    // ── 2. PmAmmPool (WETH universe) ─────────────────────────────────────────
    // Factory-created: Ponder auto-discovers pool addresses from EventCreated.
    // We index WETH and USDC pools separately so we can tag poolType.
    PmAmmPoolWeth: {
      network: "arbitrumSepolia",
      abi: PmAmmPoolAbi,
      address: factory({
        address: FACTORY_ADDRESS,
        event: MarketFactoryAbi[0], // EventCreated
        parameter: "poolWeth",
      }),
      startBlock: START_BLOCK,
    },

    // ── 3. PmAmmPool (USDC universe) ─────────────────────────────────────────
    PmAmmPoolUsdc: {
      network: "arbitrumSepolia",
      abi: PmAmmPoolAbi,
      address: factory({
        address: FACTORY_ADDRESS,
        event: MarketFactoryAbi[0], // EventCreated
        parameter: "poolUsdc",
      }),
      startBlock: START_BLOCK,
    },

    // ── 4. Resolver ──────────────────────────────────────────────────────────
    Resolver: {
      network: "arbitrumSepolia",
      abi: ResolverAbi,
      address: RESOLVER_ADDRESS,
      startBlock: START_BLOCK,
    },

    // ── 5. MultiverseLending ─────────────────────────────────────────────────
    MultiverseLending: {
      network: "arbitrumSepolia",
      abi: MultiverseLendingAbi,
      address: LENDING_ADDRESS,
      startBlock: START_BLOCK,
    },
  },
});
