import { createConfig, factory } from "ponder";
import { http } from "viem";

import { PmAmmPoolAbi } from "./abis/PmAmmPool";
import { MarketFactoryAbi } from "./abis/MarketFactory";
import { ResolverAbi } from "./abis/Resolver";
import { MultiverseLendingAbi } from "./abis/MultiverseLending";

const FACTORY_ADDRESS = (process.env.FACTORY_ADDRESS ?? "0x4200000000000000000000000000000000000016") as `0x${string}`;
const RESOLVER_ADDRESS = (process.env.RESOLVER_ADDRESS ?? "0x4200000000000000000000000000000000000015") as `0x${string}`;
const LENDING_ADDRESS = (process.env.LENDING_ADDRESS ?? "0x4200000000000000000000000000000000000018") as `0x${string}`;
const START_BLOCK = Number(process.env.START_BLOCK ?? 274270902);

export default createConfig({
  networks: {
    arbitrumSepolia: {
      chainId: 421614,
      transport: http(process.env.PONDER_RPC_URL_421614),
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
