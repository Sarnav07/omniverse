# Tasks

## ✅ Fixed
1. **USDC decimals**: 18→6 (prevented 1000x overborrow)
2. **Gas config**: Added 0.01/0.05 gwei to all writeContract calls
3. **WETH approval**: Changed from ConditionalTokens to WETH.approve
4. **Contract addresses**: Synced with fresh-demo deployment

## 🚧 Pending
- [ ] E2E test borrow with funded wallet
- [ ] Test attack presets on testnet

## 📝 Notes
- Tests: ✅ 20 passing
- Network: Arbitrum Sepolia (421614)
- Decimals: WETH=18, USDC=6
- Gas: 0.01 priority / 0.05 max gwei
