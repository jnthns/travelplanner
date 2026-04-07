---
topic: Deployment and Configuration
last_compiled: 2026-04-04
source_count: 3
status: active
---

# Deployment and Configuration

## Summary

TravelPlanner uses a two-tier deployment model: the React frontend is hosted on GitHub Pages and the AI proxy runs as a Cloudflare Worker. Environment configuration is split between frontend `.env` variables (consumed by Vite at build time) and Cloudflare Worker secrets (set via the Cloudflare dashboard or `wrangler secret put`). Firebase handles authentication and Firestore; its security rules are deployed separately via the Firebase CLI. There is no test suite — the only quality gate before deployment is TypeScript type-checking and ESLint, both run as part of `npm run build`.

## Timeline

- Initial setup established Firebase (Firestore + Auth) as the data layer with a Vite/React frontend.
- A Cloudflare Worker was introduced as an AI proxy to avoid exposing Gemini API keys in the frontend bundle and to enforce per-IP rate limiting, model allowlisting, and Firebase JWT validation.
- GitHub Actions CI/CD was configured to automatically deploy the frontend to GitHub Pages on every push to `main`.
- Firebase Storage was scoped to `notes/{userId}/{tripId}/...` with image-only uploads capped at 5 MB.
- The `GEMINI_API_KEY` secret was later expanded to `GEMINI_API_KEYS` (comma-separated) to support key rotation and multiple keys; the legacy single-key name is still accepted.

## Current State

### Two-Tier Deployment

**Tier 1 — GitHub Pages (frontend)**
The Vite-built React app is served as a static site from GitHub Pages. Deployment is fully automated: a push to `main` triggers `.github/workflows/deploy.yml`, which builds the project and publishes the output. No manual step is required. The Vite base path is hard-coded to `/travelplanner/`, which must be accounted for in any URL or route construction.

**Tier 2 — Cloudflare Worker (AI proxy)**
The worker lives in `worker/src/index.ts` and is deployed manually via Wrangler:

```bash
cd worker && npx wrangler deploy
```

The worker proxies Gemini API requests from the frontend, validates Firebase JWTs, enforces per-IP rate limits, restricts which Gemini models can be called, and limits request body size. It also exposes `/places/nearby` and `/places/details` routes so the frontend never calls `places.googleapis.com` directly.

**Firebase rules**
Firestore and Storage security rules are deployed independently from both tiers:

```bash
firebase deploy --only firestore:rules,storage
```

### Environment Variable Split

**Frontend `.env` (Vite build-time)**

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_AI_PROXY_URL` | URL of the deployed Cloudflare Worker |

These variables are inlined into the JS bundle at build time by Vite. For GitHub Pages deployments, they must be added as repository secrets in GitHub settings (not only in a local `.env` file) so the Actions runner can access them during the build.

**Cloudflare Worker secrets (`wrangler secret put <NAME>`)**

| Secret | Purpose |
|---|---|
| `GEMINI_API_KEYS` | Comma-separated Gemini API keys (preferred) |
| `GEMINI_API_KEY` | Legacy single key (still accepted) |
| `GOOGLE_PLACES_API_KEY` | Google Places API (New) key |
| `FIREBASE_PROJECT_ID` | Must exactly match `VITE_FIREBASE_PROJECT_ID` |
| `ALLOWED_ORIGINS` | Optional; comma-separated allowed web origins for CORS |

Worker secrets are never committed to the repository. They are set once via the Cloudflare dashboard or CLI and injected into the Worker runtime.

### Development Workflow

```bash
# Prerequisites: Node.js 20+, Firebase project with Firestore enabled
npm install
npm run dev        # Vite dev server with HMR

npm run build      # TypeScript type-check + production build
npm run lint       # ESLint
npm run preview    # Serve the production build locally
```

## Key Decisions

- **No test suite.** The project relies on TypeScript strict mode, ESLint, and manual testing. `npm run build` is the primary correctness gate.
- **Cloudflare Worker as API proxy.** Gemini and Google Places API keys are never exposed to the browser. The worker also centralises rate limiting and model allowlisting, making it the single enforcement point for API access policy.
- **GitHub Actions for zero-touch frontend deploys.** Pushing to `main` is sufficient to ship the frontend; no separate release step is needed.
- **VITE_* prefix convention.** Only variables prefixed `VITE_` are exposed to the browser bundle by Vite. All sensitive backend credentials use unprefixed names in the Cloudflare Worker environment.
- **`FIREBASE_PROJECT_ID` duplication.** The project ID appears in both the frontend env and the worker secrets. This is intentional: the worker uses it to validate Firebase JWTs independently of the frontend.
- **`ALLOWED_ORIGINS` is optional.** Omitting it opens CORS in the worker, which is acceptable for local development but should be set for production to restrict which origins can call the proxy.

## Experiments & Results

| Experiment | Status | Finding | Source |
|------------|--------|---------|--------|
| Single `GEMINI_API_KEY` secret | Superseded | Replaced by comma-separated `GEMINI_API_KEYS` to allow key rotation without redeployment; legacy name still accepted for backward compatibility | [[../../../README]] |
| Direct frontend calls to Gemini | Rejected | Exposing Gemini API keys in the browser bundle was unacceptable; all AI calls now route through the Cloudflare Worker proxy | [[../../../CLAUDE]] |
| Direct frontend calls to `places.googleapis.com` | Rejected | Places API key would be visible in the browser; worker now exposes `/places/nearby` and `/places/details` routes instead | [[../../../CLAUDE]] |

## Gotchas & Known Issues

- **`VITE_*` secrets must be in GitHub repository settings.** A local `.env` file is only read during local development. For the GitHub Actions build to embed these values, each `VITE_*` variable must also be added as a repository secret (or environment variable) in the GitHub repo settings under Settings > Secrets and variables > Actions.
- **`FIREBASE_PROJECT_ID` must match exactly.** The worker validates Firebase JWTs against its own copy of the project ID. If `FIREBASE_PROJECT_ID` in Cloudflare does not exactly match `VITE_FIREBASE_PROJECT_ID` used by the frontend, auth validation will fail silently or with cryptic errors.
- **Omitting `ALLOWED_ORIGINS` opens CORS.** If `ALLOWED_ORIGINS` is not set, the worker accepts requests from any origin. This is fine for local development but must be configured with the production GitHub Pages origin before going live to prevent unauthorized use of the AI proxy.
- **Vite base path `/travelplanner/` must be used in URL construction.** All internal route links and any manually constructed URLs must account for the `/travelplanner/` prefix. Omitting it causes 404s on GitHub Pages.
- **Firebase rules are a separate deploy step.** Firestore and Storage security rules are not part of the frontend GitHub Actions deploy. They must be deployed manually with `firebase deploy --only firestore:rules,storage` whenever rule changes are made.
- **Worker deploy is manual.** Unlike the frontend, the Cloudflare Worker has no automated CI/CD. Changes to `worker/src/index.ts` require a manual `npx wrangler deploy` from the `worker/` directory.
- **`GEMINI_API_KEY` (singular) is legacy.** New deployments should use `GEMINI_API_KEYS` (plural, comma-separated). Both are accepted by the worker, but documentation and new setups should prefer the plural form.

## Open Questions

- Should the Cloudflare Worker deployment be automated via a GitHub Actions workflow similar to the frontend deploy, to remove the manual `wrangler deploy` step?
- Is there a mechanism to validate that `FIREBASE_PROJECT_ID` in Cloudflare matches `VITE_FIREBASE_PROJECT_ID` in the frontend at deploy time, to catch mismatches early?
- Should `ALLOWED_ORIGINS` be enforced as a required secret (causing the worker to reject all requests if unset) in production environments, rather than defaulting to open CORS?
- As the Gemini model IDs evolve, is there a process for updating the worker's model allowlist in sync with the frontend model references in `src/lib/gemini.ts`?

## Sources

- [[../../../CLAUDE]]
- [[../../../README]]
- [[../../../.cursor/rules/rules]]
