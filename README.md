# CronRunner

A modern, cross-platform manager for scheduled jobs on your own machine. Describe a task in
plain English, let an LLM draft the command and schedule, review it, and CronRunner runs it at
the right time. macOS, Windows and Linux, from one codebase and one self-contained binary.

It does **not** touch your system crontab. CronRunner ships its own scheduler so the same job
definition behaves identically everywhere, including Windows, which has no cron.

## What it does

- **Describe a job in plain English.** "Back up ~/Documents to ~/Backups every night at 2am"
  becomes a real command and cron expression you review before saving, with warnings for
  anything destructive.
- **See everything at a glance.** Every job shows its schedule in English, when it next runs,
  and how the last run went.
- **Watch runs happen.** stdout and stderr stream live while a job runs, and every run keeps
  its output, exit code and duration.
- **Fix failures.** Ask the AI why a run failed and apply the suggested command.
- **Stay in control.** Enable, disable, run now, kill, set timeouts, working directories,
  environment variables and per-job timezones.

Your jobs, run history and API key never leave the machine. The only outbound traffic is your
own calls to OpenAI or Anthropic.

## Install

Download the binary for your platform, or build it yourself (below), then run it:

```bash
./cronrunner --open      # starts the daemon and opens the UI
```

It listens on <http://127.0.0.1:4747> and stores its data in:

| Platform | Location |
| --- | --- |
| macOS | `~/Library/Application Support/CronRunner` |
| Windows | `%APPDATA%\CronRunner` |
| Linux | `$XDG_DATA_HOME/cronrunner` or `~/.local/share/cronrunner` |

Jobs only run while CronRunner is running. Turn on **Start at login** in Settings so it comes
back after a reboot (a launch agent on macOS, a systemd user service on Linux, a logon task on
Windows).

To use the AI features, add an OpenAI or Anthropic API key in Settings. Everything else works
without one.

## Build from source

Requires [Bun](https://bun.sh) 1.3 or newer.

```bash
bun install
bun run compile      # -> apps/server/dist/cronrunner, self-contained
bun run release      # -> all four platform binaries
```

## Development

```bash
bun run dev:server   # API on http://127.0.0.1:4747
bun run dev:web      # UI on http://localhost:5173, proxies /api
bun run typecheck && bun test && bun run lint
```

Set `CRONRUNNER_DATA_DIR=./.cronrunner` while developing to keep your real data untouched. The
test suite isolates itself automatically.

## Stack

Bun · TypeScript · Hono · croner · bun:sqlite · React 19 · Vite · Tailwind 4 · TanStack Query ·
zod · @anthropic-ai/sdk · openai

## Docs

- `docs/PRD.md` — what and why
- `docs/ARCHITECTURE.md` — how it fits together, security model, packaging
- `docs/DESIGN.md` — UI system and page specs
- `docs/API.md` — HTTP endpoints
- `docs/PLAN.md` — the build plan, with what each phase verified

## Security

The daemon runs shell commands as you, so it is deliberately reachable only from this machine:
it binds to 127.0.0.1 and rejects any API request whose `Origin` is not a loopback host, which
blocks the cross-site attack a localhost daemon is otherwise open to. Commands drafted by the
LLM are always shown for review and are never executed without you saving the job.
