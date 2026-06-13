# Submission Readiness Scan

**Date:** 2026-06-13
**Branch:** `stylus-math`
**Verdict:** **Demo-ready now; submission-ready after items 1–2 below.**

---

## ✅ Green

| Check | Result |
|---|---|
| Frontend production build | ✅ `vite build` OK (client + `dist/server/server.js`) |
| Frontend tests | ✅ 14/14 (7 files) |
| Solidity tests | ✅ 71/72 (math kernel mirror 5/5: reference values, Φ⁻¹ round-trips, poolValue/λ) |
| Router/Pool integration tests | ✅ buyYes / buyNo / addLiquidity pass |
| Runtime manifest sync | ✅ `frontend/public/demo-manifest.json` == source-of-truth (router `0x2D25…F2E3`) |
| Live deployment | ✅ contracts already live on Arbitrum Sepolia |
| Deploy tooling | ✅ Docker stack + `DEPLOYMENT.md` added |
| Math audit | ✅ on-chain kernel faithful to `gaussian_lambda_star.pdf` (see `docs/MATH_AUDIT.md`) |

## ⚠️ Gaps to clear before submitting

1. **Frontend λ\*/W-curve is cosmetically wrong** *(highest priority for a math-paper submission)*
   — `/explorer` and `w-curve-live.tsx` draw a dome / S-curve, contradicting the paper's headline
   W-shape. The contracts compute λ\* correctly; only the UI misrepresents it. See
   `docs/MATH_AUDIT.md`. ~15-line fix (port the real λ\*(P) or sweep `lambdaStarGaussian`).
2. **2 pre-existing TypeScript errors** (`market-card.tsx:27`, `useAttackPresets.ts:143`) — do not
   block the build (esbuild strips types) but are a code-smell. Both trivial: a `Link to`
   template-string and a possibly-undefined address. ~2 lines each.
3. **Docker frontend serve path unverified.** Default build emits `dist/server/server.js`, but
   `frontend/Dockerfile` assumes the nitro `node-server` preset emits `.output/server/index.mjs`.
   Needs one real `docker build` to confirm the CMD path. The documented **dev-mode demo path is
   proven**; only the production Docker-serve of the frontend is untested (indexer Docker is fine).
4. **Uncommitted work** — deploy files, `docs/MATH_AUDIT.md`, the code fixes, and
   `gaussian_lambda_star.pdf` are uncommitted; nothing pushed yet.

## 🟡 Known, non-blocking

- 1 Solidity test (`KernelIntegration`) fails locally **by design** — needs a forked chain with
  the deployed WASM kernel; Foundry's EVM has no Stylus runtime. Math is covered by the Solidity
  mirror tests.
- Off-invariant seed (cosmetic first-trade distortion; demo works) — see `docs/MATH_AUDIT.md`.

---

## Priority for submission

| # | Item | Effort | Blocks submission? |
|---|---|---|---|
| 1 | W-curve truth-fix (render real W-shape) | ~15 lines | Yes (misrepresents headline result) |
| 2 | Fix 2 TS errors | ~4 lines | No (code-smell) |
| 3 | Verify Docker frontend CMD path | 1 `docker build` | Only if deploying via Docker |
| 4 | Commit + push | — | No |
