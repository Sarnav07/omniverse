import { createClient, cacheExchange, fetchExchange } from "urql";

export const urqlClient = createClient({
  url: "http://localhost:42069/graphql",
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => ({
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  }),
});
