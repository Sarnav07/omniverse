#!/bin/bash
set -e

echo "Running Arbitrage Demo Simulation on Arbitrum Sepolia..."

# Load environment variables
if [ -f "contracts-sol/.env" ]; then
    export $(cat contracts-sol/.env | grep -v '#' | awk '/=/ {print $1}')
fi

if [ -z "$ARB_SEPOLIA_RPC" ]; then
    echo "Error: ARB_SEPOLIA_RPC is not set."
    exit 1
fi

if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo "Error: DEPLOYER_PRIVATE_KEY is not set."
    exit 1
fi

if [ -f "contracts-sol/deployments/demo-manifest.json" ] && [ "$DEMO_OVERWRITE" != "1" ]; then
    echo "Existing contracts-sol/deployments/demo-manifest.json found."
    echo "Set DEMO_OVERWRITE=1 to overwrite it without a prompt."
    read -p "Overwrite and create a new live demo run? [y/N] " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Aborted."
        exit 0
    fi
fi

cd contracts-sol
echo "Creating dynamic demo market and seeding initial state..."
# Pin the fork to the current head. forge's default "latest" resolution can land on a
# lagged node behind a load balancer and fork from a block before the factory existed,
# reverting with "call to non-contract address". Pinning the block forces a consistent fork.
FORK_BLOCK=$(cast block-number --rpc-url $ARB_SEPOLIA_RPC)
echo "Pinning fork to block $FORK_BLOCK"
forge script script/SimulateArbDemo.s.sol --rpc-url $ARB_SEPOLIA_RPC --fork-block-number $FORK_BLOCK --broadcast --retries 5 --timeout 120 --slow

cd ..
mkdir -p frontend/public
cp contracts-sol/deployments/demo-manifest.json frontend/public/demo-manifest.json

CREATED_BLOCK=$(node -e "console.log(JSON.parse(require('fs').readFileSync('contracts-sol/deployments/demo-manifest.json','utf8')).createdBlock)")
CONFIG_START_BLOCK=$(node -e "const fs=require('fs'); const m=fs.readFileSync('indexer/ponder.config.ts','utf8').match(/START_BLOCK\\s*=\\s*Number\\(process\\.env\\.START_BLOCK\\s*\\?\\?\\s*(\\d+)\\)/); console.log(process.env.START_BLOCK || (m ? m[1] : '0'))")

if [ "$CONFIG_START_BLOCK" -gt "$CREATED_BLOCK" ]; then
    echo "WARNING: Ponder START_BLOCK ($CONFIG_START_BLOCK) is greater than demo createdBlock ($CREATED_BLOCK)."
    echo "Set indexer START_BLOCK to $((CREATED_BLOCK - 1)) or lower before syncing, or EventCreated will be missed."
fi

echo "Running adaptive live trade sequence..."
cd frontend
# bun ../contracts-sol/ts/runLiveDemoTrades.ts
cd ..

echo "Simulation complete! Manifest saved to contracts-sol/deployments/demo-manifest.json"
echo "Frontend copy saved to frontend/public/demo-manifest.json"
echo "Open the dashboard at http://localhost:5173/demo after Ponder and the frontend are running."
