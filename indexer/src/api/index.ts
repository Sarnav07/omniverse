import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { graphql } from "ponder";

const app = new Hono();

// Allow the deployed frontend origin to query GraphQL from the browser. On the same
// machine (local dev) CORS never fires; once the frontend is on its own domain the
// browser blocks cross-origin reads without this. PONDER_CORS_ORIGIN is a comma-
// separated allowlist; default "*" is safe here since all indexed data is public
// on-chain state. e.g. PONDER_CORS_ORIGIN=https://omniverse.vercel.app
const corsOrigins = (process.env.PONDER_CORS_ORIGIN ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  "*",
  cors({
    origin: corsOrigins.length === 1 && corsOrigins[0] === "*" ? "*" : corsOrigins,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

// Register /graphql BEFORE the catch-all root "/" handler.
// Hono's app.use("/", ...) matches ALL paths (prefix match), so if registered
// first it would intercept /graphql requests and serve the GraphiQL playground
// HTML instead of processing POST queries.
app.use("/graphql", graphql({ db, schema }));
app.use("/", graphql({ db, schema }));

export default app;
