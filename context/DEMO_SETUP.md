# Demo Setup

## Prerequisites
```bash
bun --version    # or node v18+
forge --version
```

## Setup
```bash
# Install
cd frontend && bun install
cd ../indexer && bun install
cd ../contracts-sol && forge install

# Configure
cd contracts-sol
cp .env.example .env  # Add ARB_SEPOLIA_RPC and DEPLOYER_PRIVATE_KEY
```

## Run Demo
```bash
# 1. Deploy fresh contracts
./fresh-demo.sh

# 2. Start indexer (terminal 1)
cd indexer && bun run dev

# 3. Start frontend (terminal 2)
cd frontend && bun run dev

# 4. Open http://localhost:5173
# Import demo account key from contracts-sol/.env → DEPLOYER_PRIVATE_KEY
```

## Troubleshooting
| Issue | Fix |
|-------|-----|
| Permission denied | `chmod +x fresh-demo.sh` |
| RPC not set | Add `ARB_SEPOLIA_RPC` to `contracts-sol/.env` |
| Huge gas fee | Wallet needs WETH (see HANDOFF.md) |
| Wrong network | Switch to Arbitrum Sepolia (421614) |
| Indexer fails | `rm -rf indexer/.ponder && bun run dev` |
