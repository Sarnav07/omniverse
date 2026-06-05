import { ponder } from "ponder:registry";
import { lendingAction } from "../ponder.schema";

/** Helper to insert a lending action row */
async function insertLendingAction(
  db: any,
  event: any,
  action: string,
  user: string,
  amount: bigint | null = null,
  amount2: bigint | null = null,
  yesWon: boolean | null = null
) {
  await db.insert(lendingAction).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    lending: event.log.address,
    user,
    action,
    amount,
    amount2,
    yesWon,
    timestamp: Number(event.block.timestamp),
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
  });
}

ponder.on("MultiverseLending:ReserveSeeded", async ({ event, context }) => {
  await insertLendingAction(context.db, event, "seed", event.args.from, event.args.amount);
});

ponder.on("MultiverseLending:Deposited", async ({ event, context }) => {
  await insertLendingAction(context.db, event, "deposit", event.args.user, event.args.amount);
});

ponder.on("MultiverseLending:Borrowed", async ({ event, context }) => {
  await insertLendingAction(context.db, event, "borrow", event.args.user, event.args.amount);
});

ponder.on("MultiverseLending:Repaid", async ({ event, context }) => {
  await insertLendingAction(context.db, event, "repay", event.args.user, event.args.amount);
});

ponder.on("MultiverseLending:Withdrawn", async ({ event, context }) => {
  await insertLendingAction(context.db, event, "withdraw", event.args.user, event.args.amount);
});

ponder.on("MultiverseLending:Settled", async ({ event, context }) => {
  // Settle doesn't have a specific user (it's a global state change)
  await insertLendingAction(
    context.db,
    event,
    "settle",
    "0x0000000000000000000000000000000000000000", // Protocol address
    null,
    null,
    event.args.yesWon
  );
});

ponder.on("MultiverseLending:BorrowerClaimed", async ({ event, context }) => {
  await insertLendingAction(context.db, event, "claim_borrower", event.args.user, event.args.wethOut);
});

ponder.on("MultiverseLending:LenderClaimed", async ({ event, context }) => {
  await insertLendingAction(context.db, event, "claim_lender", event.args.user, event.args.wethOut, event.args.usdcOut);
});
