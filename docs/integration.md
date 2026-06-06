# Build Task Breakdown

> **Monorepo** · Bun + Vite + React · RainbowKit · Ponder (partially running) · Arbitrum Sepolia
>
> **Execution order:** Complete Task A first (you can't wire anything without real addresses), then run Tasks B and C in parallel (they're independent of each other), then run Task D last once A, B, and C are all complete.

---

## Task A — Contract finalization & deployment

### A1 — Audit Solidity wrappers

**Goal:** Confirm every Stylus contract has a working Solidity wrapper before touching anything else.

> **Status:** ✅ COMPLETED.

1. In the monorepo, navigate to the contracts directory (wherever your `.sol` files live alongside the Rust source).
2. Open each Solidity wrapper file (e.g. `OmniverseTrade.sol`, any wrapper for `PmAmmPool`, `MarketFactory`, `MultiverseLending`).
3. For each wrapper, verify:
   - It imports or references the correct Stylus entrypoint (usually via a `delegatecall` pattern or a precompile address).
   - Every public/external function that the frontend needs to call is exposed — cross-reference against the existing ABI JSON files in the `/abi` folder.
   - The function signatures in the `.sol` file match the function signatures in the ABI JSON exactly (name, parameter types, return types).
4. If any wrapper is missing a function that exists in the ABI JSON, add it to the wrapper now.
5. Do **not** change the ABI JSON files yet — treat them as the source of truth until after deployment.

---

### A2 — Use exported TypeScript ABIs

**Goal:** Ensure the ABI files the frontend and indexer will consume are clean and imported properly.

> **Status:** ✅ COMPLETED.

1. Your ABIs are already perfectly exported as strongly-typed TypeScript `const` assertions inside the `indexer/abis/` folder (e.g., `MarketFactory.ts`).
2. There is no need to extract these into raw JSON files. Both the frontend and Ponder can import these `.ts` files directly.
3. Verify that the frontend can import these files seamlessly for `wagmi` usage.

---

### A3 — Deploy to Arbitrum Sepolia

**Goal:** Get live contract addresses on Arbitrum Sepolia testnet.

> **Status:** ✅ COMPLETED.
> Deployed Rust WASM kernel to `0x45d00cfa00551e8c8df27dbf44751f56820a07a4` and redeployed full Solidity stack.

1. Make sure your wallet has Arbitrum Sepolia ETH. Get it from `https://faucet.quicknode.com/arbitrum/sepolia`.
2. In your contracts directory, check whether you're using Foundry or Hardhat.
   - **Foundry:** there should be a `script/Deploy.s.sol` or similar. If not, create one. Deploy each contract in dependency order (e.g. `MarketFactory` first, then `PmAmmPool` referencing the factory address, then `OmniverseTrade`).
   - **Hardhat:** there should be a `scripts/deploy.ts`. Same dependency-order logic applies.
3. Set environment variables before running the deploy:
   ```
   PRIVATE_KEY=<your_deployer_wallet_private_key>
   ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
   ```
4. Run the deploy:
   - Foundry: `forge script script/Deploy.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast`
   - Hardhat: `npx hardhat run scripts/deploy.ts --network arbitrumSepolia`
5. If deploying a Stylus contract (Rust/Wasm), use `cargo stylus deploy --private-key $PRIVATE_KEY --endpoint $ARBITRUM_SEPOLIA_RPC` for each Rust crate first, then deploy the Solidity wrappers pointing at the Stylus program addresses.
6. Confirm each transaction on `https://sepolia.arbiscan.io`.

---

### A4 — Save contract addresses

**Goal:** Store deployed addresses where both the frontend and the Ponder indexer can read them.

> **Status:** ✅ COMPLETED.
> Updated `contracts.json` and `frontend/src/config/contracts.ts`.

1. Create a file at the root of the monorepo: `contracts.json`:
   ```json
   {
     "421614": {
       "OmniverseTrade": "0x...",
       "PmAmmPool": "0x...",
       "MarketFactory": "0x...",
       "MultiverseLending": "0x..."
     }
   }
   ```
   `421614` is the chain ID for Arbitrum Sepolia.

2. Create or update `frontend/src/config/contracts.ts`:
   ```ts
   export const CONTRACT_ADDRESSES = {
     OmniverseTrade: "0x..." as `0x${string}`,
     PmAmmPool: "0x..." as `0x${string}`,
     MarketFactory: "0x..." as `0x${string}`,
     MultiverseLending: "0x..." as `0x${string}`,
   } as const;
   ```
3. Update the Ponder config to reference these addresses (covered in Task C1).

---

## Task B — Wagmi + RainbowKit integration

### B1 — Install dependencies

**Goal:** Add all required packages to the frontend.

1. Navigate to the frontend package inside your monorepo (wherever your `vite.config.ts` lives).
2. Run:
   ```
   bun add @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
   ```
3. Verify `bun.lockb` was updated and no peer dependency errors were printed.
4. Do **not** install `ethers.js` — your stack uses `viem` directly.

---

### B2 — Add wagmi + RainbowKit provider to `__root.tsx`

**Goal:** Wrap the entire app in the required providers so wallet state is available everywhere.

1. Open `frontend/src/routes/__root.tsx`.
2. Add these imports at the top:
   ```ts
   import '@rainbow-me/rainbowkit/styles.css';
   import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
   import { WagmiProvider } from 'wagmi';
   import { arbitrumSepolia } from 'wagmi/chains';
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
   ```
3. Before the component, define the wagmi config and query client:
   ```ts
   const wagmiConfig = getDefaultConfig({
     appName: '<Your App Name>',
     projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
     chains: [arbitrumSepolia],
     ssr: false,
   });

   const queryClient = new QueryClient();
   ```
4. Wrap the existing `<Outlet />` with the three providers in this exact order — outer to inner: `WagmiProvider` → `QueryClientProvider` → `RainbowKitProvider`:
   ```tsx
   <WagmiProvider config={wagmiConfig}>
     <QueryClientProvider client={queryClient}>
       <RainbowKitProvider>
         {/* existing app content / <Outlet /> */}
       </RainbowKitProvider>
     </QueryClientProvider>
   </WagmiProvider>
   ```
5. Create or update the `.env` file at the frontend root:
   ```
   VITE_WALLETCONNECT_PROJECT_ID=<get_from_cloud.walletconnect.com>
   ```
   Register a free project at `https://cloud.walletconnect.com` to get the ID.
6. Add `VITE_WALLETCONNECT_PROJECT_ID` to `.env.example` with a placeholder value so other contributors know it's required.

---

### B3 — Replace the mock `WalletButton` component

**Goal:** Remove the hardcoded `0x4B…3f9` mock and wire up a real wallet connection button.

1. Find the existing `<WalletButton />` component file (search for the mock address `0x4B` in the codebase).
2. For a simple drop-in replacement:
   ```tsx
   import { ConnectButton } from '@rainbow-me/rainbowkit';

   export function WalletButton() {
     return <ConnectButton />;
   }
   ```
3. If you need to match the existing button's visual style to fit inside `NavBar`, use RainbowKit's custom render prop API:
   ```tsx
   import { ConnectButton } from '@rainbow-me/rainbowkit';

   export function WalletButton() {
     return (
       <ConnectButton.Custom>
         {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
           if (!mounted) return null;
           if (!account) {
             return <button onClick={openConnectModal}>Connect wallet</button>;
           }
           return (
             <button onClick={openAccountModal}>
               {account.displayName}
             </button>
           );
         }}
       </ConnectButton.Custom>
     );
   }
   ```
4. Remove the pulsing green dot and any mock state (`useState` for the fake address) from the old component entirely.
5. Test: run `bun dev`, click the button, and confirm MetaMask or Rabby opens the connection modal.

---

### B4 — Replace `simulateTransaction()` with `useWriteContract` hooks

**Goal:** Wire the "Sign" / "Confirm" buttons on the Simulate page to real on-chain calls.

1. Find the file containing `simulateTransaction()` — likely `frontend/src/routes/simulate.tsx` or a nearby hook file.
2. Add these imports at the top of that file (or in a dedicated `hooks/useOmniverseTrade.ts`):
   ```ts
   import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
   import OmniverseTradeABI from '../abis/OmniverseTrade.abi.json';
   import { CONTRACT_ADDRESSES } from '../config/contracts';
   ```
3. Replace the mock call with a real hook:
   ```ts
   const { writeContract, data: txHash, isPending } = useWriteContract();

   function handleSign() {
     writeContract({
       address: CONTRACT_ADDRESSES.OmniverseTrade,
       abi: OmniverseTradeABI,
       functionName: '<the actual function name from ABI>',
       args: [/* the actual arguments from your form state */],
     });
   }

   const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
     hash: txHash,
   });
   ```
4. Replace the `sonner` mock toast calls:
   - `isPending === true` → `toast.loading('Waiting for wallet...')`
   - `isConfirming === true` → `toast.loading('Transaction submitted...')`
   - `isSuccess === true` → `toast.success('Transaction confirmed')`
   - On error → `toast.error(error.message)`
5. Repeat this pattern for every other button that previously called `simulateTransaction()`. Each distinct contract function needs its own `useWriteContract` call.
6. Disable every submit button when `isPending || isConfirming` to prevent double-submission.

---

## Task C — Ponder indexer completion

### C1 — Audit the existing `ponder.config.ts`

**Goal:** Make sure the config references real deployed contract addresses and correct ABIs before running anything.

> **Status:** ✅ COMPLETED.
> Updated `indexer/ponder.config.ts` with new addresses and start block 274270902.

1. Open `/indexer/ponder.config.ts` (or `/ponder/ponder.config.ts`).
2. Find the `contracts` section:
   ```ts
   contracts: {
     PmAmmPool: {
       abi: PmAmmPoolABI,
       address: "0x000...",
       startBlock: 0,
     },
   }
   ```
3. Replace every placeholder address with the real deployed addresses from `contracts.json` (Task A4).
4. Set `startBlock` to the actual deployment block for each contract (find it on Arbiscan). Setting it to `0` forces a full scan from genesis, which is extremely slow.
5. Verify the `network` section points to Arbitrum Sepolia:
   ```ts
   networks: {
     arbitrumSepolia: {
       chainId: 421614,
       transport: http(process.env.PONDER_RPC_URL),
     },
   }
   ```
6. Add to the indexer's `.env` file:
   ```
   PONDER_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
   ```
7. Confirm the ABI imports at the top of the file point to the same ABI JSON files from Task A2. If they're duplicated inside `/indexer/abis/`, replace with a relative import pointing to the shared canonical location.

---

### C2 & C3 — Schema & Event Handlers (ALREADY COMPLETED)

**Goal:** Define the database schema and write event handlers.

> **Status:** ✅ ALREADY DONE.
> The schema is fully implemented in `indexer/ponder.schema.ts`.
> The event handlers are fully written in `indexer/src/PmAmmPool.ts`, `indexer/src/MarketFactory.ts`, etc.

You can skip writing these and proceed directly to testing the GraphQL endpoint!

---

### C4 — Test the GraphQL endpoint locally

**Goal:** Confirm the indexer runs, syncs, and exposes a working GraphQL endpoint before the frontend tries to query it.

1. From the `/indexer` directory, run `bun run dev` (or whatever the existing `package.json` dev script says).
2. Ponder will start and print a local URL, typically `http://localhost:42069`.
3. Open `http://localhost:42069` in a browser — this is the Ponder GraphQL playground.
4. Run this test query:
   ```graphql
   query {
     markets(limit: 10) {
       items {
         id
         question
         yesPrice
         noPrice
         tvl
         status
       }
     }
   }
   ```
5. If the indexer is still syncing (expected on first run), wait for it to catch up past the contract deployment block. Real market data should appear once synced.
6. If you get schema errors, recheck that the field names in the query match exactly what was defined in C2.
7. Once queries return correct data, the indexer is ready for the frontend.

---

## Task D — Frontend data wiring

> **Prerequisite:** Tasks A, B, and C must all be complete before starting Task D.

### D1 — Replace hardcoded `MARKETS` array

**Goal:** Remove static mock data from the Markets page and prepare it to receive live data.

1. Find the file containing the `MARKETS` array constant — likely `frontend/src/routes/markets.tsx` or a nearby `data/markets.ts`.
2. Do not delete it yet. Rename the constant to `MOCK_MARKETS` and add a comment: `// TODO: remove after D2 is complete`.
3. Define a TypeScript type matching the Ponder schema from C2:
   ```ts
   export type Market = {
     id: string;
     question: string;
     yesPrice: number;
     noPrice: number;
     tvl: bigint;
     volume: bigint;
     status: 'OPEN' | 'CLOSED' | 'RESOLVED';
     createdAt: number;
     resolvedAt?: number;
     outcome?: boolean;
   };
   ```
4. In `markets.$id.tsx`, identify every hardcoded field reference (TVL, probabilities, market name, etc.) and confirm they match the field names in the `Market` type. Rename any that don't match.

---

### D2 — Install and configure `urql`

**Goal:** Add a GraphQL client to query the Ponder indexer.

1. From the frontend package directory, run: `bun add urql graphql`.
2. Create `frontend/src/lib/urql.ts`:
   ```ts
   import { createClient, cacheExchange, fetchExchange } from 'urql';

   export const urqlClient = createClient({
     url: import.meta.env.VITE_PONDER_GRAPHQL_URL,
     exchanges: [cacheExchange, fetchExchange],
   });
   ```
3. Add to `.env`:
   ```
   VITE_PONDER_GRAPHQL_URL=http://localhost:42069
   ```
   When deployed, update this to the production Ponder server URL.
4. In `__root.tsx`, add the urql provider inside the existing provider tree from B2:
   ```tsx
   import { Provider as UrqlProvider } from 'urql';
   import { urqlClient } from '../lib/urql';

   // Wrap inside the existing providers:
   <UrqlProvider value={urqlClient}>
     {/* existing providers */}
   </UrqlProvider>
   ```

---

### D3 — Replace hardcoded market data with live GraphQL queries

**Goal:** The Markets page and individual market page fetch real data from Ponder.

1. In `frontend/src/routes/markets.tsx`, replace the `MOCK_MARKETS` usage:
   ```tsx
   import { useQuery } from 'urql';

   const MARKETS_QUERY = `
     query {
       markets(limit: 50, orderBy: "createdAt", orderDirection: "desc") {
         items {
           id
           question
           yesPrice
           noPrice
           tvl
           volume
           status
         }
       }
     }
   `;

   export function MarketsPage() {
     const [result] = useQuery({ query: MARKETS_QUERY });
     const { data, fetching, error } = result;

     if (fetching) return <div>Loading markets...</div>;
     if (error) return <div>Error: {error.message}</div>;

     const markets: Market[] = data?.markets?.items ?? [];
     // render markets using the same UI as before, but with live data
   }
   ```

2. In `frontend/src/routes/markets.$id.tsx`, replace hardcoded market data:
   ```tsx
   const MARKET_BY_ID_QUERY = `
     query MarketById($id: String!) {
       market(id: $id) {
         id
         question
         yesPrice
         noPrice
         tvl
         volume
         status
         createdAt
       }
     }
   `;

   // In the component:
   const { id } = useParams({ from: '/markets/$id' });
   const [result] = useQuery({
     query: MARKET_BY_ID_QUERY,
     variables: { id },
   });
   ```
3. Keep the same visual components and layout — only swap out the data source. Show skeleton placeholders in the same shape as the existing cards while `fetching` is true.

---

### D4 — Remove all remaining mocks

**Goal:** Every user-visible action that currently shows a fake toast either triggers a real transaction or displays a real error.

1. Search `frontend/src/` for:
   - `simulateTransaction`
   - `setTimeout` used to fake a loading delay
   - `Math.random()` used to fake a result
2. For each instance found:
   - If it's a transaction action (buy, sell, add liquidity, remove liquidity) → replace with the `useWriteContract` pattern from B4.
   - If it's a data fetch (loading a price, loading TVL) → replace with a urql query from D3.
   - If it's purely UI feedback with no blockchain action (e.g. "copied to clipboard") → leave it, it's not a mock.
3. On the Explorer page, if any chart or table is populated with random/static data, replace it with a urql query aggregating from the Ponder `Market` and `Position` entities.
4. Once all mocks are removed, search for `// TODO: remove after D2 is complete` and delete the `MOCK_MARKETS` constant and its import.

---

## Dependency summary

| Task | Depends on | Can run in parallel with |
|------|-----------|--------------------------|
| A1 → A4 | Nothing | B1–B3, C1, C4 |
| B1 → B3 | Nothing | A, C |
| B4 | A4 (needs contract addresses) | C4 |
| C1 | Nothing | A, B |
| C4 | A4 (needs real addresses in config) | B4 |
| D1 → D4 | A4, B4, C4 | — |