import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql } from "ponder";

const app = new Hono();

// Register /graphql BEFORE the catch-all root "/" handler.
// Hono's app.use("/", ...) matches ALL paths (prefix match), so if registered
// first it would intercept /graphql requests and serve the GraphiQL playground
// HTML instead of processing POST queries.
app.use("/graphql", graphql({ db, schema }));
app.use("/", graphql({ db, schema }));

export default app;
