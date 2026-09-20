# CronRunner — Product Requirements Document

Version 1.0 · September 2026 · Status: approved for implementation

## 1. Summary

CronRunner is a cross-platform desktop application (macOS, Windows, Linux) that makes local scheduled jobs easy. Users describe what they want in plain English ("back up my Documents folder to my external drive every night at 2am"), an LLM (OpenAI or Anthropic, using the user's own API key) turns it into a concrete command and cron schedule, the user reviews and saves it, and CronRunner runs it on that machine at the right time. A modern, professional web UI lets users view, create, edit, enable, disable, run, and delete jobs and inspect every run's output.

CronRunner does **not** edit the system crontab. It ships its own cross-platform scheduler so the same job definition works identically on all three operating systems, including Windows, which has no cron.

## 2. Goals

1. **Zero-friction scheduling.** From install to a working scheduled job in under two minutes, without knowing cron syntax.
2. **Trust through visibility.** Every job shows what it will do, when it runs next, and what happened last time. Every run keeps its output.
3. **AI as a drafting assistant, never an actor.** The LLM proposes; the user always reviews and confirms before anything is saved or executed.
4. **Truly cross-platform.** One codebase, one binary per OS, identical feature set.
5. **Local and private.** Jobs, run history, and API keys stay on the machine. The only network traffic is the user's own LLM API calls.

## 3. Non-goals (v1)

- Syncing jobs between machines or any cloud account.
- Editing or importing the system crontab / launchd / Task Scheduler entries.
- Replaying runs missed while the daemon was stopped (documented; a future "catch-up" option).
- Multi-user or remote access. The server binds to localhost only.
- Running jobs as a different user or with elevated privileges.
- A native system tray icon or auto-updater (v2, see §10).

## 4. Users

- **Primary:** developers and technical power users who want scheduled scripts (backups, syncs, cleanups, reports, reminders) without fighting cron/launchd/Task Scheduler.
- **Secondary:** semi-technical users who can describe a task but not write it. The AI builder and the plain-English explanations exist for them.

## 5. Core user stories

| # | As a user I want to… | So that… |
|---|---|---|
| U1 | paste my OpenAI or Anthropic API key once | the AI features work |
| U2 | type "compress my Downloads folder every Friday at 6pm" and get a ready job | I don't need to know cron or shell flags |
| U3 | see the AI's proposed command, schedule (in English), warnings, and next 5 run times before saving | I trust what will happen |
| U4 | refine the draft conversationally ("make it 7pm", "skip weekends") | I don't start over |
| U5 | create/edit a job manually with a schedule picker and cron field | I have full control |
| U6 | see all jobs with status, last result, and next run in one list | I know the state of my machine at a glance |
| U7 | enable/disable a job with one click | I can pause without deleting |
| U8 | run a job now | I can test it |
| U9 | see stdout/stderr and exit code for every run, streaming while it runs | I can debug |
| U10 | ask the AI why a run failed | I get a fix suggestion |
| U11 | kill a running job | a stuck job doesn't run forever |
| U12 | set a timeout and working directory per job | jobs behave predictably |
| U13 | switch between light and dark mode | it matches my desktop |
| U14 | have CronRunner start when I log in | jobs actually run |

## 6. Functional requirements

### 6.1 Jobs
- Fields: name, description, schedule (5-field cron, optional 6th seconds field), timezone (IANA, default local), command (multi-line allowed), working directory (default home), shell (auto/bash/zsh/sh/powershell/cmd), env vars, timeout, enabled, tags, source (manual/ai).
- Schedule validation happens server-side with croner. Invalid schedules are rejected with a specific message.
- Human-readable schedule text is generated with cronstrue and shown everywhere a schedule appears.
- Editing a job re-registers it with the scheduler immediately. Disabling unregisters it.
- Deleting a job deletes its run history (cascade). The UI confirms first.

### 6.2 Scheduler
- Runs inside the daemon; one timer per enabled job (croner).
- If a job is still running when its next tick fires, the tick is **skipped** and logged. No overlapping runs of the same job.
- Daemon restart re-registers all enabled jobs. Runs left in "running" state from a crash are marked "killed".
- Missed ticks during downtime are not replayed (v1).

### 6.3 Execution
- Commands run through the selected shell with the user's login environment plus job env vars plus `CRONRUNNER_JOB_ID` / `CRONRUNNER_RUN_ID`.
- stdout and stderr are captured separately, streamed live to the UI over SSE, and stored capped at 1 MB per stream with a truncation marker.
- Status: running → success (exit 0) | failed (non-zero) | timeout | killed.
- Retention: keep the newest N runs per job (default 200, configurable).

### 6.4 AI job builder
- Provider: OpenAI or Anthropic, selected in Settings. Model optional override.
- Input: free-text prompt; optional current draft and conversation history for refinement.
- Output (structured, schema-validated): name, description, cron, timezone, command, cwd, shell, timeout, tags, explanation, warnings, clarifying questions.
- The model is told the OS, default shell, home directory, timezone, and current time so commands are correct for this machine.
- The UI shows the draft in an editable form with the explanation, warnings (highlighted), and next-5-runs preview. Nothing is saved until the user clicks Save.
- Secondary AI features: explain a cron expression; diagnose a failed run (summary, likely cause, suggested fix, optional corrected command).
- If no key is configured, AI entry points show an inline "Add an API key" prompt linking to Settings instead of an error.

### 6.5 Settings
- API keys for both providers (stored locally, file permission 0600, never returned to the client in full, only "configured" + last 4).
- Provider + model selection, "Test connection" button.
- Run retention, default shell, theme.
- Env vars `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are used as fallbacks.

### 6.6 Startup at login
- Settings page exposes "Start at login" which installs/removes a launchd agent (macOS), a systemd user service (Linux), or a Task Scheduler logon task / Startup-folder shortcut (Windows) that launches the daemon binary. See docs/PLAN.md Phase 7.

## 7. Non-functional requirements

- **Security:** bind to 127.0.0.1 only. No auth in v1 because only local processes can reach it; document this. Keys never logged. Commands are shown verbatim before saving, and AI drafts flag destructive operations.
- **Performance:** UI interactions under 100 ms; job list of 500 jobs renders without jank; scheduler tick accuracy within 1 s.
- **Reliability:** daemon must survive a job that spews 100 MB of output or never exits (caps + timeouts + kill).
- **Portability:** single compiled binary per OS via `bun build --compile`; the web UI is embedded/served by the same binary.
- **Accessibility:** keyboard-navigable, visible focus rings, WCAG AA contrast in both themes, reduced-motion respected.

## 8. Success metrics (v1)

- Time from first launch to first successful scheduled run < 2 min (manual test).
- AI drafts accepted with ≤1 refinement ≥ 80% of the time in dogfooding.
- Zero data loss of run history across daemon restarts.

## 9. Open questions / decisions made

| Question | Decision |
|---|---|
| Electron / Tauri / local web app? | **Local web app served by a Bun daemon**, opened in the default browser. Electron cannot run on Bun; Tauri needs a Rust toolchain. A Bun binary + browser gives full TS, one process, easy start-at-login. A Tauri/webview shell can wrap it later without changing the API. |
| System cron vs own scheduler? | **Own scheduler** (croner). Cron doesn't exist on Windows and per-OS integration would triple the surface area. |
| Where do API keys live? | Local settings.json, 0600. OS keychain integration is a v2 nice-to-have. |
| Default models | Anthropic `claude-opus-5`, OpenAI `gpt-5`. Both overridable. |

## 10. Future (v2+)

Native tray app (Tauri wrapper), OS keychain for keys, missed-run catch-up policy per job, job dependencies/chaining, notifications (desktop, email, webhook) on failure, import from crontab, export/import jobs as JSON, auto-update.
