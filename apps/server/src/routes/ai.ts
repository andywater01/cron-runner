/**
 * /api/ai
 *   POST /generate-job   AiGenerateJobInput -> AiJobDraft
 *   POST /explain-cron   { schedule } -> { text }
 *   POST /diagnose-run   { runId } -> AiDiagnoseRunResponse
 *
 * All endpoints return 400 { error.code: "llm_not_configured" } when no key is set.
 */

import {
  AiDiagnoseRunInputSchema,
  AiExplainCronInputSchema,
  AiGenerateJobInputSchema,
} from "@cronrunner/shared";
import { Hono } from "hono";
import * as db from "../db/db";
import { getLlmClient, LlmNotConfiguredError } from "../llm/provider";
import { HttpError, parseBody } from "./util";

export const aiRoute = new Hono();

function client() {
  try {
    return getLlmClient();
  } catch (err) {
    if (err instanceof LlmNotConfiguredError)
      throw new HttpError(400, "llm_not_configured", err.message);
    throw err;
  }
}

aiRoute.post("/generate-job", async (c) => {
  const input = await parseBody(c, AiGenerateJobInputSchema);
  return c.json(await client().generateJobDraft(input));
});

aiRoute.post("/explain-cron", async (c) => {
  const { schedule } = await parseBody(c, AiExplainCronInputSchema);
  return c.json({ text: await client().explainCron(schedule) });
});

aiRoute.post("/diagnose-run", async (c) => {
  const { runId } = await parseBody(c, AiDiagnoseRunInputSchema);
  const run = db.getRun(runId);
  if (!run) throw new HttpError(404, "not_found", "Run not found");
  const job = db.getJob(run.jobId);
  if (!job) throw new HttpError(404, "not_found", "Job not found");
  return c.json(await client().diagnoseRun(job, run));
});
