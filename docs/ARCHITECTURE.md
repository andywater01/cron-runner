# Architecture

## Overview

```
┌──────────────────────────────┐        ┌──────────────────────────────────────────┐
│  Browser (React + Tailwind)  │  HTTP  │  Bun daemon (apps/server)                │
│  apps/web                    │◄──────►│  ┌────────┐ ┌───────────┐ ┌───────────┐ │
│  - react-query cache         │  SSE   │  │ Hono   │ │ Scheduler │ │ Executor  │ │
│  - EventSource /api/events   │◄───────│  │ routes │ │ (croner)  │ │ Bun.spawn │ │
└──────────────────────────────┘        │  └───┬────┘ └─────┬─────┘ └─────┬─────┘ │
                                        │      └────────────┼─────────────┘       │
                                        │            ┌──────▼──────┐   ┌────────┐ │
                                        │            │ bun:sqlite  │   │ LLM    │ │
                                        │            │ jobs, runs  │   │ clients│ │
                                        │            └─────────────┘   └───┬────┘ │
                                        └──────────────────────────────────┼──────┘
                                                                           ▼
                                                             api.openai.com / api.anthropic.com
```

One long-lived Bun process does everything: serves the API and the built UI, runs the scheduler, spawns jobs, talks to the LLM. The browser is a thin client. Shared zod schemas in `packages/shared` are the contract between the two.

## Monorepo layout

```
cronrunner/
  package.json              bun workspaces, root scripts (dev, build, compile, typecheck, test)
  tsconfig.base.json        strict TS base
  biome.json                lint + format
  docs/                     PRD, ARCHITECTURE, DESIGN, PLAN, API
  packages/shared/          zod schemas + types + constants (no runtime deps besides zod)
  apps/server/              Bun daemon
    src/index.ts            entry: data dirs, db, scheduler.start(), Bun.serve
    src/app.ts              createApp(): Hono app, route mounting, error handler, static serving
    src/config.ts           data dir resolution per OS, port, paths
    src/settings.ts         settings.json persistence, API key access
    src/events.ts           in-process pub/sub -> SSE
    src/db/schema.sql       SQLite DDL (applied idempotently)
    src/db/db.ts            all SQL lives here; returns shared types
    src/scheduler/scheduler.ts  croner registry, validate/describe/preview helpers
    src/scheduler/executor.ts   spawn, stream, cap, timeout, kill, record
    src/llm/provider.ts     LlmClient interface + factory
    src/llm/anthropic.ts    @anthropic-ai/sdk, messages.parse + zodOutputFormat
    src/llm/openai.ts       openai, responses.parse + zodTextFormat
    src/llm/prompts.ts      system prompts + machine context
    src/routes/*.ts         one file per resource
    src/__tests__/          bun test
    public/                 web build output (generated, gitignored)
  apps/web/                 Vite + React 19 + Tailwind 4
    src/main.tsx            providers (react-query, router)
    src/App.tsx             routes
    src/lib/api.ts          typed fetch client
    src/lib/queryKeys.ts
    src/hooks/              useServerEvents (SSE -> cache invalidation), useTheme
    src/components/         layout/, ui/ (primitives), jobs/, runs/, ai/
    src/pages/              one component per route
```

## Key runtime flows

### Create a job with AI
1. User types a prompt in the AI builder (`/jobs/new`, AI tab).
2. `POST /api/ai/generate-job` → `getLlmClient()` picks provider from settings → structured output parsed against `AiJobDraftSchema`.
3. UI fills the editor form with the draft, shows explanation + warnings + `POST /api/jobs/validate-schedule` preview.
4. User edits, clicks Save → `POST /api/jobs` → `db.insertJob` → `scheduler.schedule(job)` → `publish(job.changed)`.

### Scheduled run
1. croner fires the job's callback → re-reads the job from DB (picks up edits) → `executeJob(job, "schedule")`.
2. Executor inserts a `running` run row, publishes `run.started`, spawns the shell, pumps stdout/stderr (publishing `run.output` chunks), enforces timeout, then `finishRun` + `run.finished`.
3. UI's EventSource receives events → react-query invalidates jobs/runs → lists update; an open run detail view appends chunks live.
4. Old runs pruned to `runRetentionPerJob`.

### Settings + keys
`settings.json` holds public settings plus `openaiApiKey` / `anthropicApiKey`. `GET /api/settings` strips keys and returns `{configured, last4}`. Env vars are fallbacks.

## Data model

See `packages/shared/src/schemas.ts` (authoritative) and `apps/server/src/db/schema.sql`. Timestamps are ISO-8601 UTC strings. Arrays/objects are JSON columns.

## Dependencies (installed versions at scaffold time)

| Package | Version | Purpose |
|---|---|---|
| bun | 1.3.9 | runtime, bundler, test runner, SQLite |
| hono | 4.13 | HTTP router, SSE helper, static files |
| croner | 9.1 | cron parsing + timers, timezones, overrun protection |
| cronstrue | 2.61 | cron → English |
| zod | 3.24 | schemas (shared) |
| @anthropic-ai/sdk | 0.80 | Anthropic structured outputs |
| openai | 5.23 | OpenAI structured outputs (Responses API) |
| react / react-dom | 19.3 | UI |
| react-router-dom | 7.18 | routing |
| @tanstack/react-query | 5.103 | server state |
| tailwindcss + @tailwindcss/vite | 4.3 | styling (CSS-first config, `@theme`) |
| vite | 6.4 | dev server (proxies /api) + build |
| lucide-react | 0.474 | icons |
| date-fns | 4.1 | relative times |
| @biomejs/biome | 2.5 | lint/format |

## Build and distribution

- Dev: `bun run dev:server` (port 4747, `--watch`) and `bun run dev:web` (Vite on 5173, proxies `/api`).
- Prod: `bun run build` → `apps/web` builds into `apps/server/public/`; the server serves it with SPA fallback.
- Single binary: `bun run compile` → `apps/server/dist/cronrunner`. Phase 7 of the plan embeds `public/` into the binary (Bun supports importing files with `with { type: "file" }` for embedding) and adds `--open` to launch the browser.

## Security model

- Listens on 127.0.0.1 only; never change `HOST`.
- No authentication in v1 because only local processes can connect. Document clearly. (Optional hardening in Phase 8: random token in the data dir, sent as a header by the UI.)
- API keys never leave the machine except to their own provider. Never logged.
- LLM output is a draft. It is displayed verbatim and saved only on explicit user action; it is never executed automatically.
- Commands run with the daemon user's privileges. That is the point of the tool; the PRD documents it.

## LLM integration notes

- Both providers implement `LlmClient` in `src/llm/provider.ts`. Add a provider by implementing the interface and extending `LlmProviderSchema`.
- Anthropic: `client.messages.parse({ output_config: { format: zodOutputFormat(schema) } })`, read `response.parsed_output`. Thinking is adaptive by default on `claude-opus-5`; no thinking param needed. Never add date suffixes to model ids.
- OpenAI: `client.responses.parse({ text: { format: zodTextFormat(schema, "name") } })`, read `response.output_parsed`.
- Errors from either SDK should be mapped to friendly strings in the route layer: 401 → "Invalid API key", 429 → "Rate limited", network → "Cannot reach <provider>".
