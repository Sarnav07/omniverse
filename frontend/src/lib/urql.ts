import { createClient, cacheExchange, fetchExchange } from "urql";

export const urqlClient = createClient({
  url: import.meta.env.VITE_PONDER_GRAPHQL_URL || "http://localhost:42069",
  exchanges: [cacheExchange, fetchExchange],
});
