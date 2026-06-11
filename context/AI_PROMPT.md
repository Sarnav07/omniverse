# AI Context

## Recent Fixes
1. USDC: `parseUnits(amount, 18)` — the deployed USDC mock is **18-decimal** (NOT the usual 6)
2. Gas: All writeContract needs `maxPriorityFeePerGas: parseGwei("0.02"), maxFeePerGas: parseGwei("0.2")`
3. Approval: WETH not ConditionalTokens (Router pulls WETH collateral)
4. Router: collateral-agnostic — reads `pool.collateralToken()` (demo trades the WETH pool)
5. Addresses: Use `frontend/src/config/contracts.ts` (or the live `demo-manifest.json` `router`)

## Contract Addresses (Arbitrum Sepolia)
```
Router: 0xF0AF8C84655a3E25Cf26Cb88E70E765C157515B2
CTF:    0x1614134BC92fC3dBdC304dFc32178290d4037c1F
WETH:   0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204 (18 decimals)
USDC:   0xBCB53c282F9106f3CBD063824c657Cb5928AEB71 (18 decimals — deployed mock)
```

## Common Tasks

### Add gas to transaction
```typescript
import { parseGwei } from "viem";
writeContract({
  // ... args
  maxPriorityFeePerGas: parseGwei("0.02"),
  maxFeePerGas: parseGwei("0.2"),
});
```

### Parse token amounts
```typescript
const weth = parseUnits(amount, 18);  // WETH
const usdc = parseUnits(amount, 18);  // USDC — deployed mock is 18-decimal, NOT 6
```

### Debug
```bash
# Balance
cast call 0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204 "balanceOf(address)(uint256)" <USER> --rpc-url $ARB_SEPOLIA_RPC

# Allowance (WETH → Router)
cast call 0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204 "allowance(address,address)(uint256)" <USER> 0xF0AF8C84655a3E25Cf26Cb88E70E765C157515B2 --rpc-url $ARB_SEPOLIA_RPC
```

## Red Flags
- ❌ Don't assume USDC is 6 decimals — the deployed mock reports **18** (`USDC.decimals() == 18`)
- ❌ Never skip gas config on transactions
- ❌ Never approve CT when Router needs WETH
- ❌ Don't point the frontend at the old router `0xab7A…` (broken bytecode — pulled USDC for every pool)
