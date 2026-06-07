import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// ABI for MockERC20 mint
const MOCK_ERC20_ABI = [
  "function mint(address to, uint256 amount) external"
];

async function main() {
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is missing from environment variables.");
  }
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://localhost:8545");
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const targetAddress = process.argv[2] || wallet.address;

  console.log(`Dripping to: ${targetAddress}`);

  // Load manifest
  const manifestPath = path.join(__dirname, "../deployments/arb-sepolia.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Manifest not found. Run Deploy script first.");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  
  const weth = new ethers.Contract(manifest.weth, MOCK_ERC20_ABI, wallet);
  const usdc = new ethers.Contract(manifest.usdc, MOCK_ERC20_ABI, wallet);

  const amount = ethers.parseEther("1000");

  console.log("Minting WETH...");
  let tx1 = await weth.mint(targetAddress, amount);
  await tx1.wait();
  console.log(`Minted 1000 WETH to ${targetAddress}`);

  console.log("Minting USDC...");
  let tx2 = await usdc.mint(targetAddress, amount);
  await tx2.wait();
  console.log(`Minted 1000 USDC to ${targetAddress}`);

  console.log("Faucet drip complete!");
}

main().catch(console.error);
