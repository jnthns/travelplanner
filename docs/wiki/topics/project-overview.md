---
topic: Project Overview
last_compiled: 2026-04-06
source_count: 2
status: active
---

# Project Overview

## Summary

TravelPlanner is a personal travel itinerary planner and tracker built with React 19, TypeScript, Vite, Firebase Firestore, and Google Gemini AI (via a Cloudflare Worker proxy). It allows users to create and manage trips with day-by-day activity planning, visualize schedules in a calendar, track transportation, manage packing lists, and receive AI-powered suggestions. The frontend deploys to GitHub Pages under the `/travelplanner/` base path and syncs data in real time via Firestore.

The application is organized into route-level pages (spreadsheet view, calendar, trip day view, transportation, budget, notes, packing, weather, AI assistant, settings, and itinerary import) with all page components lazy-loaded. A Cloudflare Worker sits between the frontend and the Gemini API, handling JWT auth validation, per-IP rate limiting, and model restrictions.

A compiled project wiki lives in `docs/wiki/`. Both `CLAUDE.md` and `.cursor/rules/project-context.mdc` instruct agents to read `docs/wiki/INDEX.md` first before exploring source files, with individual topic files as the primary reference.

## Timeline

No explicitly dated project milestones are recorded in the source files. The following features are known to be active as of the last compiled date:

- **Active** — Itinerary management with day-by-day activity planning, categories, costs, and notes
- **Active** — Calendar view (day, week, month, trip-scoped)
- **Active** — Transportation tracking (flights, trains, buses, booking references)
- **Active** — AI suggestions via Google Gemini (Cloudflare Worker proxy)
- **Active** — AI Preferences bottom-sheet modal (button in trip selector card; evolved from collapsible dropdown → always-visible form → modal, all 2026-04-06)
- **Active** — Chat message 7-day windowing with on-demand "Load earlier messages" control (2026-04-06)
- **Active** — Theming system (Modern, Y2K Retro, Dark, Sunset, Ocean presets)
- **Active** — Mobile-friendly responsive layout with collapsible sidebar
- **Active** — Packing list, budget, weather, and notes pages
- **Active** — Itinerary import page
- **Active** — GitHub Pages deployment via `.github/workflows/deploy.yml`
- **Active** — Scheduled daily wiki recompilation via Claude Code remote trigger (midnight PDT)

## Current State

The project is active. No test suite is configured — there are no test files or test scripts. The frontend is React 19 with strict TypeScript (`verbatimModuleSyntax`, `noUnusedLocals`, `erasableSyntaxOnly`). All Firestore reads and writes are encapsulated in hooks in `src/lib/store.ts` using `onSnapshot` for real-time sync.

The AI layer uses the `@google/genai` SDK (not the deprecated `@google/generative-ai` package) and routes all calls through a Cloudflare Worker proxy. Default model is `gemini-3-flash-preview`; complex reasoning uses `gemini-3.1-pro-preview`; image tasks use `gemini-3-pro-image-preview`.

Local (non-Firestore) state persists via IndexedDB through `src/lib/persist.ts`. Direct `localStorage` usage is not permitted.

The compiled project wiki at `docs/wiki/` is the primary reference for agents and developers. It is recompiled daily at midnight PDT by a scheduled remote Claude Code agent and can be triggered manually via `/wiki-compile`.

## Key Decisions

- **Cloudflare Worker as AI proxy** — Gemini API keys are never exposed to the frontend. The worker validates Firebase JWTs, enforces per-IP rate limits, and restricts which Gemini models are callable.
- **Firestore real-time sync** — All data hooks use `onSnapshot`, giving live updates across clients without manual polling.
- **`stripUndefined` before all Firestore writes** — Firestore rejects `undefined` values; a utility in `store.ts` strips them before every `setDoc`, `updateDoc`, `addDoc`, or batch write.
- **Denormalized `tripMembers` on child documents** — `Activity` and related documents carry a `tripMembers` array to satisfy Firestore security rules without requiring cross-document reads at rule evaluation time.
- **CSS custom properties for all colors** — No hardcoded hex or RGB values in component files; all colors reference `var(--*)` tokens set by `applyTheme()` on `document.documentElement`.
- **`date-fns` for all date arithmetic** — `new Date()` arithmetic inline is prohibited; `parseISO`, `format`, and `isWithinInterval` are the standard tools.
- **No barrel `index.ts` re-exports** — Imports come from the defining file directly to keep dependency graphs clear.
- **No test suite** — Deliberate omission; no test infrastructure is configured.
- **Wiki-first agent orientation** — Both `CLAUDE.md` and `.cursor/rules/project-context.mdc` direct agents to `docs/wiki/INDEX.md` before crawling source files, reducing redundant exploration and keeping context windows focused.

## Experiments & Results

| Experiment | Status | Finding | Source |
|------------|--------|---------|--------|
| No experiments tracked. | — | — | — |

## Gotchas & Known Issues

- Firestore will reject writes silently (or throw) if any field value is `undefined`. Always run `stripUndefined()` on payloads before writing.
- The `@google/generative-ai` package is deprecated; only `@google/genai` must be used.
- `gemini-2.5-*`, `gemini-2.0-*`, and `gemini-1.5-*` model IDs are not allowed — the Cloudflare Worker will reject requests for those models.
- `const enum` and other non-erasable TypeScript syntax are banned (`erasableSyntaxOnly` is enabled); use `const` maps or union string literals instead of `enum`.
- `Trip.dayLocations` is deprecated; `Trip.itinerary` (`Record<string, ItineraryDay>`) is the current structure.
- The Vite base path is `/travelplanner/` — any URL construction must account for this prefix.
- `reviewSummary.disclosureText` from the Google Places API (New) must be displayed wherever Google's AI review summary is shown, per Google's requirements.
- Do not call `places.googleapis.com` directly from the frontend — all Places API calls must go through the Cloudflare Worker routes `/places/nearby` and `/places/details`.
- No test suite exists; regressions must be caught through manual testing or build-time type checking.

## Open Questions

- When will a test suite be introduced, and what framework will be used?
- Are there plans to support authentication methods beyond Google OAuth and anonymous sign-in?
- Is there a roadmap for adding collaborative editing or conflict resolution beyond the current `tripMembers` denormalization approach?
- Will additional Gemini model IDs be allowlisted in the Cloudflare Worker as new models are released?

## Sources

- [[../../../README]]
- [[../../../CLAUDE]]
