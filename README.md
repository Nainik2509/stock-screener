# Real-Time Stock Screener

A real-time stock screener for US equities, built with **Next.js (App Router)**,
**TypeScript**, and **Tailwind CSS**, powered by the **Finnhub** free-tier API for
market data and a real **LLM** for AI-generated insights.

> Status: feature-complete. Implemented: the Finnhub data layer, REST routes,
> SSE live streaming, the live screener UI (`ScreenerTable` with dark mode +
> price-flash animations), finance-driven URL-synced filters, the slide-in
> stock detail panel, and the AI insight feature (provider-agnostic
> Gemini/OpenAI adapter). Components follow a feature-first structure
> (`components/screener/`, `components/filter/`, `components/detail/`) — see
> [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Documentation

| Doc | What's inside |
| --- | --- |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System overview, project structure, layers, and data-flow diagrams |
| [docs/DECISIONS.md](./docs/DECISIONS.md) | Key decisions and trade-offs (architecture, data flow, rendering, failure handling) |
| [docs/API.md](./docs/API.md) | Per-route API contracts (request/response, errors, caching) |
| [.claude/CLAUDE.md](./.claude/CLAUDE.md) | AI-assistant guidance and the non-negotiable hard constraints |

## Tech stack

- **Next.js 16** (App Router, React Server Components, Node runtime)
- **TypeScript** (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`)
- **Tailwind CSS v4** (no UI component libraries)
- **Finnhub** free tier — REST + WebSocket (only market-data provider)
- **LLM** — Gemini `2.0-flash` (default) or OpenAI `gpt-4o-mini`, provider-agnostic

## Getting started

### 1. Configure environment variables

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

| Variable | Required | Notes |
| --- | --- | --- |
| `FINNHUB_API_KEY` | Yes | Free key from [finnhub.io](https://finnhub.io/dashboard) |
| `GEMINI_API_KEY` | One LLM key | Free tier from [Google AI Studio](https://aistudio.google.com/apikey) |
| `OPENAI_API_KEY` | One LLM key | Alternative to Gemini |
| `LLM_PROVIDER` | Optional | `gemini` or `openai` (auto-detected if omitted) |

All keys are **server-side only** — none are prefixed `NEXT_PUBLIC_`.

### 2. Install dependencies

```bash
npm install
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev      # start dev server
npm run build    # production build (also type-checks)
npm run start    # serve the production build
npm run lint     # ESLint
npx tsc --noEmit # standalone type-check
```

## Project structure (high level)

```
app/         App Router pages + api/ route handlers (Node runtime)
components/  Client/presentational components (Tailwind only)
lib/         finnhub/ (REST, cache, WS, universe) · llm/ (AI adapter) · shared types
docs/        Architecture and decision docs
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full tree and diagrams.

## Hard constraints

This project follows a set of non-negotiable constraints (Finnhub-only data, real
WebSocket feed, no mocked prices, real LLM, no UI component libraries, no `any`,
etc.). They are documented in full in [.claude/CLAUDE.md](./.claude/CLAUDE.md).

## Known limitations

- Real-time state (WS + cache) is in-memory and assumes a **single Node instance**.
- Finnhub free-tier trades stream during **US market hours**; outside them the app
  falls back to REST `/quote` polling (still real data, less frequent).
- The symbol universe is a curated ~25-ticker list (symbols only, never prices).
- AI insights are generated on demand (per button click) and not cached; the LLM
  call has a 15s timeout and free-tier providers have daily quotas. A failed
  insight degrades gracefully and never affects the screener or detail view.

Details and rationale: [docs/DECISIONS.md](./docs/DECISIONS.md).
