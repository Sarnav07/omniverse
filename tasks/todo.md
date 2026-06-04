# Phase 4 + Phase 5 — MarketFactory & MultiverseLending

Baseline: 24/24 forge tests green. Phases 1-3 (CTF custody, Solidity math, pool) landed by teammate in b5f5b49.

## Frozen interfaces (against real code)

PmAmmPool constructor:
`(IOmniverseMath math, IConditionalTokens ctf, address collateral, bytes32 conditionId, uint256 marketId, uint256 xInitial, uint256 yInitial, uint256 l0, uint256 expiry, uint256 gammaPrime, bool dynamicLambda)`

Pool reads for lending: `currentPrice()` (=Phi(z)=P(YES)), `gap()` (int256), `conditionId()`, `yesPositionId()`, `noPositionId()`, `collateralToken()`.
positionIds via `CtfPositionLib.yesPositionId/noPositionId(collateral, conditionId)`.
Mock CTF resolve: `reportPayouts(bytes32 conditionId, uint256 winningIndexSet)`; redeem via `redeemPositions(collateral, 0, conditionId, indexSets)`.

## Tasks

- [ ] Phase 4: MarketFactory.sol — `createEvent(...)` -> prepareCondition + 2 universes (WETH tradeable, USDC debt) + pool per universe, one shared conditionId; registry + getters
- [ ] Phase 4: MarketFactory.t.sol — shared conditionId across universes, positionId recompute, marketsOfCondition length==2, duplicate handled
- [ ] Phase 5: IPriceOracle.sol + MockPriceOracle.sol (p_ETH, fail-closed shape, mockable)
- [ ] Phase 5: MultiverseLending.sol — deposit/borrow/repay/withdraw/settle, HF with P(YES) cancellation, LTV_max(g) clamped-linear, ERC1155Holder + nonReentrant + CEI
- [ ] Phase 5: MultiverseLending.t.sol — the 4 non-negotiable traps as required tests
- [ ] Audit Phases 1-3 for discrepancies -> DISCREPANCIES.md (keccak-vs-EC collectionId, reportPayouts signature, interface gaps)
- [ ] Lead: integrate, run full `forge test`, human-written check, summary

## Review

Phase 4 (MarketFactory) + Phase 5 (MultiverseLending) built by a 3-agent team (factory-dev,
lending-dev, auditor). Baseline 24 tests -> 49 tests, all green.

Discrepancies found + fixed during the run:
- H-1 (keccak vs alt_bn128 collectionId): pool + lending now read positionIds from the CTF
  (getCollectionId/getPositionId) -> correct against the real Gnosis artifact, not just the mock.
- P45-H1 (settle locked funds): added oracle-priced net settlement (settle + claimBorrower +
  claimLender), conservation proven YES/NO, multi-party. No funds stranded.
- P45-H2: notSettled/onlySettled gating on all mutators + claims.
- P45-M1: _ltvMax guards int256.min abs.
- P45-L1: trap-#2 test rewritten to a lending invariant (not a CTF mock string).
- Cleanup: IERC20Minimal gained approve(); removed the one-off IERC20Approve + needless setApprovalForAll.

Remaining known (documented in DISCREPANCIES.md, not blocking the demo):
- Real Gnosis CTF must be the deployed artifact (we use a keccak mock in tests; prod reads ids from it).
- reportPayouts shape differs in mock vs real CTF -> Phase 6 resolver wiring.
- Unchecked ERC20 return values (fine for the tokens in scope; SafeERC20 later).

