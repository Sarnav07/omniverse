import { createClient, cacheExchange, fetchExchange } from "urql";

// Indexer GraphQL endpoint. VITE_* vars are static-replaced by Vite at BUILD time
// (not read at runtime), so VITE_PONDER_GRAPHQL_URL must be set before `vite build`.
// Falls back to the local Ponder dev server for local development.
const PONDER_GRAPHQL_URL =
  import.meta.env.VITE_PONDER_GRAPHQL_URL ?? "http://localhost:42069";

export const urqlClient = createClient({
  url: `${PONDER_GRAPHQL_URL}/graphql`,
  // urql v6 defaults preferGetMethod to 'within-url-limit', which sends short
  // GraphQL queries as GET requests.  Ponder's graphql middleware returns the
  // GraphiQL playground HTML for ALL GET requests, so we must force POST.
  preferGetMethod: false,
  exchanges: [cacheExchange, fetchExchange],
});

