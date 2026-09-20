/**
 * /api/runs
 *   GET  /            recent runs across all jobs (dashboard activity feed)
 *   GET  /:id         full run incl. stdout/stderr
 *   POST /:id/kill    terminate a running run
 */
import { Hono } from "hono";
import * as db from "../db/db";
import { getLiveOutput, killRun } from "../scheduler/executor";
import { HttpError } from "./util";

export const runsRoute = new Hono();

runsRoute.get("/", (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  return c.json(db.listRecentRuns(limit));
});

runsRoute.get("/:id", (c) => {
  const run = db.getRun(c.req.param("id"));
  if (!run) throw new HttpError(404, "not_found", "Run not found");
  // A run in flight has written nothing to the database yet, so serve the live buffer and
  // tell the client which chunk it reflects (see Run.outputSeq).
  const live = run.status === "running" ? getLiveOutput(run.id) : null;
  if (live) {
    return c.json({ ...run, stdout: live.stdout, stderr: live.stderr, outputSeq: live.seq });
  }
  return c.json(run);
});

runsRoute.post("/:id/kill", (c) => {
  if (!killRun(c.req.param("id")))
    throw new HttpError(404, "not_running", "No active process for this run");
  return c.json({ ok: true });
});
