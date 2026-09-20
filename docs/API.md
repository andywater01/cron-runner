# HTTP API

Base URL `http://127.0.0.1:4747/api`. JSON in/out. All shapes are defined in `packages/shared/src/schemas.ts`. Errors: `{ "error": { "code", "message", "details?" } }` with 4xx/5xx.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /health | | `{ok:true}` |
| GET | /system | | SystemInfo |
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

Error codes used: `invalid_json`, `validation_error`, `invalid_schedule`, `not_found`, `already_running`, `not_running`, `llm_not_configured`, `llm_test_failed`, `internal_error`.
