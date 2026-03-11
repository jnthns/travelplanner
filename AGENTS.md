# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
TravelPlanner is a React 19 + TypeScript + Vite SPA for travel itinerary planning. It uses Firebase (Firestore + Auth + Storage) as its backend and has an optional Cloudflare Worker AI proxy in `worker/`. See `README.md` for full tech stack and project structure.

### Running the app
- **Frontend dev server:** `npm run dev` (Vite, serves at `http://localhost:5173/travelplanner/`)
- **Worker dev server (optional):** `cd worker && npx wrangler dev` (proxies AI requests to Gemini)
- The app requires Firebase credentials in `.env` to authenticate users. Without valid `VITE_FIREBASE_*` secrets, the login page renders but sign-in fails with `auth/api-key-not-valid`.

### Lint / Build / Test
- **Lint:** `npm run lint` — pre-existing lint errors exist in the repo (react-hooks, no-explicit-any); these are not regressions.
- **Build:** `npm run build` — runs `tsc -b && vite build`.
- **No test suite** is configured (`package.json` has no `test` script).

### Gotchas
- The Vite config sets `base: '/travelplanner/'`, so the local dev URL path is `/travelplanner/`, not `/`.
- Firebase config values fall back to empty strings when env vars are missing — the app still starts but auth operations fail at runtime.
- The `worker/` directory has its own `package.json` and `node_modules`; install its dependencies separately with `npm install` inside `worker/`.
