import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

const POOL_ABI = [
  {
    type: "function",
    name: "buyYes",
    inputs: [
      { name: "noIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "yesOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buyNo",
    inputs: [
      { name: "yesIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "noOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "currentPrice",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReserves",
    inputs: [],
    outputs: [
      { name: "xActive", type: "uint256" },
      { name: "xPassive", type: "uint256" },
      { name: "yActive", type: "uint256" },
      { name: "yPassive", type: "uint256" },
      { name: "ellActive", type: "uint256" },
      { name: "lambdaWad", type: "uint256" },
      { name: "lT", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

const CTF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setApprovalForAll",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "splitPosition",
    inputs: [
      { name: "collateralToken", type: "address" },
      { name: "parentCollectionId", type: "bytes32" },
      { name: "conditionId", type: "bytes32" },
      { name: "partition", type: "uint256[]" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const FACTORY_ABI = [
  {
    type: "function",
    name: "conditionalTokens",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

type DemoManifest = {
  conditionId: Hex;
  poolWeth: Address;
  yesWethId: string;
  noWethId: string;
  factory: Address;
  weth: Address;
  l0: string;
};

const WAD = 10n ** 18n;
const MAX_UINT = (1n << 256n) - 1n;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;
const PARTITION = [1n, 2n];

async function main() {
  loadEnv(join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), ".env"));
  const rpcUrl = process.env.ARB_SEPOLIA_RPC ?? process.env.RPC_URL;
  const privateKey = (process.env.BOT_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY) as
    | Hex
    | undefined;
  if (!rpcUrl) throw new Error("ARB_SEPOLIA_RPC or RPC_URL is required.");
  if (!privateKey) throw new Error("BOT_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is required.");

  const manifest = loadManifest();
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });

  const ctf = await publicClient.readContract({
    abi: FACTORY_ABI,
    address: manifest.factory,
    functionName: "conditionalTokens",
  });

  const targetP = parseEnvEther("DEMO_TARGET_P", "0.95");
  const maxSingleTrade = parseEnvEther("DEMO_MAX_SINGLE_TRADE", "150000");
  const maxTradeCount = Number(process.env.DEMO_MAX_TRADES ?? "12");
  const l0 = BigInt(manifest.l0);

  const currentPrice = await readPrice(publicClient, manifest.poolWeth);
  const direction = currentPrice < targetP ? "up" : "down";
  const schedule = calibrateTradeSchedule({
    l0,
    currentPrice,
    targetP,
    maxSingleTrade,
    maxTradeCount,
  });

  const totalPlannedInput = schedule.reduce((sum, item) => sum + item, 0n);
  await ensureWethPositionInventory({
    publicClient,
    walletClient,
    account: account.address,
    ctf,
    weth: manifest.weth,
    conditionId: manifest.conditionId,
    positionId: direction === "up" ? BigInt(manifest.yesWethId) : BigInt(manifest.noWethId),
    positionName: direction === "up" ? "YES-WETH" : "NO-WETH",
    pool: manifest.poolWeth,
    needed: totalPlannedInput,
  });

  console.log(`Live trade runner wallet: ${account.address}`);
  console.log(`Target probability: ${formatWad(targetP)}`);
  console.log(`Starting probability: ${formatWad(currentPrice)}`);
  console.log(
    `Trade direction: ${direction === "up" ? "buyNo with YES-WETH input" : "buyYes with NO-WETH input"}`,
  );
  console.log(
    `Planned trades: ${schedule.map((amount) => `${formatEther(amount)} WETH`).join(", ")}`,
  );

  for (let i = 0; i < schedule.length; i++) {
    const priceBefore = await readPrice(publicClient, manifest.poolWeth);
    if (priceBefore >= targetP) {
      console.log(`Target reached before trade ${i + 1}: P=${formatWad(priceBefore)}`);
      return;
    }

    const amount = schedule[i];
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
    const functionName = direction === "up" ? "buyNo" : "buyYes";
    const inputName = direction === "up" ? "YES-WETH" : "NO-WETH";
    console.log(
      `Trade ${i + 1}/${schedule.length}: ${functionName} with ${formatEther(amount)} ${inputName}`,
    );

    const hash = await walletClient.writeContract({
      abi: POOL_ABI,
      address: manifest.poolWeth,
      functionName,
      args: [amount, 0n, deadline],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    await waitForNextBlock(publicClient, receipt.blockNumber);

    const [priceAfter, reserves] = await Promise.all([
      readPrice(publicClient, manifest.poolWeth),
      publicClient.readContract({
        abi: POOL_ABI,
        address: manifest.poolWeth,
        functionName: "getReserves",
      }),
    ]);

    console.log(
      [
        `  tx=${hash}`,
        `block=${receipt.blockNumber}`,
        `P=${formatWad(priceAfter)}`,
        `lambda=${formatWad(reserves[5])}`,
        `xActive=${formatEther(reserves[0])}`,
        `xPassive=${formatEther(reserves[1])}`,
        `yActive=${formatEther(reserves[2])}`,
        `yPassive=${formatEther(reserves[3])}`,
      ].join(" | "),
    );

    if (priceAfter >= targetP) {
      console.log(`Target reached: P=${formatWad(priceAfter)}`);
      return;
    }
  }

  const finalPrice = await readPrice(publicClient, manifest.poolWeth);
  console.warn(`Trade schedule exhausted before target. Final P=${formatWad(finalPrice)}`);
}

function loadEnv(path: string) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
  }
}

function loadManifest(): DemoManifest {
  const here = dirname(fileURLToPath(import.meta.url));
  const manifestPath = join(here, "../deployments/demo-manifest.json");
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

async function readPrice(publicClient: ReturnType<typeof createPublicClient>, pool: Address) {
  return publicClient.readContract({ abi: POOL_ABI, address: pool, functionName: "currentPrice" });
}

async function ensureWethPositionInventory({
  publicClient,
  walletClient,
  account,
  ctf,
  weth,
  conditionId,
  positionId,
  positionName,
  pool,
  needed,
}: {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  account: Address;
  ctf: Address;
  weth: Address;
  conditionId: Hex;
  positionId: bigint;
  positionName: string;
  pool: Address;
  needed: bigint;
}) {
  const balance = await publicClient.readContract({
    abi: CTF_ABI,
    address: ctf,
    functionName: "balanceOf",
    args: [account, positionId],
  });

  if (balance < needed) {
    const shortfall = needed - balance;
    console.log(
      `${positionName} shortfall ${formatEther(shortfall)}. Minting and splitting mock WETH...`,
    );

    try {
      const mintHash = await walletClient.writeContract({
        abi: ERC20_ABI,
        address: weth,
        functionName: "mint",
        args: [account, shortfall],
      });
      await publicClient.waitForTransactionReceipt({ hash: mintHash });
    } catch (error) {
      throw new Error(
        `Unable to mint mock WETH for trade runner. Shortfall=${formatEther(shortfall)}. ${String(error)}`,
      );
    }

    const approveHash = await walletClient.writeContract({
      abi: ERC20_ABI,
      address: weth,
      functionName: "approve",
      args: [ctf, MAX_UINT],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    const splitHash = await walletClient.writeContract({
      abi: CTF_ABI,
      address: ctf,
      functionName: "splitPosition",
      args: [weth, ZERO_BYTES32, conditionId, PARTITION, shortfall],
    });
    await publicClient.waitForTransactionReceipt({ hash: splitHash });
  }

  const approvalHash = await walletClient.writeContract({
    abi: CTF_ABI,
    address: ctf,
    functionName: "setApprovalForAll",
    args: [pool, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: approvalHash });
}

function calibrateTradeSchedule({
  l0,
  currentPrice,
  targetP,
  maxSingleTrade,
  maxTradeCount,
}: {
  l0: bigint;
  currentPrice: bigint;
  targetP: bigint;
  maxSingleTrade: bigint;
  maxTradeCount: number;
}) {
  const currentZ = normalInv(wadToNumber(currentPrice));
  const targetZ = normalInv(wadToNumber(targetP));
  const zMove = Math.max(0.1, targetZ - currentZ);
  const estimate = BigInt(Math.ceil(Number(l0 / WAD) * zMove * 1.25)) * WAD;

  const schedule: bigint[] = [];
  let remaining = estimate;
  while (remaining > 0n && schedule.length < maxTradeCount) {
    const trade = remaining > maxSingleTrade ? maxSingleTrade : remaining;
    schedule.push(trade);
    remaining -= trade;
  }

  if (remaining > 0n) {
    console.warn(
      `Calibration hit max trade count. Remaining estimate not scheduled: ${formatEther(remaining)} WETH`,
    );
  }

  return schedule.length > 0 ? schedule : [parseEther("10000")];
}

async function waitForNextBlock(
  publicClient: ReturnType<typeof createPublicClient>,
  blockNumber: bigint,
) {
  const timeoutAt = Date.now() + 60_000;
  while (Date.now() < timeoutAt) {
    const latest = await publicClient.getBlockNumber();
    if (latest > blockNumber) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  console.warn("Timed out waiting for the next block; continuing with latest state.");
}

function parseEnvEther(name: string, fallback: string) {
  return parseEther(process.env[name] ?? fallback);
}

function wadToNumber(value: bigint) {
  return Number(value) / 1e18;
}

function formatWad(value: bigint) {
  return `${(wadToNumber(value) * 100).toFixed(3)}%`;
}

// Acklam inverse-normal approximation. Used only for runner sizing; on-chain
// lambda values still come from the deployed math kernel.
function normalInv(p: number) {
  const a = [
    -39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472,
    2.50662827745924,
  ];
  const b = [
    -54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857,
  ];
  const c = [
    -0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373,
    4.37466414146497, 2.93816398269878,
  ];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const plow = 0.02425;
  const phigh = 1 - plow;

  if (p <= 0 || p >= 1) throw new Error(`normalInv p out of range: ${p}`);
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
