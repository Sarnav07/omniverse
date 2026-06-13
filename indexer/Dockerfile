# syntax=docker/dockerfile:1
# Build context MUST be the repo root (see docker-compose.yml) so we can copy the
# live demo-manifest.json that ponder.config.ts reads as the single source of truth.
FROM node:20-slim AS base
WORKDIR /app/indexer

# 1) Deps first for layer caching
COPY indexer/package.json indexer/package-lock.json ./
RUN npm ci

# 2) Indexer source
COPY indexer/ ./

# 3) The manifest (addresses + START_BLOCK). ponder.config.ts defaults to
#    ../contracts-sol/deployments/demo-manifest.json relative to the indexer cwd.
#    On a PaaS without this file, set FACTORY/RESOLVER/LENDING_ADDRESS + START_BLOCK instead.
COPY contracts-sol/deployments/demo-manifest.json /app/contracts-sol/deployments/demo-manifest.json

ENV NODE_ENV=production
EXPOSE 42069

# `ponder start` runs the indexer AND serves GraphQL on one process (single instance).
# Binds 0.0.0.0 so the container is reachable. DATABASE_URL (Postgres) is injected by compose.
CMD ["npx", "ponder", "start", "--hostname", "0.0.0.0", "--port", "42069"]
