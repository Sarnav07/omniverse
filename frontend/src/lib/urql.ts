import { createClient, cacheExchange, fetchExchange } from "urql";

export const urqlClient = createClient({
  url: "http://localhost:42069/graphql",
  // urql v6 defaults preferGetMethod to 'within-url-limit', which sends short
  // GraphQL queries as GET requests.  Ponder's graphql middleware returns the
  // GraphiQL playground HTML for ALL GET requests, so we must force POST.
  preferGetMethod: false,
  exchanges: [cacheExchange, fetchExchange],
});

