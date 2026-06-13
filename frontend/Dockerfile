# syntax=docker/dockerfile:1
# Build context = ./frontend (it ships its own public/demo-manifest.json).

###################### build stage ######################
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# VITE_* vars are INLINED at build time, so they must be present for `bun run build`.
# IMPORTANT: VITE_PONDER_GRAPHQL_URL is consumed by the *browser*, so it must be the URL
# the visitor's browser can reach (e.g. https://indexer.yourdomain.com) — NOT the
# docker-internal http://indexer:42069.
ARG VITE_PONDER_GRAPHQL_URL
ARG VITE_WALLETCONNECT_PROJECT_ID
ARG VITE_RPC_URL
ENV VITE_PONDER_GRAPHQL_URL=$VITE_PONDER_GRAPHQL_URL \
    VITE_WALLETCONNECT_PROJECT_ID=$VITE_WALLETCONNECT_PROJECT_ID \
    VITE_RPC_URL=$VITE_RPC_URL \
    SERVER_PRESET=node-server

RUN bun run build

###################### run stage ######################
FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000

# nitro's node-server preset emits a self-contained server at .output/server/index.mjs.
# If your build instead emits dist/server/server.js (Lovable config quirk), change the
# COPY + CMD below to that path.
COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
