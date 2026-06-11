# Developer Handoff

## Fixed (committed on stylus-math)
1. USDC decimals: frontend now uses **18** decimals to match the deployed USDC mock (`USDC.decimals() == 18`). The earlier "18→6" change was wrong for this deployment.
2. Router collateral bug: `buyYes/buyNo/addLiquidity` were hardcoded to pull+split USDC, but the demo trades the WETH pool → reverted with `ERC20: allowance` (wallet showed an absurd gas fee). Router now reads `pool.collateralToken()` and was redeployed.
3. Gas config: bumped to 0.02 priority / 0.2 max gwei to prevent estimation failures.
4. Approval: WETH.approve(router) for both attack presets and borrow.
5. Indexer sync: config sourced from `demo-manifest.json` (factory/resolver/lending + start block) so it no longer scans ~1.8M empty blocks against a stale factory.

## Redeployed Router
```
OmniverseRouter: 0xF0AF8C84655a3E25Cf26Cb88E70E765C157515B2  (Arb Sepolia)
```
The old `0xab7A…` router is the broken bytecode — do not use it.

## If MetaMask shows a huge gas fee
**Symptom**: absurd ETH gas fee on a demo shot / borrow.
**Causes**:
- Wallet has 0 WETH → mint or import the demo account key.
- Frontend pointed at the old router → confirm `demo-manifest.json` `router` is `0xF0AF…515B2`.
```bash
# Mint WETH to your wallet
cast send 0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204 \
  "mint(address,uint256)" <YOUR_WALLET> 1000000000000000000000 \
  --rpc-url $ARB_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY
```

## Files Changed
- `contracts-sol/src/Router.sol` - collateral-agnostic swap fns
- `contracts-sol/script/SimulateArbDemo.s.sol` - deploys router, writes it to manifest
- `frontend/src/components/borrow-demo-tab.tsx` - 18 decimals, gas, router approval
- `frontend/src/hooks/useAttackPresets.ts` - gas config, manifest router
- `frontend/src/components/attack-presets.tsx` - useEstimateGas shape, router prop
- `frontend/src/config/contracts.ts` - router + lending addresses
- `indexer/ponder.config.ts` - manifest-sourced config, zero/0 env treated as unset

## Next Steps
- [ ] E2E test borrow + attack presets with a funded wallet on testnet
- [ ] Consider dynamic gas for mainnet

## Debugging
```bash
# Check WETH balance
cast call 0x6a8273EA01a9f9BCC4cE8D1d681575ce21eF8204 "balanceOf(address)(uint256)" <USER> --rpc-url $ARB_SEPOLIA_RPC

# Simulate borrow against the new router
cast call 0xF0AF8C84655a3E25Cf26Cb88E70E765C157515B2 "executeBorrow(address,bytes32,uint256,uint256)" <LENDING> <CONDITION_ID> <WETH> <USDC> --from <USER> --rpc-url $ARB_SEPOLIA_RPC
```
