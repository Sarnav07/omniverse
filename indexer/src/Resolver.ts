import { ponder } from "ponder:registry";
import { market } from "../ponder.schema";
import { eq } from "drizzle-orm";

ponder.on("Resolver:Resolved", async ({ event, context }) => {
  const { db } = context;
  const { questionId, payouts } = event.args;

  // Binary event: payouts[0] > 0 means slot 0 (YES) won.
  const yesWon = payouts[0] > 0n;

  // In Ponder, db.update requires the primary key (conditionId).
  // We can use the db.sql driver (Drizzle) to update by questionId.
  await db.sql.update(market).set({
    resolved: true,
    yesWon,
  }).where(eq(market.questionId, questionId));
});
