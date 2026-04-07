---
topic: Architecture and Data
last_compiled: 2026-04-06
source_count: 3
status: active
---

# Architecture and Data

## Summary

TravelPlanner is a React 19 + TypeScript SPA backed by Firebase Firestore for real-time server state and IndexedDB for local state. All Firestore access is centralized in `src/lib/store.ts` as `onSnapshot`-based hooks. All shared domain types live in `src/lib/types.ts`. Pages are lazy-loaded under the `/travelplanner/` basename via React Router. Auth supports Google OAuth and anonymous sign-in, with `tripMembers` denormalized onto every child document to satisfy Firestore security rules without cross-collection reads.

The `chat_history` collection is queried with a 7-day rolling window (`where('createdAt', '>=', cutoffISO)`). Older messages are retained in Firestore and loadable on demand via `loadEarlier()` in `useChatHistory`.

## Timeline

- **Early design** — `Trip.dayLocations` used to store per-day location data. Replaced by `Trip.itinerary` (`Record<string, ItineraryDay>`) for a more structured, extensible day-by-day model.
- **Auth expansion** — Anonymous sign-in added alongside Google OAuth to lower onboarding friction. Anonymous users are supported but cannot share trips (no email address).
- **Persistence consolidation** — A `src/hooks/useLocalStorageState.ts` variant existed at some point. The canonical module is now `src/lib/persist.ts`; imports from the hooks path are prohibited.
- **Calendar refactor** — `CalendarView` logic extracted into `src/pages/useCalendarViewController.ts` as part of a large-page decomposition effort.
- **Import controller** — `ImportItinerary` is flagged `pending_extract_high_risk`; extraction has not yet occurred.
- **2026-04-06: Chat message windowing** — `useChatHistory` initial query scoped to last 7 days. A `loadEarlier()` function added for on-demand fetch of older messages (pre-cutoff). `Assistant.tsx` chat area gained a "Load earlier messages" button at the top of the scroll region.

## Current State

- **Server state:** Firestore, accessed exclusively through React hooks in `src/lib/store.ts`. Every hook returns `{ data, loading }` and subscribes via `onSnapshot` for real-time updates. Mutations are async and must call `stripUndefined(payload)` before any write operation.
- **Local state:** IndexedDB via `useLocalStorageState` from `src/lib/persist.ts`. Custom theme color overrides are stored in `localStorage` under the key `travelplanner_theme_config`.
- **Offline/optimistic UI:** `hasPendingWrites` is surfaced as a `_pendingWrite` flag. The `OnlineStatus` component displays an offline/reconnected banner. Undo is implemented as toast-based restore (`restoreTrip`, `restoreActivity`, `restoreRoute`) that re-`setDoc` the deleted document.
- **Routing:** All pages are `React.lazy`-loaded and wrapped in `<Suspense>`. Routes are mounted under `/travelplanner/` basename via React Router.
- **Auth:** `useAuth()` from `src/lib/AuthContext.tsx`. `AuthGate` in `App.tsx` redirects unauthenticated users to `<Login>`. Non-anonymous sign-in upserts a profile to `users/{uid}`.
- **Theming:** CSS custom properties only — no hardcoded hex/rgb in component files. Six theme presets (Modern, Y2K Retro, Dark, Sunset, Ocean, Pastel Glow). `applyTheme()` in `src/design-system/themes.ts` sets tokens on `document.documentElement`. DaisyUI + Tailwind, mobile-first.

### `useChatHistory` — current interface (`src/lib/store.ts`)

| Export | Type | Description |
|--------|------|-------------|
| `messages` | `ChatMessage[]` | Live 7-day window via `onSnapshot` |
| `loading` | `boolean` | True while initial snapshot is pending |
| `earlierMessages` | `ChatMessage[]` | Messages older than 7 days, populated on demand |
| `hasLoadedEarlier` | `boolean` | True after `loadEarlier()` has completed (even if empty) |
| `isLoadingEarlier` | `boolean` | True while the earlier-messages fetch is in flight |
| `loadEarlier` | `() => Promise<void>` | One-time `getDocs` fetch: `createdAt < cutoffISO`, `orderBy('createdAt', 'desc')`, `limit(50)`, same auth compound filter as live query |
| `addMessage` | function | Writes a new message to Firestore |
| `clearHistory` | function | No-op stub; relies on the rolling window for TTL |

The `loadEarlier` fetch uses the same composite Firestore index as the live query (fields: `tripId`, `createdAt`, `tripMembers`/`userId`). If Firestore logs a missing-index error, the console error will include a direct link to create the required index.

### Firestore Collections

| Collection | Access Rule |
|---|---|
| `trips` | `members` array-contains OR `userId == uid` |
| `activities` | `tripMembers` array-contains OR `userId == uid` |
| `transportRoutes` | `tripMembers` array-contains OR `userId == uid` |
| `notes` | `tripMembers` array-contains OR `userId == uid` |
| `chat_history` | `tripMembers` array-contains OR `userId == uid` |
| `users` | Read: authenticated; Write: own doc only |

### Route Table

| Route | Page Component |
|---|---|
| `/spreadsheet` | `SpreadsheetView` (default landing) |
| `/calendar` | `CalendarView` |
| `/trip/:tripId/day/:date` | `TripDayView` |
| `/transportation` | `Transportation` |
| `/budget` | `Budget` |
| `/notes` | `Notes` |
| `/packing` | `Packing` |
| `/weather` | `Weather` |
| `/assistant` | `Assistant` |
| `/settings` | `Settings` |
| `/import` | `ImportItinerary` |

### Project Structure (abbreviated)

```
src/
  components/        # Reusable UI (ActivityForm, TripForm, Sidebar, ShareModal, Toast, etc.)
  design-system/     # themes.ts — ThemePreset, ThemeTokens, applyTheme(), THEME_PRESETS
  lib/
    types.ts         # All shared types
    store.ts         # Firestore hooks (including useChatHistory with loadEarlier)
    AuthContext.tsx  # useAuth()
    firebase.ts      # db, auth, storage, googleProvider
    gemini.ts        # generateWithGemini()
    persist.ts       # useLocalStorageState (canonical)
    upload.ts        # Firebase Storage helpers
  pages/             # SpreadsheetView, CalendarView, Transportation, Budget, Notes, etc.
  App.tsx            # Router, AuthProvider, ToastProvider, lazy-loaded pages
  theme.css          # CSS custom properties
worker/
  src/index.ts       # Cloudflare Worker (AI + Places proxy)
```

## Key Decisions

**`tripMembers` denormalization** — The `members` array on a `Trip` document is the authoritative access list, but Firestore security rules cannot perform cross-collection lookups efficiently. To avoid expensive `get()` calls in rules, every child document (`Activity`, `TransportRoute`, `Note`, `ChatMessage`) carries a denormalized `tripMembers` array. This means security rules evaluate purely against the document being read/written. The tradeoff is that any membership change requires a batch write across all five collections.

**`Trip.itinerary` replacing `Trip.dayLocations`** — The old `dayLocations` field was a flat map with limited structure. `Trip.itinerary` as `Record<string, ItineraryDay>` gives each day a typed shape, supports richer day-level metadata, and aligns with the `TripDayView` route pattern (`/trip/:tripId/day/:date`). `dayLocations` is deprecated and should not be read or written in new code.

**`src/lib/persist.ts` over `src/hooks/useLocalStorageState.ts`** — A hook-directory variant of local state persistence existed and must not be used. All local (non-Firestore) persistence is consolidated in `persist.ts`, which uses IndexedDB under the hood. This keeps the persistence strategy in one place and avoids divergence.

**Lazy-loading all pages** — Every page component is loaded via `React.lazy` + `<Suspense>`. This keeps the initial bundle small for a mobile-first app where many users may only ever visit one or two routes. It also makes the per-page code boundary explicit.

**Chat windowing is display-only** — The 7-day cutoff in `useChatHistory` is a query-side filter only. Messages are never purged from Firestore. Older messages are always recoverable via the "Load earlier messages" button in `Assistant.tsx`. A Firebase Cloud Function would be needed for true TTL-based deletion.

## Experiments & Results

| Experiment | Status | Finding | Source |
|------------|--------|---------|--------|
| Extracting `CalendarView` logic into a controller hook | Complete | `useCalendarViewController.ts` successfully reduces `CalendarView.tsx` complexity; pattern recommended for other large pages | [[../../../.cursor/LLM_DOMAIN_MAP]] |
| Extracting `ImportItinerary` into a controller | Pending (high-risk) | Not yet attempted; flagged as high-risk due to complexity | [[../../../.cursor/LLM_DOMAIN_MAP]] |

## Gotchas & Known Issues

- **Always call `stripUndefined(payload)`** before any Firestore write (`setDoc`, `updateDoc`, `addDoc`, `batch.update`). Firestore will hard-reject documents containing `undefined` values with a runtime error. The utility is defined inside `store.ts` — use it without exception.
- **Never import `useLocalStorageState` from `src/hooks/`**. The hooks-directory version is not the canonical implementation. Always import from `src/lib/persist.ts`. Importing from the wrong path risks divergent behavior and will violate the project rule.
- **`tripMembers` must be batch-updated on membership changes**. When a trip's member list changes, the `tripMembers` array must be updated in a single batch across `tripMembers`, `activities`, `notes`, `transportRoutes`, and `chat_history`. Failing to do so leaves child documents with stale access lists, which will cause security rule denials for new or removed members.
- **`Trip.dayLocations` is deprecated**. Do not read or write this field. Use `Trip.itinerary` exclusively.
- **Anonymous users cannot share trips**. The sharing flow requires an email address. Anonymous accounts have no email, so `ShareModal` and related sharing logic must guard against this case.
- **`reviewSummary.disclosureText` must be displayed** wherever Google Places AI summaries are rendered. This is a Google API terms requirement — omitting it violates the usage policy.
- **CSS custom properties only for colors**. Never hardcode hex or rgb values in component files. All color values must reference `var(--...)` tokens set by `applyTheme()`.
- **`loadEarlier` may need a composite index**. If Firestore logs a missing-index error when the "Load earlier messages" button is clicked, the console error will contain a direct link to create the required index in the Firebase console.

## Open Questions

- When will `ImportItinerary` be safe to extract into a controller hook? What makes it high-risk (size, stateful complexity, side effects)?
- Should `tripMembers` batch-update logic be abstracted into a dedicated helper in `store.ts` to prevent accidental partial updates?
- Is there a migration path for any data still using `Trip.dayLocations` in production Firestore documents?
- Should anonymous user sessions be upgradeable to Google accounts (Firebase account linking), and if so, how does that interact with the `tripMembers` denormalization?
- Should `loadEarlier` support pagination (loading 50 more at a time) for users with very long chat histories?

## Sources

- [[../../../CLAUDE]]
- [[../../../.cursor/rules/rules]]
- [[../../../.cursor/LLM_DOMAIN_MAP]]
