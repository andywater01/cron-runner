/**
 * OpenAI implementation using the official SDK with structured outputs (zod).
 *
 * Uses the Responses API with `zodTextFormat` for JSON that matches AiJobDraftSchema.
 * Default model: see DEFAULT_MODELS in @cronrunner/shared.
 *
 * TODO(plan §5.2): verify against the installed openai package version; the helper import path is
 * `openai/helpers/zod` and the parse method is `client.responses.parse`. Map errors to friendly messages.
 */

import type {
  AiDiagnoseRunResponse,
  AiGenerateJobInput,
  AiJobDraft,
  Job,
  Run,
} from "@cronrunner/shared";
import { AiDiagnoseRunResponseSchema, AiJobDraftSchema } from "@cronrunner/shared";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  DIAGNOSE_SYSTEM_PROMPT,
  EXPLAIN_CRON_SYSTEM_PROMPT,
  JOB_BUILDER_SYSTEM_PROMPT,
  systemContext,
} from "./prompts";
import type { LlmClient } from "./provider";

export class OpenAiProvider implements LlmClient {
  private client: OpenAI;
  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async generateJobDraft(input: AiGenerateJobInput): Promise<AiJobDraft> {
    const userText = input.currentDraft
      ? `Current draft (edit this rather than starting over):\n${JSON.stringify(input.currentDraft, null, 2)}\n\nRequested change: ${input.prompt}`
      : input.prompt;

    const response = await this.client.responses.parse({
      model: this.model,
      instructions: JOB_BUILDER_SYSTEM_PROMPT + systemContext(),
      input: [
        ...input.history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userText },
      ],
      text: { format: zodTextFormat(AiJobDraftSchema, "job_draft") },
    });
    if (!response.output_parsed) throw new Error("Model returned no structured output");
    return response.output_parsed;
  }

  async diagnoseRun(job: Job, run: Run): Promise<AiDiagnoseRunResponse> {
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: DIAGNOSE_SYSTEM_PROMPT + systemContext(),
      input: [
        `Job: ${job.name}`,
        `Shell: ${job.shell}  cwd: ${job.cwd ?? "(home)"}`,
        `Command:\n${job.command}`,
        `Exit code: ${run.exitCode}  status: ${run.status}`,
        `--- stdout (tail) ---\n${run.stdout.slice(-8000)}`,
        `--- stderr (tail) ---\n${run.stderr.slice(-8000)}`,
      ].join("\n\n"),
      text: { format: zodTextFormat(AiDiagnoseRunResponseSchema, "diagnosis") },
    });
    if (!response.output_parsed) throw new Error("Model returned no structured output");
    return response.output_parsed;
  }

  async explainCron(schedule: string): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: EXPLAIN_CRON_SYSTEM_PROMPT + systemContext(),
      input: schedule,
    });
    return response.output_text;
  }

  async testConnection(): Promise<void> {
    await this.client.responses.create({
      model: this.model,
      input: "Reply with OK.",
      max_output_tokens: 16,
    });
  }
}
