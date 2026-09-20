# Implementation Plan

This is the step-by-step build plan for CronRunner. It is written so that an implementer (human or model) can work top to bottom without re-deciding anything. Read `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `API.md` first. Every phase ends with a verification step; do not move on until it passes.

## 0. Ground rules for the implementer

- **Do not change the shared schemas' meaning** (`packages/shared/src/schemas.ts`) without updating the DB layer, routes, API doc, and UI together. Adding optional fields is fine.
- **Keep all SQL in `apps/server/src/db/db.ts`.** Keep all provider SDK calls in `apps/server/src/llm/`.
- **Every route validates input with `parseBody(c, Schema)`** and throws `HttpError` for expected failures.
- **The UI never hand-writes API types.** Import from `@cronrunner/shared`; call through `src/lib/api.ts`.
- **Use the design tokens and primitives** from `DESIGN.md`. No ad-hoc colors, no inline styles.
- Run `bun run typecheck`, `bun test`, and `bun run lint` before finishing each phase. Fix, don't skip.
- Commit at the end of each phase with the message `phase N: <title>`.
- Do not add dependencies beyond those listed in `ARCHITECTURE.md` unless a task below names one.

Commands:
```
bun install
bun run dev:server      # http://127.0.0.1:4747 (API)
bun run dev:web         # http://localhost:5173 (UI, proxies /api)
bun run typecheck
bun test
bun run build           # web -> apps/server/public
bun run compile         # single binary at apps/server/dist/cronrunner
```
Set `CRONRUNNER_DATA_DIR=./.cronrunner` while developing so you don't pollute the real app-data folder.

## What is already done (scaffold)

- Workspace, TS config, Biome config.
- `packages/shared`: all zod schemas, types, constants, schedule presets.
- Server: config/data dirs, SQLite schema + full DAL, settings persistence with key masking, event bus, croner scheduler with validate/describe/preview, executor (spawn, stream, cap, timeout, kill), all routes in `API.md`, SSE endpoint, static serving with SPA fallback, both LLM providers with structured outputs, 6 passing tests. Verified with a live smoke test (create job → run now → output captured).
- Web: Vite + Tailwind 4 tokens, router, react-query, typed API client, SSE cache invalidation hook, theme hook, `AppShell` sidebar, `PageHeader`, and placeholder pages.

The rest of this document is what remains.

---

## Phase 1 — UI primitives (apps/web/src/components/ui)

Build every primitive in `DESIGN.md §2` as its own file. Keep them small, typed, and dependency-free (use `clsx`).

1.1 `Button.tsx`, `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Switch.tsx`, `Badge.tsx` (+ `StatusBadge`, `Tag`), `Card.tsx`, `Table.tsx` (thin wrappers: `Table`, `Th`, `Td`, `Tr`), `Dialog.tsx` + `ConfirmDialog.tsx`, `Toast.tsx` (provider + `useToast()`), `EmptyState.tsx`, `Kbd.tsx`, `CodeBlock.tsx` (with copy), `Skeleton.tsx`, `Tooltip.tsx` (simple CSS/title-based is acceptable), `DropdownMenu.tsx` (for row ⋯ menus; click-outside + Esc to close).
1.2 `src/lib/format.ts`: `relativeTime(iso)`, `absoluteTime(iso)` (local, with weekday), `formatDuration(ms)`, `truncate(str, n)`.
1.3 Mount `ToastProvider` in `main.tsx`.
1.4 Add a hidden dev route `/_kitchen-sink` rendering every primitive in every state (keeps visual QA easy; remove in Phase 8).

**Verify:** `/_kitchen-sink` renders in light and dark with no console errors; keyboard tab order works; typecheck clean.

## Phase 2 — Jobs list page

2.1 `hooks/useJobs.ts`: `useJobs()`, `useJob(id)`, mutations `useCreateJob`, `useUpdateJob`, `useDeleteJob`, `useToggleJob` (optimistic update of `enabled` in the `qk.jobs` cache, rollback on error + toast), `useRunNow`.
2.2 `components/jobs/JobsTable.tsx` per `DESIGN.md §4.2`. Row click navigates; the switch and action buttons `stopPropagation`.
2.3 `components/jobs/JobFilters.tsx`: search + status chips; filtering is client-side over the list.
2.4 `pages/JobsPage.tsx`: header with "New job" split button (With AI → `/jobs/new?mode=ai`, Manually → `/jobs/new`), filters, table, empty state, skeleton while loading.
2.5 Delete flow: `ConfirmDialog` → `useDeleteJob` → toast → stays on page.
2.6 Keyboard: `N` → new job (ignore when focus is in an input), `/` → focus search.

**Verify:** create a few jobs via curl, confirm list/filters/toggle/run-now/delete all work and the list updates live (SSE) when a scheduled run finishes.

## Phase 3 — Job editor (manual)

3.1 `components/jobs/ScheduleField.tsx`: preset `<Select>` + cron `<Input>` (mono). Debounced (300 ms) call to `api.jobs.validateSchedule`; shows English text or error; exposes `next[]` to the parent for the preview card.
3.2 `components/jobs/TimezoneSelect.tsx`: searchable list from `Intl.supportedValuesOf("timeZone")`, first option "Local (<zone>)" → `null`.
3.3 `components/jobs/EnvVarsEditor.tsx`, `components/jobs/TagsInput.tsx`.
3.4 `components/jobs/JobForm.tsx`: controlled form over `CreateJobInput`; client-side validation with `CreateJobInputSchema.safeParse` on submit, mapping zod issues to field errors. Props: `initial`, `onSubmit`, `submitting`.
3.5 `components/jobs/JobPreviewCard.tsx`: human schedule, next 5 runs, command CodeBlock, cwd/shell/timeout summary.
3.6 `pages/JobEditorPage.tsx`: loads job when `:id` present; two-panel layout; Save → create or update → navigate to detail with toast. Cancel → back. Unsaved-changes guard on navigation (simple `beforeunload` + confirm on in-app nav is enough).
3.7 Duplicate: `/jobs/new?from=<id>` prefills from that job with name suffixed " (copy)".

**Verify:** create, edit, duplicate jobs entirely from the UI; invalid cron shows an inline error and blocks save; timezone changes shift the preview times.

## Phase 4 — Job detail and run viewer

4.1 `hooks/useRuns.ts`: `useJobRuns(id)`, `useRun(id)`, `useRecentRuns()`, `useKillRun()`.
4.2 `hooks/useRunOutput.ts`: subscribes to SSE `run.output` events for a given runId (open a second `EventSource` or extend `useServerEvents` with a tiny event emitter so components can listen) and appends chunks to local state; seeds from `useRun` when the run is already finished.
4.3 `components/runs/RunsTable.tsx`, `components/runs/RunDrawer.tsx` (right side panel; stdout/stderr tabs; auto-scroll toggle; Kill button when running; copy output).
4.4 `pages/JobDetailPage.tsx` per `DESIGN.md §4.4`. Enabled switch in the header uses `useToggleJob`.
4.5 `pages/ActivityPage.tsx`: `useRecentRuns` + status/job filters + same drawer.

**Verify:** create a job with command `for i in 1 2 3 4 5; do echo line $i; sleep 1; done` (PowerShell equivalent on Windows), run now, watch lines appear live in the drawer; a job with `sleep 100` and timeout 3 ends as `timeout`; Kill works.

## Phase 5 — Settings and LLM wiring

5.1 `hooks/useSettings.ts`: `useSettings()`, `useUpdateSettings()`, `useTestLlm()`.
5.2 Server: in `routes/settings.ts` and `routes/ai.ts`, map SDK errors to friendly messages. Anthropic: `Anthropic.AuthenticationError` → "Invalid Anthropic API key", `Anthropic.RateLimitError` → "Rate limited by Anthropic, try again shortly", `Anthropic.APIConnectionError` → "Cannot reach api.anthropic.com". OpenAI: `OpenAI.AuthenticationError`, `OpenAI.RateLimitError`, `OpenAI.APIConnectionError` similarly. Put the mapping in `src/llm/errors.ts` and use it in both routes. Verify the OpenAI Responses API helper names against the installed `openai@5.23` typings (`client.responses.parse`, `zodTextFormat` from `openai/helpers/zod`); adjust if the typecheck disagrees.
5.3 `pages/SettingsPage.tsx` per `DESIGN.md §4.6`. Key input is `type="password"`; after save it shows "Configured · ends in ····1234" with Replace / Remove. "Test connection" posts the currently typed (unsaved) key so users can verify before saving.
5.4 Theme setting: `useTheme` currently uses localStorage; keep that as the source of truth and also persist to settings for completeness (optional).

**Verify:** with a real key, Test connection succeeds; with a bad key, the friendly message appears; `GET /api/settings` never contains the key; `settings.json` has mode 0600 on macOS/Linux.

## Phase 6 — AI job builder

6.1 `hooks/useAi.ts`: `useGenerateJob()`, `useExplainCron()`, `useDiagnoseRun()`.
6.2 `components/ai/AiPromptPanel.tsx`: textarea, example chips, Generate button, loading state; when `settings.keys[provider].configured` is false render the "add a key" callout instead.
6.3 `components/ai/AiDraftCallout.tsx`: explanation, warnings (amber, `AlertTriangle` icon), clarifying questions with a reply input that re-calls generate with `currentDraft` = current form values and `history` = prior turns.
6.4 In `JobEditorPage`, `mode=ai` shows the AI tab first; on draft, merge into form state (`source: "ai"`), scroll to form, keep the callout visible above it. Refinement replaces form values but preserves fields the user changed by hand since the last generate (track a `dirtyFields` set; send those as part of `currentDraft` so the model keeps them).
6.5 Cron "Explain" link next to the schedule field (uses `explainCron`; falls back to the cronstrue text when no key).
6.6 Run drawer: "Ask AI why this failed" for failed/timeout runs → `AiDiagnosisCard` with "Apply suggested command" → navigates to `/jobs/:id/edit` with the command prefilled via router state.
6.7 Prompt tuning: run the six example prompts below on both providers and adjust `src/llm/prompts.ts` until all produce valid drafts with sensible warnings:
  - "Back up ~/Documents to ~/Backups every night at 2am"
  - "Delete files in my Downloads older than 30 days every Sunday morning"
  - "Every 5 minutes check if https://example.com responds and append the status to ~/uptime.log"
  - "Run `git pull` in ~/code/myrepo every weekday at 8am"
  - "Empty the trash on the 1st of every month"
  - "Remind me to stretch every hour during work hours" (should produce a notification command per OS: `osascript -e 'display notification…'`, `notify-send`, PowerShell toast)

**Verify:** each example yields a saved, runnable job with ≤1 refinement; the destructive ones carry warnings.

## Phase 7 — Dashboard, packaging, start-at-login

7.1 `pages/DashboardPage.tsx` per `DESIGN.md §4.1`. Upcoming list is computed client-side from `jobs[].nextRunAt` (sorted); 24h stats from `useRecentRuns(200)` filtered by `startedAt`.
7.2 Disconnected banner: in `AppShell`, if `system` query errors twice in a row, show the slim banner from `DESIGN.md §5`.
7.3 **Single binary.** In `apps/server/src/index.ts`, replace the disk `public/` lookup with embedded assets when compiled: generate `src/embedded.gen.ts` at build time (a script `apps/server/scripts/embed.ts` that walks `public/` and emits `import x from "../public/..." with { type: "file" }` entries plus a map of path → import) and serve from it when `Bun.embeddedFiles.length > 0`. Update root `compile` script to run embed → compile. Add `--open` flag handling: after listen, open `http://127.0.0.1:PORT` with `open` (macOS), `xdg-open` (Linux), `start` (Windows).
7.4 **Start at login.** New module `apps/server/src/autostart.ts` with `install()`, `uninstall()`, `status()`:
  - macOS: write `~/Library/LaunchAgents/com.cronrunner.daemon.plist` (RunAtLoad, KeepAlive, ProgramArguments = [binary path]); `launchctl load/unload`.
  - Linux: `~/.config/systemd/user/cronrunner.service` + `systemctl --user enable --now`.
  - Windows: `schtasks /Create /SC ONLOGON /TN CronRunner /TR "<binary>"` (fallback: shortcut in the Startup folder).
  Route `GET/POST/DELETE /api/system/autostart`; add to `SystemInfoSchema` an `autostart: { supported: boolean; enabled: boolean }` field; Settings page switch.
7.5 Cross-platform executor check: on Windows confirm `resolveShell("auto")` → PowerShell and that `proc.signalCode` handling works; on Linux confirm `bash -l` exists in a minimal container (fallback to `sh` if `bash` missing: catch spawn ENOENT and retry with `sh`).
7.6 Build matrix: `bun build --compile --target=bun-darwin-arm64|bun-darwin-x64|bun-linux-x64|bun-windows-x64`. Add `scripts/release.ts` that produces `dist/cronrunner-<target>[.exe]` for all four.

**Verify:** the compiled binary, copied to an empty directory, serves the full UI, schedules jobs, and survives a reboot with autostart enabled (test on at least macOS).

## Phase 8 — Hardening and polish

8.1 Tests: executor (success/fail/timeout/kill/output cap), DAL (prune, orphan marking), routes (each error code), settings (key masking). Target: `bun test` green with ≥25 tests.
8.2 Optional local auth token: on first start write `token` to the data dir; UI fetches it from `GET /api/auth/bootstrap` served only to same-origin; all other `/api` routes require `x-cronrunner-token`. Skip if it complicates the browser flow; document the decision.
8.3 Logging: daemon writes to `logs/cronrunner.log` with daily rotation (simple size-based rotation is fine). Job output is already in the DB.
8.4 Missed runs: on startup, log (not execute) each enabled job whose `nextRunAt` computed from `updatedAt` is in the past. Surface as an info banner on the dashboard: "N jobs missed runs while CronRunner was off."
8.5 Remove `/_kitchen-sink` and `Placeholder.tsx`. Run `bun run lint` and `bun run format`. Update `README.md` with install steps per OS and screenshots.
8.6 Accessibility pass per `DESIGN.md §6`.

**Verify:** fresh clone → `bun install && bun run compile` → binary works on macOS; `bun test`, `bun run typecheck`, `bun run lint` all clean.

---

## Acceptance checklist (map to PRD user stories)

- [ ] U1 keys saved and tested in Settings
- [ ] U2/U3/U4 AI draft → review → refine → save
- [ ] U5 manual editor with presets, cron, timezone, preview
- [ ] U6 jobs list with status/last/next
- [ ] U7 enable/disable toggle, optimistic
- [ ] U8 run now
- [ ] U9 live stdout/stderr, exit code, history
- [ ] U10 AI diagnosis of failed run
- [ ] U11 kill running job
- [ ] U12 timeout + cwd + shell + env per job
- [ ] U13 light/dark
- [ ] U14 start at login (macOS, Linux, Windows)
- [ ] Single binary per OS
