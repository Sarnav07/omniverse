import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  formatEther,
  http,
  parseAbi,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

const FACTORY_ABI = parseAbi([
  "function conditionalTokens() view returns (address)",
  "function weth() view returns (address)",
  "function usdc() view returns (address)",
  "function math() view returns (address)",
  "function createEvent(string question,string symbol,string category,uint256 expiry,address resolver,uint256 l0,uint256 gammaPrime,bool useDynamicLambda) returns (address poolWeth,address poolUsdc)",
  "event EventCreated(bytes32 indexed conditionId,bytes32 indexed questionId,address resolver,address poolWeth,address poolUsdc,uint256 wethMarketId,uint256 usdcMarketId,string question,string symbol,string category)",
]);

const CTF_ABI = parseAbi([
  "function splitPosition(address collateralToken,bytes32 parentCollectionId,bytes32 conditionId,uint256[] partition,uint256 amount)",
  "function setApprovalForAll(address operator,bool approved)",
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender,uint256 amount) returns (bool)",
  "function mint(address to,uint256 amount)",
]);

const POOL_ABI = parseAbi([
  "function addLiquidity(uint256 yesAmount,uint256 noAmount,uint256 minShares) returns (uint256)",
  "function marketId() view returns (uint256)",
  "function yesPositionId() view returns (uint256)",
  "function noPositionId() view returns (uint256)",
]);

const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;
const MAX_UINT = (1n << 256n) - 1n;
const PARTITION = [1n, 2n];

function loadEnv(path: string) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    process.env[key] ??= value;
  }
}

async function waitFor(hash: Hex, label: string, publicClient: ReturnType<typeof createPublicClient>) {
  console.log(`${label}: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
  console.log(`  mined block=${receipt.blockNumber} status=${receipt.status}`);
  if (receipt.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  return receipt;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../..");
  loadEnv(join(repoRoot, "contracts-sol/.env"));

  const rpcUrl = process.env.ARB_SEPOLIA_RPC ?? process.env.ARBITRUM_SEPOLIA_RPC;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  const factory = process.env.FACTORY_ADDRESS as Address | undefined;
  const resolver = process.env.RESOLVER_ADDRESS as Address | undefined;
  if (!rpcUrl) throw new Error("ARB_SEPOLIA_RPC or ARBITRUM_SEPOLIA_RPC is required.");
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY or PRIVATE_KEY is required.");
  if (!factory) throw new Error("FACTORY_ADDRESS is required.");
  if (!resolver) throw new Error("RESOLVER_ADDRESS is required.");

  const account = privateKeyToAccount(privateKey as Hex);
  const transport = http(rpcUrl, { timeout: 180_000, retryCount: 3, retryDelay: 2_000 });
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport });
  const walletClient = createWalletClient({ account, chain: arbitrumSepolia, transport });

  console.log(`Setup wallet: ${account.address}`);
  console.log(`Factory: ${factory}`);
  console.log(`Resolver: ${resolver}`);

  const [ctf, weth, usdc, math] = await Promise.all([
    publicClient.readContract({ abi: FACTORY_ABI, address: factory, functionName: "conditionalTokens" }),
    publicClient.readContract({ abi: FACTORY_ABI, address: factory, functionName: "weth" }),
    publicClient.readContract({ abi: FACTORY_ABI, address: factory, functionName: "usdc" }),
    publicClient.readContract({ abi: FACTORY_ABI, address: factory, functionName: "math" }),
  ]);

  const runId = Math.floor(Date.now() / 1000).toString();
  const question = `Will AI surpass human intelligence by 2030? (Dynamic Lambda Live Demo) #${runId}`;
  const symbol = "AI2030-DYN";
  const category = "demo";
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
  const l0 = parseEther("500000");
  const gammaPrime = parseEther("2");
  const mintAmount = parseEther("10000000");
  const splitAmount = parseEther("2000000");
  const initialLiquidity = parseEther("500000");

  await waitFor(
    await walletClient.writeContract({ abi: ERC20_ABI, address: weth, functionName: "mint", args: [account.address, mintAmount] }),
    "mint WETH",
    publicClient,
  );
  await waitFor(
    await walletClient.writeContract({ abi: ERC20_ABI, address: weth, functionName: "approve", args: [ctf, MAX_UINT] }),
    "approve WETH to CTF",
    publicClient,
  );

  const createReceipt = await waitFor(
    await walletClient.writeContract({
      abi: FACTORY_ABI,
      address: factory,
      functionName: "createEvent",
      args: [question, symbol, category, expiry, resolver, l0, gammaPrime, true],
    }),
    "create dynamic market",
    publicClient,
  );

  const parsed = createReceipt.logs
    .map((log) => {
      try {
        return decodeEventLog({ abi: FACTORY_ABI, data: log.data, topics: log.topics });
      } catch {
        return undefined;
      }
    })
    .find((log) => log?.eventName === "EventCreated");

  if (!parsed || parsed.eventName !== "EventCreated") throw new Error("EventCreated log not found in createEvent receipt.");
  const conditionId = parsed.args.conditionId;
  const poolWeth = parsed.args.poolWeth;
  const poolUsdc = parsed.args.poolUsdc;
  const wethMarketId = parsed.args.wethMarketId;
  const usdcMarketId = parsed.args.usdcMarketId;

  await waitFor(
    await walletClient.writeContract({
      abi: CTF_ABI,
      address: ctf,
      functionName: "splitPosition",
      args: [weth, ZERO_BYTES32, conditionId, PARTITION, splitAmount],
    }),
    `split ${formatEther(splitAmount)} WETH positions`,
    publicClient,
  );
  await waitFor(
    await walletClient.writeContract({ abi: CTF_ABI, address: ctf, functionName: "setApprovalForAll", args: [poolWeth, true] }),
    "approve WETH pool for CTF",
    publicClient,
  );
  await waitFor(
    await walletClient.writeContract({
      abi: POOL_ABI,
      address: poolWeth,
      functionName: "addLiquidity",
      args: [initialLiquidity, initialLiquidity, 0n],
    }),
    "add 500k/500k WETH liquidity",
    publicClient,
  );

  const [yesWethId, noWethId] = await Promise.all([
    publicClient.readContract({ abi: POOL_ABI, address: poolWeth, functionName: "yesPositionId" }),
    publicClient.readContract({ abi: POOL_ABI, address: poolWeth, functionName: "noPositionId" }),
  ]);

  const manifest = {
    runId,
    createdBlock: Number(createReceipt.blockNumber),
    question,
    symbol,
    conditionId,
    wethMarketId: wethMarketId.toString(),
    usdcMarketId: usdcMarketId.toString(),
    poolWeth,
    poolUsdc,
    yesWethId: yesWethId.toString(),
    noWethId: noWethId.toString(),
    factory,
    resolver,
    math,
    demoAccount: account.address,
    weth,
    usdc,
    l0: l0.toString(),
    gammaPrime: gammaPrime.toString(),
    initialLiquidityYes: initialLiquidity.toString(),
    initialLiquidityNo: initialLiquidity.toString(),
    lending: "0x0000000000000000000000000000000000000000",
    lendingSeed: "0",
    lendingCollateral: "0",
    lendingDebt: "0",
  };

  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  mkdirSync(join(repoRoot, "contracts-sol/deployments"), { recursive: true });
  mkdirSync(join(repoRoot, "frontend/public"), { recursive: true });
  writeFileSync(join(repoRoot, "contracts-sol/deployments/demo-manifest.json"), manifestJson);
  writeFileSync(join(repoRoot, "frontend/public/demo-manifest.json"), manifestJson);
  console.log(`Manifest written. poolWeth=${poolWeth} math=${math}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
