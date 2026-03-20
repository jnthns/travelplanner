# Design Audit: sabb (TravelPlanner)

> A React + TypeScript travel planning app that uses Firebase for realtime collaboration and a Cloudflare Worker proxy for AI/Places integrations.

## Architecture Overview

The system is a client-heavy SPA (`src/`) with route-level pages for trip planning, budgeting, weather, transport, notes, and an AI assistant. Core data flow is centered in `src/lib/store.ts`, where Firestore-backed hooks provide realtime reads/writes for trips and trip-scoped entities (activities, routes, notes, chat history). Authentication and user context are managed through `src/lib/AuthContext.tsx`.

AI and places integrations are intentionally split: frontend modules call a Cloudflare Worker (`worker/src/index.ts`) which forwards to Gemini and Google Places APIs, while weather calls Open-Meteo directly from the client. Deployment targets GitHub Pages with a base path of `/travelplanner/`, and Firebase security rules enforce member-based data access.

## Design Issues

### 🔴 Critical

- **No critical architecture flaws found** in a high-level review. Security boundaries for AI/Places proxying and Firestore access controls appear intentionally designed.

### 🟡 Moderate

- **Large page modules increase change risk**: `ImportItinerary` remains a large orchestration file; `CalendarView` logic now lives mainly in `useCalendarViewController.ts`.
- **State spread across multiple mechanisms**: React state, `useSyncExternalStore`, localStorage helpers, and Firestore hooks coexist; this is workable, but increases cognitive load when tracing cross-page behavior.
- **Integration boundaries are mostly convention-driven**: patterns like "all AI calls go through `generateWithGemini()`" are strong, but rely heavily on discipline instead of compile-time constraints.

### 🟢 Minor

- **Configuration surface is broad** (Firebase, worker, Vite base path, analytics); onboarding can be slower without a concise architecture index.
- **Some domain responsibilities overlap** between page-level modules and `src/lib/*` utility modules, making ownership less explicit for new contributors.

## Optimization Suggestions

1. **Extract page-level controllers/hooks for largest pages**  
   **Status:** `CalendarView` → `src/pages/useCalendarViewController.ts` (page is mostly presentational). **`ImportItinerary`:** still monolithic; follow-up recommended (large `handleConfirm`, render-local `globalIdx` in preview).

2. **Formalize integration boundaries with typed service interfaces**  
   **Status:** `src/lib/services/aiService.ts` (re-exports `generateWithGemini`); `src/lib/services/placesService.ts` (re-exports places API). AI actions and `places.ts` consume `aiService`.

3. **Create a domain-layer map document (LLM-optimized)**  
   **Status:** `.cursor/LLM_DOMAIN_MAP.md`.

4. **Add targeted tests around core data hooks and transform logic**  
   **Skipped** per team choice.

5. **Split styles for high-complexity pages into composable sections**  
   **Status:** deferred — `CalendarView.module.css` unchanged to avoid high-risk className churn; revisit after UI structure stabilizes.

## What's Done Well

- **Strong separation of concerns for external AI/Places access** via Cloudflare Worker proxy, avoiding direct frontend key exposure.
- **Clear realtime collaboration model** with Firestore and member-based security rules, including denormalized membership fields for child-collection authorization.
- **Modern frontend setup** with route-level code splitting, strict TypeScript settings, and explicit base-path configuration for GitHub Pages deployment.
- **Pragmatic product architecture**: domain model is coherent across trips, activities, transport, notes, budget, and assistant features.
