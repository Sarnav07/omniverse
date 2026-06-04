# Lessons

## Verify the full value round-trip, not just intermediate balances
When reviewing settlement/redemption/escrow flows, prove that value can actually be
withdrawn after the TERMINAL state, end to end. In MultiverseLending, settle() redeemed
the 1155 positions to raw ERC20 and burned them, but withdraw() still transferred the
(now non-existent) position id and reverted — funds locked. The tests passed because they
only asserted the contract's balances after settle, never that a user could pull value out.
Tautological/vacuous tests hide this. Always ask: "after the last state transition, who
calls what to get their money, and does that call succeed?"

## A trap test must assert the protocol invariant, not an artifact of the mock
The cross-leg-borrow test asserted the CTF mock's "not approved" string instead of the
lending invariant (borrow only ever moves the YES-debt id). Rewrite such tests to exercise
the real claim so they'd fail if the invariant broke.

## CTF positionIds: never hand-derive
Real Gnosis CTF collection ids are alt_bn128 EC point math, not keccak. Read the 4
positionIds from the deployed CTF (getCollectionId/getPositionId) at setup; a keccak
mock will pass tests but the code breaks against the audited artifact.
