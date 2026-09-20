# HTTP API

Base URL `http://127.0.0.1:4747/api`. JSON in/out. All shapes are defined in `packages/shared/src/schemas.ts`. Errors: `{ "error": { "code", "message", "details?" } }` with 4xx/5xx.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /health | | `{ok:true}` |
| GET | /system | | SystemInfo (incl. `missedRuns`, `autostart`) |
| GET | /system/autostart | | `{supported, enabled, reason?, location?}` |
| POST | /system/autostart | | enable start at login |
| DELETE | /system/autostart | | disable start at login |
| GET | /jobs | | JobWithStatus[] |
| POST | /jobs | CreateJobInput | JobWithStatus (201) |
| POST | /jobs/validate-schedule | `{schedule, timezone}` | `{valid, error?, human, next[]}` |
| GET | /jobs/:id | | JobWithStatus |
| PATCH | /jobs/:id | UpdateJobInput | JobWithStatus |
| DELETE | /jobs/:id | | 204 |
| POST | /jobs/:id/enable · /disable | | JobWithStatus |
| POST | /jobs/:id/run | | `{ok:true}` (202) · 409 if already running |
| GET | /jobs/:id/runs?limit&offset | | RunSummary[] |
| GET | /runs?limit | | RunSummary[] (all jobs, newest first) |
| GET | /runs/:id | | Run (with stdout/stderr) |
| POST | /runs/:id/kill | | `{ok:true}` · 404 if not running |
| GET | /settings | | SettingsResponse |
| PATCH | /settings | UpdateSettingsInput | SettingsResponse |
| POST | /settings/test-llm | `{provider, apiKey?, model?}` | `{ok:true}` · 400 with message |
| POST | /ai/generate-job | AiGenerateJobInput | AiJobDraft · 400 `llm_not_configured` |
| POST | /ai/explain-cron | `{schedule}` | `{text}` |
| POST | /ai/diagnose-run | `{runId}` | AiDiagnoseRunResponse |
| GET | /events | | SSE stream of ServerEvent, event name = `type` |

Error codes used: `invalid_json`, `validation_error`, `invalid_schedule`, `not_found`, `already_running`, `not_running`, `llm_not_configured`, `llm_test_failed`, `llm_error` (502, provider failure with a message safe to show a user), `autostart_failed`, `forbidden_origin` (403, see below), `internal_error`.

## Who may call this API

The daemon listens on 127.0.0.1 only. On top of that, every `/api` request carrying an
`Origin` header from anywhere other than this machine is rejected with 403 `forbidden_origin`.
That closes the cross-site request attack a localhost daemon is otherwise open to: a page on
the public internet can issue a no-preflight POST to `127.0.0.1:4747` and, without this check,
create a job that runs an arbitrary shell command. Requests with no `Origin` at all (curl,
scripts) are allowed — anything able to run curl can already run commands directly. See
`apps/server/src/routes/guard.ts`.
