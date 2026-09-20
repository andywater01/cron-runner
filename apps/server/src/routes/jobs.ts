/**
 * /api/jobs
 *   GET    /            list jobs with status
 *   POST   /            create
 *   GET    /:id         get one with status
 *   PATCH  /:id         update (partial)
 *   DELETE /:id         delete (cascades runs)
 *   POST   /:id/enable  POST /:id/disable
 *   POST   /:id/run     trigger a manual run now (returns the Run id immediately)
 *   GET    /:id/runs    paginated run summaries
 *   POST   /validate-schedule   { schedule, timezone } -> { valid, error?, human, next: string[] }
 */

import type { Job, JobWithStatus } from "@cronrunner/shared";
import { CreateJobInputSchema, UpdateJobInputSchema } from "@cronrunner/shared";
import { Hono } from "hono";
import { z } from "zod/v4";
import * as db from "../db/db";
import { publish } from "../events";
import { executeJob, isJobRunning } from "../scheduler/executor";
import * as scheduler from "../scheduler/scheduler";
import { HttpError, parseBody } from "./util";

export const jobsRoute = new Hono();

export function withStatus(job: Job): JobWithStatus {
  return {
    ...job,
    nextRunAt: job.enabled ? scheduler.nextRunAt(job) : null,
    lastRun: db.lastRunForJob(job.id),
    scheduleHuman: scheduler.describeSchedule(job.schedule),
    isRunning: isJobRunning(job.id),
  };
}

jobsRoute.get("/", (c) => c.json(db.listJobs().map(withStatus)));

jobsRoute.post("/validate-schedule", async (c) => {
  const { schedule, timezone } = await parseBody(
    c,
    z.object({ schedule: z.string(), timezone: z.string().nullable().default(null) }),
  );
  const v = scheduler.validateSchedule(schedule);
  if (!v.valid) return c.json({ valid: false, error: v.error, human: null, next: [] });
  return c.json({
    valid: true,
    human: scheduler.describeSchedule(schedule),
    next: scheduler.previewRuns(schedule, timezone, 5),
  });
});

jobsRoute.post("/", async (c) => {
  const input = await parseBody(c, CreateJobInputSchema);
  const v = scheduler.validateSchedule(input.schedule);
  if (!v.valid) throw new HttpError(400, "invalid_schedule", v.error ?? "Invalid schedule");
  const job = db.insertJob(input);
  scheduler.schedule(job);
  publish({ type: "job.changed", jobId: job.id });
  return c.json(withStatus(job), 201);
});

jobsRoute.get("/:id", (c) => {
  const job = db.getJob(c.req.param("id"));
  if (!job) throw new HttpError(404, "not_found", "Job not found");
  return c.json(withStatus(job));
});

jobsRoute.patch("/:id", async (c) => {
  const patch = await parseBody(c, UpdateJobInputSchema);
  if (patch.schedule) {
    const v = scheduler.validateSchedule(patch.schedule);
    if (!v.valid) throw new HttpError(400, "invalid_schedule", v.error ?? "Invalid schedule");
  }
  const job = db.updateJob(c.req.param("id"), patch);
  if (!job) throw new HttpError(404, "not_found", "Job not found");
  scheduler.schedule(job);
  publish({ type: "job.changed", jobId: job.id });
  return c.json(withStatus(job));
});

jobsRoute.delete("/:id", (c) => {
  const id = c.req.param("id");
  scheduler.unschedule(id);
  if (!db.deleteJob(id)) throw new HttpError(404, "not_found", "Job not found");
  publish({ type: "job.deleted", jobId: id });
  return c.body(null, 204);
});

for (const action of ["enable", "disable"] as const) {
  jobsRoute.post(`/:id/${action}`, (c) => {
    const job = db.updateJob(c.req.param("id"), { enabled: action === "enable" });
    if (!job) throw new HttpError(404, "not_found", "Job not found");
    scheduler.schedule(job);
    publish({ type: "job.changed", jobId: job.id });
    return c.json(withStatus(job));
  });
}

jobsRoute.post("/:id/run", (c) => {
  const job = db.getJob(c.req.param("id"));
  if (!job) throw new HttpError(404, "not_found", "Job not found");
  if (isJobRunning(job.id)) throw new HttpError(409, "already_running", "Job is already running");
  // Fire and forget; the client follows progress via SSE or by polling the run.
  const started = executeJob(job, "manual");
  started.catch((err) => console.error("[run] manual execution failed", err));
  return c.json({ ok: true }, 202);
});

jobsRoute.get("/:id/runs", (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const offset = Number(c.req.query("offset") ?? 0);
  return c.json(db.listRunsForJob(c.req.param("id"), limit, offset));
});
