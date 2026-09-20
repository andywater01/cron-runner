/**
 * Thin data-access layer over bun:sqlite.
 * Only this module touches SQL. Everything else works with the shared Job/Run types.
 */
import { Database } from "bun:sqlite";
import type {
  CreateJobInput,
  Job,
  Run,
  RunStatus,
  RunSummary,
  RunTrigger,
  UpdateJobInput,
} from "@cronrunner/shared";
import { DB_PATH } from "../config";
import schemaSql from "./schema.sql" with { type: "text" };

let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;
  db = new Database(DB_PATH, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(schemaSql);
  return db;
}

/** For tests: use an in-memory database. */
export function useInMemoryDb(): Database {
  db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(schemaSql);
  return db;
}

// ---------------------------------------------------------------------------
// Row <-> model mapping
// ---------------------------------------------------------------------------

type JobRow = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  timezone: string | null;
  command: string;
  cwd: string | null;
  shell: string;
  env_json: string;
  timeout_seconds: number | null;
  enabled: number;
  tags_json: string;
  source: string;
  created_at: string;
  updated_at: string;
};

type RunRow = {
  id: string;
  job_id: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number | null;
};

function rowToJob(r: JobRow): Job {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    schedule: r.schedule,
    timezone: r.timezone,
    command: r.command,
    cwd: r.cwd,
    shell: r.shell as Job["shell"],
    env: JSON.parse(r.env_json),
    timeoutSeconds: r.timeout_seconds,
    enabled: r.enabled === 1,
    tags: JSON.parse(r.tags_json),
    source: r.source as Job["source"],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToRun(r: RunRow): Run {
  return {
    id: r.id,
    jobId: r.job_id,
    trigger: r.trigger as RunTrigger,
    status: r.status as RunStatus,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    exitCode: r.exit_code,
    stdout: r.stdout,
    stderr: r.stderr,
    durationMs: r.duration_ms,
  };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export function listJobs(): Job[] {
  const rows = getDb().query<JobRow, []>("SELECT * FROM jobs ORDER BY name COLLATE NOCASE").all();
  return rows.map(rowToJob);
}

export function getJob(id: string): Job | null {
  const row = getDb().query<JobRow, [string]>("SELECT * FROM jobs WHERE id = ?").get(id);
  return row ? rowToJob(row) : null;
}

export function insertJob(input: CreateJobInput): Job {
  const now = new Date().toISOString();
  const job: Job = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  getDb()
    .query(
      `INSERT INTO jobs (id, name, description, schedule, timezone, command, cwd, shell, env_json,
        timeout_seconds, enabled, tags_json, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      job.id,
      job.name,
      job.description,
      job.schedule,
      job.timezone,
      job.command,
      job.cwd,
      job.shell,
      JSON.stringify(job.env),
      job.timeoutSeconds,
      job.enabled ? 1 : 0,
      JSON.stringify(job.tags),
      job.source,
      job.createdAt,
      job.updatedAt,
    );
  return job;
}

export function updateJob(id: string, patch: UpdateJobInput): Job | null {
  const existing = getJob(id);
  if (!existing) return null;
  const merged: Job = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  getDb()
    .query(
      `UPDATE jobs SET name=?, description=?, schedule=?, timezone=?, command=?, cwd=?, shell=?, env_json=?,
        timeout_seconds=?, enabled=?, tags_json=?, source=?, updated_at=? WHERE id=?`,
    )
    .run(
      merged.name,
      merged.description,
      merged.schedule,
      merged.timezone,
      merged.command,
      merged.cwd,
      merged.shell,
      JSON.stringify(merged.env),
      merged.timeoutSeconds,
      merged.enabled ? 1 : 0,
      JSON.stringify(merged.tags),
      merged.source,
      merged.updatedAt,
      id,
    );
  return merged;
}

export function deleteJob(id: string): boolean {
  const res = getDb().query("DELETE FROM jobs WHERE id = ?").run(id);
  return res.changes > 0;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export function insertRun(jobId: string, trigger: RunTrigger): Run {
  const run: Run = {
    id: crypto.randomUUID(),
    jobId,
    trigger,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    stdout: "",
    stderr: "",
    durationMs: null,
  };
  getDb()
    .query(`INSERT INTO runs (id, job_id, trigger, status, started_at) VALUES (?, ?, ?, ?, ?)`)
    .run(run.id, run.jobId, run.trigger, run.status, run.startedAt);
  return run;
}

export function finishRun(
  id: string,
  result: {
    status: RunStatus;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    durationMs: number;
  },
): void {
  getDb()
    .query(
      `UPDATE runs SET status=?, finished_at=?, exit_code=?, stdout=?, stderr=?, duration_ms=? WHERE id=?`,
    )
    .run(
      result.status,
      new Date().toISOString(),
      result.exitCode,
      result.stdout,
      result.stderr,
      result.durationMs,
      id,
    );
}

export function getRun(id: string): Run | null {
  const row = getDb().query<RunRow, [string]>("SELECT * FROM runs WHERE id = ?").get(id);
  return row ? rowToRun(row) : null;
}

export function listRunsForJob(jobId: string, limit = 50, offset = 0): RunSummary[] {
  const rows = getDb()
    .query<Omit<RunRow, "stdout" | "stderr">, [string, number, number]>(
      `SELECT id, job_id, trigger, status, started_at, finished_at, exit_code, duration_ms
       FROM runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    )
    .all(jobId, limit, offset);
  return rows.map((r) => {
    const { stdout: _o, stderr: _e, ...summary } = rowToRun({ ...r, stdout: "", stderr: "" });
    return summary;
  });
}

export function listRecentRuns(limit = 50): RunSummary[] {
  const rows = getDb()
    .query<Omit<RunRow, "stdout" | "stderr">, [number]>(
      `SELECT id, job_id, trigger, status, started_at, finished_at, exit_code, duration_ms
       FROM runs ORDER BY started_at DESC LIMIT ?`,
    )
    .all(limit);
  return rows.map((r) => {
    const { stdout: _o, stderr: _e, ...summary } = rowToRun({ ...r, stdout: "", stderr: "" });
    return summary;
  });
}

export function lastRunForJob(jobId: string): RunSummary | null {
  return listRunsForJob(jobId, 1)[0] ?? null;
}

/** Delete all but the newest `keep` runs for a job. */
export function pruneRuns(jobId: string, keep: number): number {
  const res = getDb()
    .query(
      `DELETE FROM runs WHERE job_id = ? AND id NOT IN (
         SELECT id FROM runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?)`,
    )
    .run(jobId, jobId, keep);
  return res.changes;
}

/** On startup, any run still marked "running" was orphaned by a crash. Mark it killed. */
export function markOrphanedRunsKilled(): number {
  const res = getDb()
    .query(`UPDATE runs SET status = 'killed', finished_at = ? WHERE status = 'running'`)
    .run(new Date().toISOString());
  return res.changes;
}
