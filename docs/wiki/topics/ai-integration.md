---
topic: AI Integration
last_compiled: 2026-04-06
source_count: 4
status: active
---

# AI Integration

## Summary

TravelPlanner integrates Google Gemini AI throughout the application to power features such as itinerary import, trip form assistance, calendar suggestions, transport recommendations, and a conversational assistant. All AI calls are routed through a Cloudflare Worker proxy that handles authentication, per-IP rate limiting, and model allowlisting. The frontend never contacts the Gemini API directly. The core client is `src/lib/gemini.ts`, which exposes `generateWithGemini()` — a function that enforces single-flight deduplication, 1200ms inter-call spacing, and exponential-backoff retry on HTTP 429 responses. Domain-specific AI logic is organized into action modules under `src/lib/ai/actions/`, and a response cache in `src/lib/ai/cache.ts` reduces redundant API calls.

User-facing AI preferences (pace, budget, group type, interests, dietary/accessibility needs, transport preference, must-haves, avoid, notes) are stored on the `Trip` document under `trip.aiPreferences` and are accessed via a bottom-sheet modal triggered by a "Preferences" button in the trip selector card on the Assistant page.

## Timeline

- **Initial integration** — Gemini AI introduced as the primary reasoning engine; `generateWithGemini()` established as the sole frontend entry point.
- **Proxy layer** — Cloudflare Worker added to proxy all Gemini requests, validate Firebase JWT tokens, and enforce per-IP rate limits. Direct frontend-to-Gemini calls prohibited.
- **Action modules** — Domain-specific AI modules created under `src/lib/ai/actions/` (assistant, calendar, forms, importItinerary, transport), separating AI concerns from UI components.
- **Response cache** — `src/lib/ai/cache.ts` introduced to cache AI responses and reduce redundant API calls and costs.
- **SDK migration** — Project migrated from deprecated `@google/generative-ai` to the current `@google/genai` SDK.
- **Model updates** — Legacy model IDs (`gemini-2.5-*`, `gemini-2.0-*`, `gemini-1.5-*`) deprecated; project standardized on `gemini-3-flash-preview`, `gemini-3.1-pro-preview`, and `gemini-3-pro-image-preview`.
- **Places AI summaries** — Google Places API (New) integrated via Cloudflare Worker; `reviewSummary.disclosureText` display requirement enforced.
- **2026-04-06: AI Preferences promoted** — The collapsible dropdown drawer for AI Preferences was removed. Preferences were first promoted to an always-visible form section above the chat area, then converted to a bottom-sheet modal (same session) to fix mobile inaccessibility. The "Preferences" button (with `SlidersHorizontal` icon + dot indicator when non-default prefs are set) lives in the trip selector card. Firestore persistence (`trip.aiPreferences` via `updateTrip`) is unchanged.
- **2026-04-06: ConflictList hook fix** — `src/components/ConflictList.tsx` had a React Rules of Hooks violation: `useState` was called after an early return (`if (conflicts.length === 0) return null`). Fixed by moving `useState` before the early return. Without this fix, Budget/Transportation pages crashed when conflict count toggled between zero and non-zero.
- **2026-04-06: ChevronDown import fix** — During preferences refactor, `ChevronDown` was accidentally removed from the lucide-react import in `src/pages/Assistant.tsx`. It is still used on the "Import Activities" button. Restored to the import list.

## Current State

The project uses `generateWithGemini()` (from `src/lib/gemini.ts`) as the single entry point for all AI requests. Calls flow from action modules or components → `generateWithGemini()` → Cloudflare Worker (`worker/src/index.ts`) → Gemini API. The Worker validates Firebase JWTs, applies per-IP rate limits, and restricts requests to the approved model list.

**Active AI modules:**

| Module | Path | Purpose |
|--------|------|---------|
| Assistant | `src/lib/ai/actions/assistant.ts` | Conversational trip assistant |
| Calendar | `src/lib/ai/actions/calendar.ts` | AI-assisted calendar suggestions |
| Forms | `src/lib/ai/actions/forms.ts` | Trip/activity form autofill |
| Import Itinerary | `src/lib/ai/actions/importItinerary.ts` | Parse and import itineraries from text |
| Transport | `src/lib/ai/actions/transport.ts` | Transport route recommendations |

**Active models:**

| Model ID | Use case |
|----------|---------|
| `gemini-3-flash-preview` | Default — fast, balanced, multimodal |
| `gemini-3.1-pro-preview` | Complex reasoning tasks |
| `gemini-3-pro-image-preview` | Image generation and editing |

**Proxy request shape:**
```ts
{
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: string;      // 'application/json' for structured output
  responseSchema?: object;
}
```

**AI Preferences — current UI (`src/pages/Assistant.tsx`):**

The preferences form is accessed via a bottom-sheet modal. When a trip is selected, a "Preferences" button (with a `SlidersHorizontal` icon) appears in the trip selector card. A small dot indicator appears on the button when any non-default preferences are set (`hasAnyPrefs` useMemo). Clicking the button opens a fixed bottom-sheet modal (z-50, 85vh max height, rounded top corners, backdrop overlay z-40). Save calls `saveAiPreferences().then(() => setPrefsOpen(false))`; Reset reloads from `selectedTrip.aiPreferences`. Fields rendered:

| Field | State var | Firestore key |
|-------|-----------|--------------|
| Pace | `prefPace` | `aiPreferences.pace` |
| Budget tier | `prefBudget` | `aiPreferences.budget` |
| Traveling as | `prefGroupType` | `aiPreferences.groupType` |
| Interests | `prefInterests` | `aiPreferences.interests` (string → string[]) |
| Transport preference | `prefTransportPreference` | `aiPreferences.transportPreference` |
| Must-haves | `prefMustHave` | `aiPreferences.mustHave` |
| Dietary needs | `prefDietaryNeeds` | `aiPreferences.dietaryNeeds` |
| Accessibility needs | `prefAccessibilityNeeds` | `aiPreferences.accessibilityNeeds` |
| Avoid | `prefAvoid` | `aiPreferences.avoid` |
| Notes | `prefNotes` | `aiPreferences.notes` |

Save writes to `trip.aiPreferences` via `updateTrip`. Reset reloads values from `selectedTrip.aiPreferences`. Preferences are injected into every Gemini prompt via the `tripContext` string built in `Assistant.tsx`.

**Not yet integrated:** The Gemini Interactions API — which provides server-managed conversation history, background execution, streaming via SSE, and advanced tool orchestration — has not been adopted. The project currently manages conversation history client-side.

**External AI-adjacent APIs:**

- **Open-Meteo** (weather): Called directly from `src/lib/weather.ts`; no API key required. Geocode and weather responses are cached at module level for the session.
- **Google Places API (New)**: Proxied via Cloudflare Worker routes `/places/nearby` and `/places/details`. Never called directly from the frontend.

## Key Decisions

- **Proxy all Gemini calls through Cloudflare Worker** — keeps API keys off the client, enables JWT validation, enforces per-IP rate limits, and provides a central allowlist for approved models.
- **Single frontend entry point (`generateWithGemini()`)** — enforces consistent rate-limit behavior, deduplication, and retry logic across all AI features without each action module needing to implement its own.
- **1200ms inter-call spacing** — deliberate throttle built into `generateWithGemini()` to stay within Gemini API rate limits and avoid cascading 429s.
- **Single-flight deduplication** — identical in-flight requests are coalesced so rapid duplicate calls (e.g., re-renders) don't multiply API usage.
- **Response cache (`src/lib/ai/cache.ts`)** — avoids re-calling the API for identical prompts within a session, reducing cost and latency.
- **Structured output via `responseSchema`** — action modules that need JSON output pass `responseMimeType: 'application/json'` and a `responseSchema`; this is more reliable than parsing free-text JSON from the model.
- **`@google/genai` SDK only** — the deprecated `@google/generative-ai` package is banned; all new code must import from `@google/genai`.
- **Model ID policy** — only `gemini-3-*` and `gemini-3.1-*` preview IDs are permitted in source code. References to `gemini-2.5-*`, `gemini-2.0-*`, or `gemini-1.5-*` are prohibited.
- **Google Places `reviewSummary.disclosureText` is mandatory** — wherever a Google AI-generated place summary is rendered, the disclosure text from the API response must be displayed to comply with Google's usage policies.
- **Only request Places fields you render** — each Places API request should specify only the fields actually shown in the UI to control SKU billing costs.
- **AI Preferences as bottom-sheet modal** — evolved through two iterations: collapsible drawer → always-visible form → modal. The always-visible form broke mobile UX (keyboard covered the chat area). The modal preserves the full chat height on all screen sizes while keeping preferences accessible via a persistent button in the trip card.

## Experiments & Results

| Experiment | Status | Finding | Source |
|------------|--------|---------|--------|
| Direct frontend Gemini calls | Abandoned | Exposes API keys in the client; no rate-limit control; replaced by Cloudflare Worker proxy | [[../../../CLAUDE]] |
| `@google/generative-ai` SDK | Deprecated | Legacy SDK; migrated to `@google/genai` for current API compatibility | [[../../../.agents/skills/gemini-api-dev/SKILL]] |
| Legacy model IDs (`gemini-2.5-*`, `gemini-2.0-*`, `gemini-1.5-*`) | Deprecated | These model IDs are retired; project standardized on `gemini-3-*` / `gemini-3.1-*` preview variants | [[../../../.agents/skills/gemini-api-dev/SKILL]] |
| Gemini Interactions API | Not yet integrated | Offers server-managed history, background execution, SSE streaming, and advanced tool orchestration — viable upgrade path for the assistant feature | [[../../../.agents/skills/gemini-interactions-api/SKILL]] |
| Client-side conversation history | Active (current approach) | Works but requires the client to maintain and pass full history on every request; server-managed history via Interactions API's `previous_interaction_id` would reduce payload size | [[../../../.agents/skills/gemini-interactions-api/SKILL]] |
| AI Preferences as collapsible drawer | Replaced | Toggle added friction; replaced with always-visible form (2026-04-06), then with bottom-sheet modal (same session) after the always-visible form blocked the chat area on mobile | [[../../../CLAUDE]] |

## Gotchas & Known Issues

- **1200ms call spacing is enforced globally** — `generateWithGemini()` queues calls with a 1200ms minimum gap. Rapid sequential AI actions (e.g., bulk import) will take noticeably longer than the raw model latency. Design UX around this constraint.
- **429 retry with exponential backoff** — the client retries up to 3 times on HTTP 429. If the Worker's per-IP limit is hit repeatedly, the total wait can be several seconds. Avoid triggering multiple independent AI calls simultaneously.
- **Never call Gemini directly from the frontend** — all requests must go through `generateWithGemini()` → Cloudflare Worker. Bypassing the proxy removes auth validation, rate limiting, and model allowlisting.
- **Deprecated SDK — do not use `@google/generative-ai`** — any import from `@google/generative-ai` is wrong; use `@google/genai` exclusively.
- **Deprecated model IDs** — do not use `gemini-2.5-*`, `gemini-2.0-*`, or `gemini-1.5-*` model IDs anywhere in the codebase. The Cloudflare Worker's model allowlist will reject them.
- **`reviewSummary.disclosureText` is not optional** — Google's terms require this disclosure to be rendered wherever an AI-generated place summary is shown. Omitting it violates the Places API usage policy.
- **Only request Places fields you render** — requesting extra fields from the Places API (New) increases billing SKU costs. Keep field masks tight to what the UI actually displays.
- **Structured output requires both `responseMimeType` and `responseSchema`** — setting only one of the two will not reliably produce parseable JSON; both must be present together.
- **`stripUndefined()` before every Firestore write** — when AI-generated data is written to Firestore, call `stripUndefined(payload)` first. Firestore rejects documents containing `undefined` values and will throw at runtime without this step.
- **`const enum` is banned** — TypeScript's `erasableSyntaxOnly` is enabled; use `const` maps or union string literals instead of enums in AI action modules.
- **AI Preferences modal — avoid always-visible forms in the chat pane** — the always-visible form was replaced by a bottom-sheet modal after it blocked the chat area on mobile when the keyboard appeared. Any future additions to the chat page that occupy vertical space should use a similar modal/sheet pattern.
- **`ChevronDown` is used on the Import Activities button** — it appears in the lucide-react import but is not obviously needed elsewhere; do not remove it during icon-import cleanup.

## Open Questions

- **Interactions API adoption** — should the conversational assistant (`src/lib/ai/actions/assistant.ts`) be migrated to the Gemini Interactions API to offload history management to the server and gain access to background execution and streaming?
- **Streaming responses** — the current `generateWithGemini()` implementation does not expose streaming. For long-running tasks (e.g., full itinerary import), streaming via SSE could improve perceived performance.
- **Cache invalidation strategy** — `src/lib/ai/cache.ts` caches by prompt content, but there is no documented TTL or eviction policy.
- **Worker model allowlist maintenance** — as Gemini model IDs evolve (preview → stable), the Cloudflare Worker's allowlist will need updating.
- **Places API cost monitoring** — with field-level SKU billing, are there guardrails or alerts in place to detect accidental over-requesting of Places fields?

## Sources

- [[../../../CLAUDE]]
- [[../../../.cursor/rules/rules]]
- [[../../../.agents/skills/gemini-api-dev/SKILL]]
- [[../../../.agents/skills/gemini-interactions-api/SKILL]]
