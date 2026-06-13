# OMNIVERSE — Deployment Guide

How to put OMNIVERSE on a public URL so anyone can open it, watch the live demo, verify
trades on Arbiscan, and connect their own wallet.

> **The contracts are already live on Arbitrum Sepolia.** There is *nothing to deploy
> on-chain.* Addresses live in `contracts-sol/deployments/demo-manifest.json`, which both
> the indexer and the frontend read. "Deploying" means hosting **two web services**.

---

## 1. Architecture — what gets hosted

```
                          ┌────────────────────────────────────────┐
   Visitor's browser ──►  │  Frontend  (TanStack Start SSR, :3000)  │
        │                 └───────────────┬────────────────────────┘
        │  (browser also)                 │ GraphQL (server + browser)
        │  reads chain via RPC            ▼
        │                 ┌────────────────────────────────────────┐
        │                 │  Indexer  (Ponder, GraphQL :42069)      │
        │                 │     └─ Postgres (indexed trades/pools)  │
        ▼                 └───────────────┬────────────────────────┘
  Arbitrum Sepolia  ◄────────────────────┘  (RPC: reads events + state)
  (contracts already deployed)
```

Three processes: **Postgres**, **Ponder indexer** (serves GraphQL on `:42069`), **frontend**
(Node SSR server on `:3000`). The frontend's GraphQL calls happen from both the SSR server
*and* the browser, so the indexer must be reachable from the public internet.

---

## 2. One-time code changes already applied

These were committed as part of wiring deployment (without them a public deploy can't work):

| File | Change | Why |
|------|--------|-----|
| `frontend/src/lib/urql.ts` | GraphQL URL now reads `VITE_PONDER_GRAPHQL_URL` (was hardcoded `localhost:42069`) | The browser must hit the *public* indexer, not localhost |
| `indexer/src/api/index.ts` | Added Hono CORS (`PONDER_CORS_ORIGIN`, default `*`) | Browser blocks cross-origin GraphQL without it |
| `indexer/ponder.config.ts` | Manifest read is now optional (`MANIFEST_PATH` + env fallback) | PaaS deploys don't ship `contracts-sol/`; Docker copies the manifest in |

⚠️ `VITE_*` vars are **inlined at build time**, not read at runtime. You must set
`VITE_PONDER_GRAPHQL_URL` / `VITE_RPC_URL` / `VITE_WALLETCONNECT_PROJECT_ID` **before**
`vite build` (the Dockerfile takes them as build args; on Vercel set them as env vars).

---

## 3. The honest constraint — what visitors can and can't do

| Action | Works for a random visitor? |
|--------|------------------------------|
| Landing, proof dashboard (`/demo`), transcript, Arbiscan links, `/explorer`, resolution sim | ✅ Fully live, read-only |
| Connect their own MetaMask | ✅ |
| **Fire an attack swap / borrow** | ⚠️ Only if their wallet holds **Arb-Sepolia WETH** and approves the router |

The pre-funded, pre-approved `demoAccount` private key lives in `contracts-sol/.env` and
**must never** be shipped to a public site. So treat the public URL as a **"watch it work +
verify on-chain"** experience. If you want visitors to trade, tell them to grab Arb-Sepolia
ETH/WETH from a faucet first — the app surfaces an "Approve WETH" step for fresh wallets.

---

## 4. Required accounts (free)

- **Arbitrum Sepolia RPC** — Alchemy or Infura. The public RPC works but is rate-limited and
  the initial sync (~271k blocks from `createdBlock`) is slow and flaky under load.
- **WalletConnect project id** — https://cloud.reown.com (optional; injected MetaMask works
  without it, but mobile/other wallets need it).

---

## Path A — Docker Compose (self-hosted, one box)

Everything is wired in `docker-compose.yml` + `indexer/Dockerfile` + `frontend/Dockerfile`.

### A.1 Local / LAN

```bash
cp .env.docker.example .env
# edit .env: add your RPC key + WalletConnect id. For LOCAL leave the URLs as localhost.
docker compose up --build
```

Open **http://localhost:3000**. First boot: the indexer syncs ~271k blocks (a few minutes;
faster with a dedicated RPC). `/demo` stays empty until the sync passes the demo's trades.

### A.2 Public (a VPS — DigitalOcean / Hetzner / EC2)

The catch: `VITE_PONDER_GRAPHQL_URL` is baked into the browser bundle, so it must be the
**public** indexer URL, not `http://indexer:42069`. Put both services behind HTTPS.

1. **DNS:** point `omniverse.yourdomain.com` → frontend, `indexer.yourdomain.com` → indexer.
2. **`.env` on the server:**
   ```bash
   PONDER_RPC_URL_421614=https://arb-sepolia.g.alchemy.com/v2/<KEY>
   VITE_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/<KEY>
   VITE_PONDER_GRAPHQL_URL=https://indexer.yourdomain.com
   PONDER_CORS_ORIGIN=https://omniverse.yourdomain.com
   VITE_WALLETCONNECT_PROJECT_ID=<id>
   ```
3. **TLS / reverse proxy:** put **Caddy** (simplest — auto HTTPS) or nginx + certbot in front,
   proxying `omniverse.yourdomain.com → frontend:3000` and `indexer.yourdomain.com → indexer:42069`.
   Minimal `Caddyfile`:
   ```
   omniverse.yourdomain.com { reverse_proxy localhost:3000 }
   indexer.yourdomain.com   { reverse_proxy localhost:42069 }
   ```
4. `docker compose up --build -d`

> Because the GraphQL URL is build-time, **changing `VITE_PONDER_GRAPHQL_URL` requires a
> frontend rebuild** (`docker compose up --build frontend`), not just a restart.

### A.3 Persistence & ops

- Postgres data persists in the `pgdata` volume — the indexer won't re-sync on restart.
- To wipe and re-sync: `docker compose down -v && docker compose up --build`.
- Logs: `docker compose logs -f indexer`.

---

## Path B — Managed PaaS (no server to run)

Fastest route to a public URL with auto-HTTPS and domains.

### B.1 Indexer + Postgres → Railway (or Render)

1. New Railway project → **Add Postgres** (gives you `DATABASE_URL`).
2. **Add service** from the `indexer/` directory. Build: `npm ci`; start:
   `npx ponder start --hostname 0.0.0.0 --port $PORT`.
3. Env vars (no `contracts-sol/` ships here, so provide addresses explicitly):
   ```
   DATABASE_URL=<from Railway Postgres>
   PONDER_RPC_URL_421614=https://arb-sepolia.g.alchemy.com/v2/<KEY>
   PONDER_CORS_ORIGIN=https://<your-vercel-app>.vercel.app
   FACTORY_ADDRESS=0xc3DFbA9E807d3AF9d52Ded98277083B7211297d7
   RESOLVER_ADDRESS=0xb99d93a881f633F7426529A76CEAA5Ee0Fab7509
   LENDING_ADDRESS=0x923d6E64B603DdcD80cbd7B47d64093ebD5A4AaA
   START_BLOCK=276588951
   ```
   (Values are from the current `demo-manifest.json`; update if you redeploy contracts. Use
   `createdBlock - 1` for `START_BLOCK`.)
4. Expose the service publicly → note its URL, e.g. `https://omniverse-indexer.up.railway.app`.

### B.2 Frontend → Vercel / Netlify / Cloudflare Pages

TanStack Start has first-class adapters (the Vite config already defaults nitro to the
Cloudflare preset). On Vercel: import the repo, set **root directory = `frontend`**, and add
build-time env vars:
```
VITE_PONDER_GRAPHQL_URL=https://omniverse-indexer.up.railway.app
VITE_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/<KEY>
VITE_WALLETCONNECT_PROJECT_ID=<id>
```
Deploy → set `PONDER_CORS_ORIGIN` on the indexer to the resulting Vercel URL → redeploy
indexer. Done.

---

## 5. Environment variable reference

| Var | Service | Build/Run | Purpose |
|-----|---------|-----------|---------|
| `PONDER_RPC_URL_421614` | indexer | run | Arb-Sepolia RPC for indexing |
| `DATABASE_URL` | indexer | run | Postgres (omit ⇒ bundled PGlite, dev only) |
| `PONDER_CORS_ORIGIN` | indexer | run | Allowed frontend origin(s), comma-sep or `*` |
| `FACTORY/RESOLVER/LENDING_ADDRESS`, `START_BLOCK` | indexer | run | Override manifest (required when manifest absent) |
| `MANIFEST_PATH` | indexer | run | Custom manifest location |
| `VITE_PONDER_GRAPHQL_URL` | frontend | **build** | Public indexer URL the browser hits |
| `VITE_RPC_URL` | frontend | **build** | Browser-side on-chain reads |
| `VITE_WALLETCONNECT_PROJECT_ID` | frontend | **build** | WalletConnect (optional) |

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `/demo` empty after deploy | Indexer still syncing (~271k blocks). Watch `docker compose logs -f indexer`; speed up with a dedicated RPC. |
| Browser console: CORS / blocked GraphQL | `PONDER_CORS_ORIGIN` doesn't include the frontend origin. Set it, restart indexer. |
| GraphQL calls go to `localhost:42069` in prod | Frontend was built without `VITE_PONDER_GRAPHQL_URL`. Rebuild with it set (it's build-time). |
| Indexer scans from genesis (~1.8M blocks) | Stale `START_BLOCK`/`FACTORY_ADDRESS` env overriding the manifest, or manifest missing and `START_BLOCK` unset. |
| Frontend container exits / no server file | nitro emitted a different path than `.output/server/index.mjs`. Check the build output and adjust the Dockerfile `COPY`/`CMD` (see comment in `frontend/Dockerfile`). |
| Huge gas fee in MetaMask | Visitor wallet has 0 WETH (expected for fresh wallets — see §3). |

---

## 7. Redeploying the contracts (only if you need a fresh market)

Not needed for hosting the existing demo. If you do redeploy, run `./fresh-demo.sh` (writes a
new `demo-manifest.json` + copies it to `frontend/public/`), then: rebuild the Docker images
(the indexer copies the manifest at build), or update the `*_ADDRESS` + `START_BLOCK` env vars
on Railway, and bump `START_BLOCK` to the new `createdBlock - 1`.
