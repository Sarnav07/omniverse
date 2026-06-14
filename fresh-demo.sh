#!/bin/bash
set -e

echo "========================================"
echo "    OMNIVERSE FRESH DEMO BOOTSTRAP      "
echo "========================================"

# Step 1: Redeploy fresh contracts and capture output
echo "[1/6] Redeploying fresh contracts (this may take a minute)..."
# We run the script and tee the output so the user can still see it, while capturing it to a file
OUTPUT_FILE=$(mktemp)
DEMO_OVERWRITE=1 ./run-demo-sepolia.sh 2>&1 | tee "$OUTPUT_FILE"

# Step 2: Get the real block number from the broadcast JSON
echo ""
echo "[2/6] Extracting real block number from run-latest.json..."
LATEST_JSON="contracts-sol/broadcast/SimulateArbDemo.s.sol/421614/run-latest.json"

if [ ! -f "$LATEST_JSON" ]; then
    echo "❌ Error: Could not find $LATEST_JSON"
    rm -f "$OUTPUT_FILE"
    exit 1
fi

REAL_BLOCK=$(node -e "
try {
  const data = require('fs').readFileSync('$LATEST_JSON', 'utf8');
  const parsed = JSON.parse(data);
  const hexBlock = parsed.receipts[0].blockNumber;
  console.log(parseInt(hexBlock, 16));
} catch(e) {
  process.exit(1);
}
")

if [ -z "$REAL_BLOCK" ]; then
    echo "❌ Error: Could not parse blockNumber from receipts."
    rm -f "$OUTPUT_FILE"
    exit 1
fi
echo "✅ Found real block: $REAL_BLOCK"
rm -f "$OUTPUT_FILE"

# Step 3: Fix the manifest createdBlock
echo "[3/6] Fixing manifest createdBlock..."
node -e "
const fs = require('fs');
try {
  const m = JSON.parse(fs.readFileSync('contracts-sol/deployments/demo-manifest.json','utf8'));
  m.createdBlock = $REAL_BLOCK;
  fs.writeFileSync('contracts-sol/deployments/demo-manifest.json', JSON.stringify(m, null, 2));
  fs.writeFileSync('frontend/public/demo-manifest.json', JSON.stringify(m, null, 2));
  console.log('✅ Fixed createdBlock to:', m.createdBlock);
} catch (e) {
  console.error('❌ Error updating manifest:', e.message);
  process.exit(1);
}
"

# Step 4: Update indexer/.env.local
echo "[4/6] Updating indexer/.env.local START_BLOCK..."
START_BLOCK=$((REAL_BLOCK - 10))
ENV_FILE="indexer/.env.local"

# Create file if it doesn't exist
touch "$ENV_FILE"

if grep -q "^START_BLOCK=" "$ENV_FILE"; then
    # sed in-place replacement (macOS compatible)
    sed -i '' "s/^START_BLOCK=.*/START_BLOCK=$START_BLOCK/" "$ENV_FILE"
else
    echo "START_BLOCK=$START_BLOCK" >> "$ENV_FILE"
fi
echo "✅ Set START_BLOCK=$START_BLOCK in $ENV_FILE"

# Step 5: Clear ponder cache
echo "[5/6] Clearing Ponder cache..."
rm -rf indexer/.ponder
echo "✅ Cleared indexer/.ponder"

# Step 6: Print instructions
echo ""
echo "========================================"
echo "          DEMO SETUP COMPLETE!          "
echo "========================================"
echo ""
echo "To start the application, run the following in two separate terminal tabs:"
echo ""
echo "Tab 1 (Indexer):"
echo "  cd indexer && bun run dev"
echo ""
echo "Tab 2 (Frontend):"
echo "  cd frontend && bun run dev"
echo "========================================"
