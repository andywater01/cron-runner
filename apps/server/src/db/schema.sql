-- CronRunner SQLite schema. Applied idempotently on startup by db.ts.
-- Timestamps are ISO-8601 UTC strings. JSON columns hold serialized arrays/objects.

CREATE TABLE IF NOT EXISTS jobs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  schedule        TEXT NOT NULL,
  timezone        TEXT,
  command         TEXT NOT NULL,
  cwd             TEXT,
  shell           TEXT NOT NULL DEFAULT 'auto',
  env_json        TEXT NOT NULL DEFAULT '{}',
  timeout_seconds INTEGER,
  enabled         INTEGER NOT NULL DEFAULT 1,
  tags_json       TEXT NOT NULL DEFAULT '[]',
  source          TEXT NOT NULL DEFAULT 'manual',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id           TEXT PRIMARY KEY,
  job_id       TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  trigger      TEXT NOT NULL,
  status       TEXT NOT NULL,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  exit_code    INTEGER,
  stdout       TEXT NOT NULL DEFAULT '',
  stderr       TEXT NOT NULL DEFAULT '',
  duration_ms  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_runs_job_started ON runs(job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
