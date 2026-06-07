#!/bin/bash
# Start anvil in background
anvil > anvil.log 2>&1 &
ANVIL_PID=$!
sleep 2

# Export default anvil key
export DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

echo "Deploying contracts..."
cd contracts-sol
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

echo "Seeding market..."
export FACTORY_ADDRESS=$(jq -r '.marketFactory' deployments/arb-sepolia.json)
export ORACLE_ADDRESS=$(jq -r '.priceOracle' deployments/arb-sepolia.json)
export RESOLVER_ADDRESS=$(jq -r '.resolver' deployments/arb-sepolia.json)

forge script script/SeedMarket.s.sol --rpc-url http://localhost:8545 --broadcast

echo "Triggering crash..."
export QUESTION_ID=$(jq -r '.questionId' deployments/seed-manifest.json)
export LENDING_ADDRESS=$(jq -r '.lending' deployments/seed-manifest.json)
forge script script/TriggerCrash.s.sol --rpc-url http://localhost:8545 --broadcast

kill $ANVIL_PID
