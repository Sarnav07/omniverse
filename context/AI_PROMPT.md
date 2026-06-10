# AI Context

## Recent Fixes
1. USDC: `parseUnits(amount, 6)` not 18
2. Gas: All writeContract needs `maxPriorityFeePerGas: parseGwei("0.01"), maxFeePerGas: parseGwei("0.05")`
3. Approval: WETH not ConditionalTokens
4. Addresses: Use `frontend/src/config/contracts.ts`

## Contract Addresses (Arbitrum Sepolia)
```
Router: 0xab7A119b2a2Ca89E7fFbe69c4175c8d79f34AA7E
CTF:    0x1614134BC92fC3dBdC304dFc32178290d4037c1F
WETH:   0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204 (18 decimals)
USDC:   0xBCB53c282F9106f3CBD063824c657Cb5928AEB71 (6 decimals)
```

## Common Tasks

### Add gas to transaction
```typescript
import { parseGwei } from "viem";
writeContract({
  // ... args
  maxPriorityFeePerGas: parseGwei("0.01"),
  maxFeePerGas: parseGwei("0.05"),
});
```

### Parse token amounts
```typescript
const weth = parseUnits(amount, 18);  // WETH
const usdc = parseUnits(amount, 6);   // USDC - CRITICAL!
```

### Debug
```bash
# Balance
cast call 0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204 "balanceOf(address)(uint256)" <USER> --rpc-url $ARB_SEPOLIA_RPC

# Allowance
cast call 0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204 "allowance(address,address)(uint256)" <USER> 0xab7A119b2a2Ca89E7fFbe69c4175c8d79f34AA7E --rpc-url $ARB_SEPOLIA_RPC
```

## Red Flags
- ❌ Never use 18 decimals for USDC
- ❌ Never skip gas config on transactions
- ❌ Never approve CT when Router needs WETH
