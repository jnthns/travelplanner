---
project: TravelPlanner (sabb)
version: 0.0.0
last_updated: 2026-03-10
---

# Project Frontmatter — TravelPlanner

## Purpose
A personal travel itinerary planner. Users create trips, plan day-by-day activities, track transport, manage budgets, take notes, and receive AI-powered suggestions. Supports real-time collaboration via trip sharing.

---

## Tech Stack (authoritative — do not guess from training data)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Strict TS, `verbatimModuleSyntax`, `noUnusedLocals` |
| Routing | react-router-dom v7 | Base path: `/travelplanner/` |
| Database | Firebase Firestore | Real-time `onSnapshot` listeners; persistent multi-tab cache |
| Auth | Firebase Auth | Google OAuth + anonymous sign-in |
| Storage | Firebase Storage | Images only, max 5MB, scoped to `notes/{userId}/{tripId}/...` |
| AI | Google Gemini via Cloudflare Worker proxy | Never call Gemini directly from frontend |
| Analytics | Amplitude | `logEvent()` from `src/lib/amplitude.ts` |
| Icons | lucide-react | |
| Dates | date-fns | All date strings are ISO `YYYY-MM-DD` |
| Markdown | marked | Used in `Markdown.tsx` component |
| Deploy | GitHub Pages (frontend) + Cloudflare Workers (AI proxy) | |

---

## Gemini / AI — Critical Rules

- **SDK**: `@google/genai` (JS/TS). Do NOT use the deprecated `@google/generative-ai`.
- **Current models**: `gemini-3-flash-preview` (default), `gemini-3.1-pro-preview` (complex), `gemini-3-pro-image-preview` (images).
- **NEVER** reference `gemini-2.5-*`, `gemini-2.0-*`, or `gemini-1.5-*` — these are deprecated.
- **All AI calls go through** `generateWithGemini()` in `src/lib/gemini.ts`, which POSTs to the Cloudflare Worker proxy at `VITE_AI_PROXY_URL`. Never call Gemini APIs directly from the frontend.
- The proxy URL is `/generate` (POST). Body: `{ prompt, systemInstruction?, responseMimeType?, responseSchema? }`.
- `generateWithGemini` handles: single-flight deduplication, 1200ms call spacing, 429 retry with exponential backoff (max 3 retries).
- For structured output, pass `responseMimeType: 'application/json'` and `responseSchema`.

---

## Data Models

### Trip
```ts
interface Trip {
  id: string;
  userId: string;           // owner UID
  members: string[];        // all member UIDs (including owner)
  sharedWithEmails: string[];
  name: string;
  startDate: string;        // ISO YYYY-MM-DD
  endDate: string;          // ISO YYYY-MM-DD
  defaultCurrency?: string;
  color?: string;           // from TRIP_COLORS
  _pendingWrite?: boolean;  // Firestore optimistic flag
}
```

### Activity
```ts
interface Activity {
  id: string;
  tripId: string;
  userId: string;
  tripMembers: string[];    // denormalized for Firestore security rules
  date: string;             // ISO YYYY-MM-DD
  title: string;
  details?: string;
  time?: string;            // HH:MM
  location?: string;
  category: ActivityCategory; // 'food' | 'transport' | 'accommodation' | 'sightseeing' | 'other' | ...
  cost?: number;
  currency?: string;
  order: number;            // sort order within the day
  _pendingWrite?: boolean;
}
```

### TransportRoute
```ts
interface TransportRoute {
  id: string;
  tripId: string;
  userId: string;
  tripMembers: string[];
  date: string;
  type: string;             // 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'other'
  from: string;
  to: string;
  departureTime?: string;
  arrivalTime?: string;
  bookingRef?: string;
  cost?: number;
  currency?: string;
  notes?: string;
}
```

### Note
```ts
interface Note {
  id: string;
  tripId: string;
  userId: string;
  tripMembers: string[];
  title: string;
  content: string;
  imageUrls?: string[];
  updatedAt: string;
}
```

### ChatMessage
```ts
interface ChatMessage {
  id: string;
  tripId: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}
```

---

## Firestore Collections

| Collection | Access Rule |
|---|---|
| `trips` | `members` array-contains OR `userId == uid` |
| `activities` | `tripMembers` array-contains OR `userId == uid` |
| `transportRoutes` | `tripMembers` array-contains OR `userId == uid` |
| `notes` | `tripMembers` array-contains OR `userId == uid` |
| `chat_history` | `tripMembers` array-contains OR `userId == uid` |
| `users` | Read: authenticated; Write: own doc only |

**Important**: `tripMembers` is a **denormalized** array on child docs (activities, notes, routes) required to satisfy Firestore security rules without cross-collection `get()` calls. When adding a collaborator via `ShareModal`, all child docs must be batch-updated.

---

## Project Structure
```
src/
  components/        # Reusable UI: ActivityForm, TripForm, Sidebar, ShareModal, Toast, DraggableList, SwipeableItem, Markdown, OnlineStatus, AutoTextarea
  design-system/     # themes.ts — ThemePreset, ThemeTokens, applyTheme(), THEME_PRESETS
  hooks/             # useLocalStorageState (in hooks/ AND lib/persist.ts — use lib/persist.ts)
  lib/
    types.ts         # All shared types + CATEGORY_EMOJIS, CATEGORY_COLORS, TRIP_COLORS
    store.ts         # Firestore hooks: useTrips, useActivities, useTransportRoutes, useNotes, useChatMessages
    AuthContext.tsx   # useAuth() → { user, loading, signInWithGoogle, signInAnonymously, signOut }
    firebase.ts      # db, auth, storage, googleProvider exports
    gemini.ts        # generateWithGemini() — the ONLY way to call AI
    amplitude.ts     # logEvent(), identifyUser(), trackExposure()
    persist.ts       # useLocalStorageState (preferred over hooks/ version)
    upload.ts        # Firebase Storage image upload helpers
  pages/
    SpreadsheetView  # Default view; day × time-slot grid (morning/afternoon/evening/unscheduled)
    CalendarView     # Day/week/month/trip views
    Transportation   # TransportRoutes CRUD
    Budget           # Cost summary across activities + routes
    Notes            # Trip notes with image attachments
    Assistant        # AI chat per trip (uses chat_history collection)
    ImportItinerary  # Paste raw text → Gemini parses → preview → save
    Login            # Auth gate
    Settings         # Theme, display preferences
  App.tsx            # Router, AuthProvider, ToastProvider, lazy-loaded pages
  theme.css          # CSS custom properties (design tokens)
worker/
  src/index.ts       # Cloudflare Worker — proxies /generate → Gemini API
```

---

## Routing

Base: `/travelplanner/`

| Path | Page |
|---|---|
| `/spreadsheet` | SpreadsheetView (default) |
| `/calendar` | CalendarView |
| `/transportation` | Transportation |
| `/budget` | Budget |
| `/notes` | Notes |
| `/import` | ImportItinerary |
| `/assistant` | Assistant |
| `/settings` | Settings |
| `*` | Redirect → `/spreadsheet` |

All pages are lazy-loaded via `React.lazy`.

---

## Auth Patterns

- `useAuth()` — primary hook, throws if outside `AuthProvider`
- User is Firebase `User | null`
- Anonymous users: supported but cannot share trips (no email)
- User profile upserted to `users/{uid}` on sign-in (non-anonymous only)
- Auth gate: `AuthGate` component wraps all routes in `App.tsx`

---

## State & Persistence

- **Server state**: Firestore via `onSnapshot` hooks in `store.ts`. All mutations are async (`addDoc`, `updateDoc`, `deleteDoc`, `setDoc`).
- **Local state**: `useLocalStorageState` from `src/lib/persist.ts` for UI preferences (selected trip, view mode, etc.)
- **Optimistic UI**: Firestore's `hasPendingWrites` surfaced as `_pendingWrite` flag on entities. `OnlineStatus` component shows offline/reconnected banner.
- **Undo**: Toast-based undo via `restoreTrip` / `restoreActivity` / `restoreRoute` (re-`setDoc` the deleted doc).

---

## Theming

- CSS custom properties defined in `theme.css`, overridden at runtime via `applyTheme()`.
- Presets: `modern` (default), `y2k-retro`, `dark`, `sunset`, `ocean`, `pastel-glow`.
- Custom color overrides per-preset stored in `localStorage` under key `travelplanner_theme_config`.
- Dark mode: `getDarkTokens()` transforms any preset's tokens.
- Compact layout: `body.compact-layout` CSS class toggle.

---

## Conventions & Rules

1. **TypeScript strict mode** — always handle null/undefined, no implicit any.
2. **No direct Gemini calls** — always use `generateWithGemini()` from `src/lib/gemini.ts`.
3. **No form elements** — use event handlers (`onClick`, `onChange`) not `<form>` with native submit where conflicts may arise.
4. **stripUndefined()** — always call before writing to Firestore to avoid Firestore undefined field errors.
5. **tripMembers denormalization** — when mutating trip membership, batch-update child collections (activities, notes, transportRoutes, chat_history).
6. **Date strings** — always ISO `YYYY-MM-DD`; use `date-fns` for all manipulation.
7. **CSS** — use CSS custom properties from `theme.css` (e.g., `var(--primary-color)`), not hardcoded values.
8. **Analytics** — `logEvent(eventName, props)` for all meaningful user interactions. Event names are Title Case strings.
9. **Error handling** — surface errors to UI state; never swallow silently except in non-critical paths (e.g., analytics init).
10. **Import paths** — no barrel `index.ts` files; import directly from the file.

---

## Environment Variables
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_AI_PROXY_URL          # Required for all AI features (Cloudflare Worker URL)
VITE_AMPLITUDE_API_KEY     # Optional; analytics silently disabled if missing
```

Worker (set in Cloudflare dashboard, not .env):
```
GEMINI_API_KEY
```

---

## Common Pitfalls for Agents

- Do not import from `src/hooks/useLocalStorageState.ts` — use `src/lib/persist.ts` instead (canonical version).
- Do not write to Firestore with `undefined` values — always `stripUndefined()` first.
- Do not use deprecated Gemini model IDs (`gemini-2.x`, `gemini-1.5-*`).
- Do not call the Gemini API directly — route through `generateWithGemini()`.
- The Vite base path is `/travelplanner/` — account for this in any URL construction.
- `useLocalStorageState` in `persist.ts` returns `[value, setValue] as const` (tuple). The one in `hooks/` returns `[T, Dispatch<SetStateAction<T>>]` — they differ slightly.
- TypeScript config uses `erasableSyntaxOnly` — avoid `const enum` and other non-erasable TS syntax.