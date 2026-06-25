# Claude Code Instructions — Real-Time Stock Screener

This file provides guidance for AI-assisted development within this repository.
It is the **source of truth** for how work must be done here. When anything below
conflicts with habits, training-data assumptions, or patterns found elsewhere,
**this file wins.**

---

## HARD CONSTRAINTS (NON-NEGOTIABLE)

These are absolute. Do not violate them under any circumstance. If a task seems
to require breaking one, STOP and ask for clarification instead.

1. **Next.js with the App Router.** No Pages Router.
2. **TypeScript throughout.** Every source file is `.ts`/`.tsx`.
3. **No `any`.** Do not use `any` unless truly unavoidable, and when it is, add an
   inline comment on the same line explaining exactly why it is necessary.
4. **Finnhub free-tier API ONLY** for stock market data. No other market-data
   provider may be introduced (no Alpha Vantage, Polygon, IEX, Yahoo, etc.).
5. **Real Finnhub data + real WebSocket.** Use real Finnhub quote/profile REST
   data and the Finnhub WebSocket feed (`wss://ws.finnhub.io`) for real-time
   price updates.
6. **Never replace Finnhub** with another stock data provider.
7. **No mocked or hardcoded stock prices.** Prices/quotes must always come from a
   live Finnhub call. (A hardcoded *list of ticker symbols* is allowed — symbols
   are not prices.)
8. **Real LLM integration** for the AI insight feature. An actual API call to a
   real model (Gemini / OpenAI) — never canned, templated, or faked text.
9. **No UI component libraries.** Do NOT add shadcn, MUI, Chakra, Radix UI, Ant
   Design, Headless UI, DaisyUI, or any similar kit. **Tailwind CSS only.**
10. **Realistic for a 4–5 hour assignment.** Favor pragmatic, focused scope over
    gold-plating. Do not over-engineer.
11. **Document important decisions** instead of silently making them. Record them
    in `DECISIONS.md` (and surface notable trade-offs to the user).

### Constraint-driven implementation rules
- The `FINNHUB_API_KEY` and any LLM key are **server-side only**. Never prefix
  them with `NEXT_PUBLIC_` and never let them reach the browser. All Finnhub REST
  calls and the upstream WebSocket are consumed in Node-runtime server code; the
  browser talks only to our own API routes / SSE stream.
- Respect Finnhub free-tier limits: ~60 REST calls/min and a ~50-symbol WebSocket
  cap. Cache profiles/metrics aggressively; bound the symbol universe (~25).
- When the US market is closed and the trade WebSocket is idle, fall back to
  periodic REST `/quote` polling — but the value is still real Finnhub data,
  never invented.

---

## Project Overview

A Real-Time Stock Screener for US equities.

- **Stack:** Next.js 16 (App Router) · TypeScript (strict) · Node.js runtime for
  server code · Tailwind CSS v4. Single Next.js app, no separate backend.
- **Data:** Finnhub free tier — REST (`/quote`, `/stock/profile2`,
  `/stock/metric`, `/search`) for snapshots/fundamentals, and one server-side
  upstream WebSocket fanned out to clients over SSE for live prices.
- **AI:** provider-agnostic LLM adapter in `lib/llm/`, auto-selecting Gemini
  `2.0-flash` (free tier) or OpenAI `gpt-4o-mini` based on which key is present,
  overridable via `LLM_PROVIDER`.

> Note on framework version: this repo uses **Next.js 16** and **Tailwind v4**,
> which differ from older conventions. Tailwind v4 uses `@import "tailwindcss"`
> in `app/globals.css` with automatic content detection — there is **no**
> `tailwind.config.ts` and **no** `@tailwind base/components/utilities`
> directives. When in doubt about App Router / runtime APIs, consult
> `node_modules/next/dist/docs/` rather than relying on memory.

### Folder structure (feature-first, root-level — no `src/`)
```
app/            # App Router: layout, pages, globals.css
app/api/        # Route Handlers (Node runtime) — REST + SSE + insight
components/     # Presentational + client components (Tailwind only)
lib/            # Shared logic & types
lib/finnhub/    # REST client, cache, WS singleton, universe, raw types
lib/llm/        # Provider-agnostic LLM adapter
```

---

## Documentation First

**CRITICAL**: Always consult the project's documentation before implementing
changes — in this order of precedence:

1. This file (`.claude/CLAUDE.md`) and the Hard Constraints above.
2. `DECISIONS.md` — architecture rationale and locked trade-offs.
3. `API.md` — route contracts (endpoints, params, response shapes, errors).
4. `README.md` — setup, env vars, run/build/lint commands.

When documentation exists, it takes precedence over assumptions or patterns found
elsewhere in the codebase. If you make a meaningful decision not yet recorded,
add it to `DECISIONS.md` as part of the same change.

---

## Common Development Commands

### Setup
```bash
cp .env.example .env.local   # then fill in FINNHUB_API_KEY and an LLM key
npm install
```

### Development
```bash
npm run dev      # start dev server at http://localhost:3000
```

### Linting & Type Checking
```bash
npm run lint            # ESLint (eslint-config-next)
npm run lint -- --fix   # auto-fix
npx tsc --noEmit        # type-check (no dedicated `typecheck` script yet)
```

### Building
```bash
npm run build    # production build (also runs type checking)
npm run start    # serve the production build
```

> Testing scripts (`npm test`, `test:watch`, `test:coverage`) and a `typecheck`
> script are **not configured** in this 4–5 hour assignment scope. If a test
> setup is added later, prefer a lightweight runner (e.g. Vitest) and update this
> section. Until then, treat `npm run lint` + `npm run build` (which type-checks)
> as the required quality gate.

---

## Architecture Principles

### Layered Architecture
Maintain clear separation of responsibilities:

* **Routes (`app/api/*`)**: request handling, validation, calling the data/LLM
  layer, returning typed responses. Always `export const runtime = 'nodejs'`;
  use `dynamic = 'force-dynamic'` for the SSE stream.
* **Pages (`app/*`)**: RSC data loading for first paint, composing client
  components.
* **Feature components (`components/*`)**: screener table, filter bar, detail
  panel, insight card — business behavior and interaction.
* **Data/utilities (`lib/*`)**: Finnhub client/cache/socket, LLM adapter, pure
  helpers and shared types. Normalize raw Finnhub payloads into app DTOs before
  they reach the UI.

### Type boundaries
* Raw Finnhub response shapes live in `lib/finnhub/types.ts`.
* App-facing DTOs live in `lib/types.ts`.
* Never leak raw provider payloads to the client; normalize first.

### State Management
* Server state for API data (fetched in RSC or via our routes).
* Local component state for UI interactions.
* URL search params for shareable filter/selection state.
* Global state only when genuinely necessary (avoid for this scope).

### Component Design
Components should have a single responsibility, stay small and focused, minimize
dependencies, and favor composition over inheritance.

---

## Code Standards

### Type Safety
* Strict typing always (`strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride` are on).
* **Avoid `any`** (see Hard Constraint #3 — inline justification required if ever
  unavoidable). Prefer `unknown` + narrowing over `any`.
* Use explicit types at module boundaries; model domain concepts with meaningful
  types.

### Function Design
* Keep functions focused and prefer pure functions.
* Reduce nesting with early returns.
* Extract reusable logic into `lib/` helpers.

### Error Handling (resilience)
* Every route returns a typed error envelope `{ error: { code, message } }` and
  never throws to the client.
* WebSocket drop → auto-reconnect + REST poll fallback; surface a "delayed/
  polling" badge instead of breaking the UI.
* A single REST failure → keep last-known value, mark stale, continue.
* AI failure is isolated to the insight component; the screener/detail keep
  working. Wrap risky UI in React error boundaries.

### Code Organization
* Group related files; keep folder structure predictable.
* Follow existing naming conventions; avoid circular dependencies.

### User-Facing Content
* No hardcoded prices/quotes (Hard Constraint #7). Configuration (symbol
  universe, TTLs, provider) lives in `lib/`, not scattered in components.
* Consider accessibility in all UI work (semantic HTML, labels, focus states).

---

## Code Review Checklist

Before considering work complete, verify:

**Hard Constraints**
* No new market-data provider; all prices come from live Finnhub calls.
* No `any` without an inline justification comment.
* No UI component libraries added to `package.json`.
* Keys remain server-side (no `NEXT_PUBLIC_` on secrets).
* Notable decisions recorded in `DECISIONS.md`.

**Architecture & Quality**
* Correct layer placement; proper separation of concerns; no unnecessary
  coupling.
* Code is readable, maintainable, and appropriately sized.
* Raw provider data normalized before reaching the UI.

**Type Safety**
* Types are accurate; minimal/justified escape hatches; no needless assertions.

**Quality gate passes**
* `npm run lint` clean and `npm run build` succeeds.

---

## Development Workflow

1. Understand requirements and re-check the Hard Constraints.
2. Review relevant documentation (`DECISIONS.md`, `API.md`, `README.md`).
3. Explore existing architecture and reuse patterns.
4. Plan the change; keep scope realistic for the assignment.
5. Implement incrementally.
6. Run quality checks (`npm run lint`, `npm run build`).
7. Update docs (`DECISIONS.md` / `API.md` / `README.md`) for any decision.

---

## AI Assistant Guidelines

### When Generating Code
* Obey the Hard Constraints first, project standards second.
* Prefer clarity over cleverness; produce maintainable solutions.
* Respect architectural boundaries; avoid unnecessary abstractions.
* Do not introduce dependencies that conflict with the constraints (especially UI
  kits or alternative data providers).

### When Uncertain
* Consult project documentation and `node_modules/next/dist/docs/` for Next 16
  specifics.
* Ask clarifying questions rather than assuming.
* Prefer established project patterns.

---

## Important Reminders

* The Hard Constraints are non-negotiable — never trade them away for
  convenience.
* Documentation is the source of truth; record decisions, don't make them
  silently.
* No mocked/hardcoded prices, ever — real Finnhub data only.
* Keep solutions simple unless complexity is clearly justified.
* Keys stay on the server. Preserve architectural consistency across the codebase.
