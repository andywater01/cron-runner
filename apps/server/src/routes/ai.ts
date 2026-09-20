/**
 * /api/ai
 *   POST /generate-job   AiGenerateJobInput -> AiJobDraft
 *   POST /explain-cron   { schedule } -> { text }
 *   POST /diagnose-run   { runId } -> AiDiagnoseRunResponse
 *
 * No key configured -> 400 `llm_not_configured`.
 * Provider failure   -> 502 `llm_error` with a message safe to show the user.
 */

import {
  AiDiagnoseRunInputSchema,
  AiExplainCronInputSchema,
  AiGenerateJobInputSchema,
} from "@cronrunner/shared";
import { Hono } from "hono";
import * as db from "../db/db";
import { friendlyLlmError } from "../llm/errors";
import type { LlmClient } from "../llm/provider";
import { getLlmClient, LlmNotConfiguredError } from "../llm/provider";
import { getSettings } from "../settings";
import { HttpError, parseBody } from "./util";

export const aiRoute = new Hono();

/** Build the client, turning a missing key into a 400 the UI knows how to handle. */
function client(): LlmClient {
  try {
    return getLlmClient();
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      throw new HttpError(400, "llm_not_configured", err.message);
    }
    throw err;
  }
}

/** Run an LLM call, converting provider errors into a readable 502. */
async function callLlm<T>(fn: (llm: LlmClient) => Promise<T>): Promise<T> {
  const llm = client();
  try {
    return await fn(llm);
  } catch (err) {
    throw new HttpError(502, "llm_error", friendlyLlmError(getSettings().llm.provider, err));
  }
}

aiRoute.post("/generate-job", async (c) => {
  const input = await parseBody(c, AiGenerateJobInputSchema);
  return c.json(await callLlm((llm) => llm.generateJobDraft(input)));
});

aiRoute.post("/explain-cron", async (c) => {
  const { schedule } = await parseBody(c, AiExplainCronInputSchema);
  return c.json({ text: await callLlm((llm) => llm.explainCron(schedule)) });
});

aiRoute.post("/diagnose-run", async (c) => {
  const { runId } = await parseBody(c, AiDiagnoseRunInputSchema);
  const run = db.getRun(runId);
  if (!run) throw new HttpError(404, "not_found", "Run not found");
  const job = db.getJob(run.jobId);
  if (!job) throw new HttpError(404, "not_found", "Job not found");
  return c.json(await callLlm((llm) => llm.diagnoseRun(job, run)));
});
