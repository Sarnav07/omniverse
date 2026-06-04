import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const POOL_ABI = [
  "function buyYes(uint256 amountIn, uint256 minAmountOut, uint256 deadline) external returns (uint256)",
  "function buyNo(uint256 amountIn, uint256 minAmountOut, uint256 deadline) external returns (uint256)",
  "function currentPrice() external view returns (uint256)",
  "function xActive() external view returns (uint256)",
  "function yActive() external view returns (uint256)"
];

const ERC1155_ABI = [
  "function setApprovalForAll(address operator, bool approved) external"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://localhost:8545");
  const wallet = new ethers.Wallet(process.env.BOT_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY!, provider);

  const manifestPath = path.join(__dirname, "../deployments/arb-sepolia.json");
  const seedManifestPath = path.join(__dirname, "../deployments/seed-manifest.json");
  
  if (!fs.existsSync(manifestPath) || !fs.existsSync(seedManifestPath)) {
    throw new Error("Manifests not found. Run Deploy and SeedMarket scripts first.");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const seedManifest = JSON.parse(fs.readFileSync(seedManifestPath, "utf-8"));

  const wethPool = new ethers.Contract(seedManifest.wethPool, POOL_ABI, wallet);
  const usdcPool = new ethers.Contract(seedManifest.usdcPool, POOL_ABI, wallet);
  const ctf = new ethers.Contract(manifest.conditionalTokens, ERC1155_ABI, wallet);

  console.log("Approving pools for CTF transfers...");
  // Check if approved first if we had a view function, but we'll just set it.
  try {
    const txApprove = await ctf.setApprovalForAll(seedManifest.wethPool, true);
    await txApprove.wait();
    const txApprove2 = await ctf.setApprovalForAll(seedManifest.usdcPool, true);
    await txApprove2.wait();
    console.log("Approved.");
  } catch (e) {
    console.log("Probably already approved.");
  }

  console.log(`Starting TradeBot for wallet: ${wallet.address}`);

  // Random trading loop
  while (true) {
    try {
      const priceWeth = ethers.formatEther(await wethPool.currentPrice());
      const priceUsdc = ethers.formatEther(await usdcPool.currentPrice());
      console.log(`Current Prices - WETH Pool: ${priceWeth}, USDC Pool: ${priceUsdc}`);

      const pool = Math.random() > 0.5 ? wethPool : usdcPool;
      const poolName = pool === wethPool ? "WETH" : "USDC";
      const isYes = Math.random() > 0.5;
      
      // Trade ~ 1-10 units
      const tradeAmount = ethers.parseEther((Math.random() * 9 + 1).toFixed(2));
      const deadline = Math.floor(Date.now() / 1000) + 600;

      console.log(`Executing ${isYes ? 'buyYes' : 'buyNo'} in ${poolName} Pool for ${ethers.formatEther(tradeAmount)} units...`);
      
      let tx;
      if (isYes) {
        tx = await pool.buyYes(tradeAmount, 0n, deadline);
      } else {
        tx = await pool.buyNo(tradeAmount, 0n, deadline);
      }
      
      const receipt = await tx.wait();
      console.log(`Trade successful! Tx Hash: ${receipt.hash}`);
    } catch (err: any) {
      console.error(`Trade failed: ${err.message || err}`);
    }

    // Wait 10-30 seconds
    const waitTime = Math.floor(Math.random() * 20000) + 10000;
    console.log(`Waiting ${waitTime / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

main().catch(console.error);
