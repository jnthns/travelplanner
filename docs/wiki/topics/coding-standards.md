---
topic: Coding Standards
last_compiled: 2026-04-04
source_count: 4
status: active
---

# Coding Standards

## Summary

TravelPlanner enforces a strict, opinionated set of coding standards across all TypeScript source files. Standards cover language configuration, naming conventions, module structure, date handling, styling, error handling, and AI layer usage. All conventions are enforced through code review — no automated test suite exists. The TypeScript compiler config (`tsconfig.json`) enforces structural rules such as `erasableSyntaxOnly`, `verbatimModuleSyntax`, and `noUnusedLocals` at build time.

---

## Timeline

- **Project inception** — TypeScript strict mode adopted from the start; no `.js` production files permitted.
- **Firestore integration** — `stripUndefined()` convention established to prevent Firestore rejection of `undefined` values.
- **AI layer introduction** — `generateWithGemini()` proxy requirement added; direct Gemini API calls from the frontend prohibited.
- **IndexedDB migration** — `useLocalStorageState` canonical location moved to `src/lib/persist.ts`; the `src/hooks/` version deprecated for external use.
- **`erasableSyntaxOnly` enabled** — `const enum` and other non-erasable TypeScript syntax permanently disallowed.

---

## Current State

TypeScript strict mode is fully enforced via `tsconfig.json` with the following compiler options active:

- `strict: true` — all strict type checks enabled, including no implicit `any`.
- `verbatimModuleSyntax` — imports/exports must be written as they appear in the output; type-only imports use `import type`.
- `noUnusedLocals` — unused local variables are a compile error.
- `erasableSyntaxOnly` — `const enum`, namespaces, and other non-erasable syntax are disallowed.

No test suite is configured. All conventions beyond what the compiler catches are enforced through code review. The ESLint config (`npm run lint`) provides a secondary enforcement layer.

---

## Key Decisions

**`erasableSyntaxOnly` enabled**
Prevents `const enum`, namespaces, and parameter properties — constructs that require TypeScript-specific emit and are incompatible with pure type-erasure tooling. Consequence: all enums must be replaced with `const` maps or union string literals.

**`verbatimModuleSyntax` enabled**
Requires explicit `import type` for type-only imports. Prevents accidental runtime imports of type-only modules and aligns output with ESM semantics.

**No barrel `index.ts` re-exports**
Import directly from the defining file (e.g., `import { useTrips } from 'src/lib/store'`, not from a barrel). Barrel files create hidden coupling, bloat bundle analysis, and obscure where logic lives.

**No direct Gemini API calls from the frontend**
All AI calls must go through `generateWithGemini()` in `src/lib/gemini.ts`, which proxies to the Cloudflare Worker. This enforces rate limiting, JWT auth validation, and single-flight deduplication in one place.

**`stripUndefined()` before all Firestore writes**
Firestore rejects documents containing `undefined` values. The utility is defined in `src/lib/store.ts` and must be called before every `setDoc`, `updateDoc`, `addDoc`, or `batch.update`.

**One concern per file**
Each file is responsible for exactly one of: a component, helper functions, types, or constants. This keeps files small, imports explicit, and responsibilities clear.

**`interface` over `type` for object shapes**
Use `interface` for all object type definitions. Reserve `type` for unions, intersections, and aliases of primitives. Component props interfaces must be named `[ComponentName]Props` and wrapped in `Readonly<T>`.

**Date arithmetic via `date-fns` only**
All dates are ISO strings (`YYYY-MM-DD`). Use `parseISO`, `format`, and `isWithinInterval` from `date-fns`. Inline `new Date()` arithmetic is prohibited.

**CSS custom properties only**
All colors reference tokens from `theme.css` via `var(--primary-color)`, `var(--border-color)`, etc. Hardcoded hex or rgb values in component files are prohibited.

---

## Experiments & Results

| Experiment | Status | Finding | Source |
|------------|--------|---------|--------|
| No experiments tracked. | — | — | — |

---

## Gotchas & Known Issues

- **`useLocalStorageState` has two versions.** The canonical version is in `src/lib/persist.ts` and returns `[value, setValue] as const`. The version in `src/hooks/useLocalStorageState.ts` returns `[T, Dispatch<SetStateAction<T>>]` — these differ. Always import from `src/lib/persist.ts`.
- **`const enum` silently compiles in some editors** but will fail the Vite build because `erasableSyntaxOnly` is set. Do not use `const enum` anywhere.
- **Deprecated Gemini model IDs** (`gemini-2.x`, `gemini-1.5-*`) will be rejected by the Cloudflare Worker. Use only the approved model IDs: `gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3-pro-image-preview`.
- **Vite base path is `/travelplanner/`** — any hardcoded URL construction that omits this prefix will produce broken links in the GitHub Pages deployment.
- **Error handling:** errors must be surfaced to UI state. Silent swallowing (`catch () {}`) is only acceptable for explicitly non-critical paths and must be noted with a comment.
- **No `any` without justification.** Every use of `any` requires a `// reason:` comment inline. Prefer `unknown` with explicit type narrowing.
- **`<form>` elements with native submit** can conflict with React state-driven flows. Use `onClick`/`onChange` event handlers directly rather than relying on native form submission.

---

## Open Questions

- Should ESLint rules be added to automate enforcement of `import type`, no-barrel, or `stripUndefined` patterns currently caught only by review?
- Is there a plan to introduce a test suite (Vitest, Playwright) to complement the type-level and review-based enforcement?
- Should the `src/hooks/useLocalStorageState.ts` version be deleted or formally deprecated to eliminate the dual-version confusion?

---

## Sources

- [[../../../CLAUDE]]
- [[../../../.cursor/rules/rules]]
- [[../../../.agents/skills/react-components/SKILL]]
- [[../../../.agents/skills/react-components/resources/architecture-checklist]]
