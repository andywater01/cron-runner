# UI Design Spec

The goal is a calm, dense-but-airy "developer tool" aesthetic in the spirit of Linear, Vercel, and Raycast. Neutral surfaces, one indigo accent, semantic colors reserved for status. No gradients on functional UI, no decorative illustration. Everything should feel fast.

## 1. Tokens

Defined in `apps/web/src/index.css` via Tailwind 4 `@theme` and CSS variables. Use the utilities, never raw hex in components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg-app` | #f8fafc | #0b0f19 | page background |
| `bg-surface` | #ffffff | #111827 | cards, sidebar, modals |
| `bg-surface-muted` | #f1f5f9 | #1f2937 | table headers, hover, code blocks |
| `border-default` | #e2e8f0 | #253044 | all borders (1px) |
| `text-default` | #0f172a | #f1f5f9 | primary text |
| `text-muted` | #64748b | #94a3b8 | secondary text, labels |
| `accent-500/600` | indigo | indigo | primary buttons, active nav, focus rings, links |
| `success` | #10b981 | same | success status |
| `warning` | #f59e0b | same | timeout, warnings |
| `danger` | #ef4444 | same | failed, destructive |
| `info` | #3b82f6 | same | running |

Typography: Inter for UI, JetBrains Mono for commands, cron expressions, output, IDs. Sizes: page title `text-2xl font-semibold tracking-tight`, section title `text-base font-semibold`, body `text-sm`, meta `text-xs text-muted`.

Radius: cards 12px (`rounded-card`), inputs/buttons 8px (`rounded-lg`), badges full. Shadows: `shadow-card` only on elevated surfaces (cards on the app bg, popovers). Borders do most of the work.

Motion: 150 ms ease-out for hover/press, 200 ms for panels. Respect `prefers-reduced-motion`.

## 2. Primitives (`src/components/ui/`)

Build these first; every page uses them.

- **Button** — variants `primary` (accent bg, white text), `secondary` (surface bg, border), `ghost`, `danger`; sizes `sm`, `md`; `loading` prop shows a spinner and disables; icon-only variant with `aria-label`.
- **Input / Textarea / Select** — 36px tall, surface bg, `border-default`, focus ring `ring-2 ring-accent-500/40`. Textarea for commands uses mono font and `min-h-32`. Error state: danger border + helper text.
- **Switch** — for enable/disable. Accent when on. Animated knob.
- **Badge** — `StatusBadge` maps RunStatus → dot + label + color (success/failed/timeout/killed/running with pulsing dot). Also a neutral `Tag` badge for job tags.
- **Card** — `bg-surface border border-default rounded-card shadow-card`. Optional header row.
- **Table** — sticky header on `bg-surface-muted`, rows `hover:bg-surface-muted/60`, zebra off, dividers on.
- **Dialog / ConfirmDialog** — centered modal with backdrop blur; confirm dialog for delete with the job name repeated. Use native `<dialog>` or headless pattern; trap focus; Esc closes.
- **Toast** — bottom-right, auto-dismiss 4 s, variants success/error. Simple context provider.
- **EmptyState** — icon, title, one-line description, primary action.
- **Kbd** — for shortcut hints.
- **CodeBlock** — mono, `bg-surface-muted`, copy button, wraps long lines optionally.
- **Skeleton** — for loading rows.

## 3. Layout

Fixed 240px left sidebar (`AppShell`, already scaffolded): logo, nav (Dashboard, Jobs, Activity, Settings), footer with scheduler status dot + theme toggle. Content area: `max-w-6xl`, 32px padding, scrolls independently. Below 900px the sidebar collapses to icons (nice-to-have).

Global keyboard: `N` new job, `/` focus search on Jobs page, `Esc` closes dialogs.

## 4. Pages

### 4.1 Dashboard `/`
- Header: "Dashboard", subtitle "hostname · timezone · N jobs enabled".
- Stat row (4 cards): Enabled jobs, Runs in last 24h, Failures in last 24h (danger if >0), Next run (job name + relative time).
- Two columns below: **Upcoming** (next 8 runs across jobs: name, schedule text, relative time) and **Recent activity** (last 10 runs: status badge, job name, relative time, duration; click → run detail).
- Empty state when no jobs: big "Create your first job" with two buttons: "Describe it with AI" and "Create manually".

### 4.2 Jobs `/jobs`
- Header actions: search input (filters name/tags/command), filter chips (All / Enabled / Disabled / Failing), primary button "New job" with a dropdown or split: "With AI" / "Manually".
- Table columns: Switch (enable) · Name (+ tags under it, muted) · Schedule (English, cron in mono on hover/tooltip) · Last run (StatusBadge + relative time) · Next run (relative) · Actions (Run now ▶, ⋯ menu: Edit, Duplicate, Delete).
- Row click → detail. Running jobs show a pulsing info dot on the name.
- Optimistic toggle on the switch; toast on error.

### 4.3 Job editor `/jobs/new`, `/jobs/:id/edit`
Two-panel layout: left form (≈60%), right sticky preview card (≈40%).

**Top tabs on new:** "Describe with AI" | "Manual". Editing an existing job opens Manual with an "Ask AI to change…" button.

**AI tab:** large textarea ("What should happen, and when?"), example chips ("Back up ~/Documents to ~/Backups every night at 2am", "Clear ~/Downloads files older than 30 days every Sunday", "Ping my website every 5 minutes and log failures"). Button "Generate". While generating: skeleton in the preview. Result: form auto-filled (source=ai), a callout under the tabs with the **explanation**, **warnings** (amber list), and **clarifying questions** with a small reply box that calls generate again with `currentDraft` + history. No key configured → callout "Add an OpenAI or Anthropic key in Settings to use this" with link.

**Manual form fields:** Name · Description · Schedule (preset select + cron input in mono; live English text under it via `validate-schedule`; invalid → red helper) · Timezone (searchable select of `Intl.supportedValuesOf("timeZone")`, default "Local (America/…)") · Command (mono textarea) · Working directory · Shell (select) · Timeout (number + "seconds", blank = none) · Env vars (key/value rows, add/remove) · Tags (chip input) · Enabled switch.

**Preview card (right):** "Runs" section: human schedule + next 5 run times (local, with weekday); "Command" CodeBlock; "Runs as" cwd + shell; a "Run once now" secondary action after save. Save button (primary, sticky bottom of form) and Cancel.

### 4.4 Job detail `/jobs/:id`
- Header: name, enabled switch, actions: Run now (primary), Edit, ⋯ (Duplicate, Delete).
- Summary card: English schedule, cron (mono), timezone, next run, cwd, shell, timeout, tags, created/updated.
- Command card: CodeBlock.
- Runs table: status, trigger (schedule/manual), started (relative + absolute tooltip), duration, exit code. Click → **run drawer** (right side panel, 560px): status header, timestamps, "Kill" if running, tabs stdout / stderr (mono, auto-scroll while running, live via SSE `run.output`), and for failed/timeout runs an "Ask AI why this failed" button → shows diagnosis card (summary, likely cause, suggested fix, "Apply suggested command" opens editor pre-filled).

### 4.5 Activity `/activity`
- Cross-job run feed (recent 100), filter by status and job. Same run drawer as detail.

### 4.6 Settings `/settings`
Sections as cards:
- **AI provider**: radio cards for Anthropic / OpenAI; key input (password, "Configured · ends in 1234" state with Replace/Remove); model override input with placeholder showing the default; "Test connection" button with inline result.
- **Execution**: default shell, run retention per job.
- **Appearance**: theme segmented control (System / Light / Dark).
- **Startup**: "Start CronRunner at login" switch (Phase 7).
- **About**: version, platform, data directory (copyable), "Open data folder" is out of scope for browser; just show the path.

## 5. States to handle everywhere
Loading (skeletons, not spinners, for lists), empty, error (inline with retry), and disconnected (sidebar dot turns red and a slim top banner "Can't reach CronRunner daemon. Is it running?" when `/api/system` fails twice).

## 6. Accessibility checklist
Focus visible on every interactive element; labels on all inputs; dialogs trap focus and restore it; status conveyed with text + color, never color alone; contrast ≥ 4.5:1 for text in both themes; tables have proper `<th scope>`.
