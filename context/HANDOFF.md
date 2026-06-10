# Developer Handoff

## Fixed Since Last Commit
1. USDC decimal bug: 18→6 decimals (prevented 1000x overborrow)
2. Gas config: Added 0.01/0.05 gwei to prevent estimation failures
3. Approval: Changed from ConditionalTokens to WETH.approve
4. Addresses: Synced frontend with fresh-demo deployment

## Current Issue: MetaMask Gas Error
**Symptom**: Shows 7,881 ETH gas fee  
**Cause**: User wallet has 0 WETH  
**Fix**: Import demo account key OR mint WETH:
```bash
cast send 0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204 \
  "mint(address,uint256)" <YOUR_WALLET> 1000000000000000000000 \
  --rpc-url $ARB_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY
```

## Files Changed
- `frontend/src/components/borrow-demo-tab.tsx` - decimals, gas, approval
- `frontend/src/hooks/useAttackPresets.ts` - gas config
- `frontend/src/config/contracts.ts` - addresses

## Next Steps
- [ ] E2E test borrow with funded wallet
- [ ] Test attack presets on testnet
- [ ] Consider dynamic gas for mainnet

## Debugging
```bash
# Check WETH balance
cast call 0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204 "balanceOf(address)(uint256)" <USER> --rpc-url $ARB_SEPOLIA_RPC

# Simulate transaction
cast call 0xab7A119b2a2Ca89E7fFbe69c4175c8d79f34AA7E "executeBorrow(address,bytes32,uint256,uint256)" <LENDING> <CONDITION_ID> <WETH> <USDC> --from <USER> --rpc-url $ARB_SEPOLIA_RPC
```
