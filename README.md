# CronRunner

A modern, cross-platform (macOS · Windows · Linux) manager for local scheduled jobs. Describe a task in plain English, let an LLM (your own OpenAI or Anthropic key) draft the command and schedule, review it, and CronRunner runs it on your machine at the right time. Full UI for creating, editing, enabling/disabling, running, and inspecting jobs and their output.

> Status: scaffold complete, implementation in progress. See `docs/PLAN.md`.

## Stack
Bun · TypeScript · Hono · croner · bun:sqlite · React 19 · Vite · Tailwind 4 · TanStack Query · zod · @anthropic-ai/sdk · openai

## Development
```
bun install
bun run dev:server   # API  http://127.0.0.1:4747
bun run dev:web      # UI   http://localhost:5173
```

## Production
```
bun run compile      # -> apps/server/dist/cronrunner (serves UI + API + scheduler)
```

## Docs
- `docs/PRD.md` — what and why
- `docs/ARCHITECTURE.md` — how it fits together
- `docs/DESIGN.md` — UI system and page specs
- `docs/API.md` — HTTP endpoints
- `docs/PLAN.md` — phased implementation plan with verification steps
