/**
 * OpenAI implementation, using the Responses API.
 *
 * Structured output is requested with an explicit JSON Schema (see `./jsonSchema.ts`) rather
 * than the SDK's `zodTextFormat` helper, so both providers share one code path. The reply is
 * validated here with the same zod schema that produced the JSON Schema.
 *
 * Model default: see DEFAULT_MODELS.
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
import { toProviderJsonSchema } from "./jsonSchema";
import {
  DIAGNOSE_SYSTEM_PROMPT,
  diagnoseUserMessage,
  EXPLAIN_CRON_SYSTEM_PROMPT,
  JOB_BUILDER_SYSTEM_PROMPT,
  refinementUserMessage,
  systemContext,
} from "./prompts";
import type { LlmClient } from "./provider";

const DRAFT_SCHEMA = toProviderJsonSchema(AiJobDraftSchema);
const DIAGNOSIS_SCHEMA = toProviderJsonSchema(AiDiagnoseRunResponseSchema);

export class OpenAiProvider implements LlmClient {
  private client: OpenAI;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  private async structured(args: {
    instructions: string;
    input: OpenAI.Responses.ResponseInput;
    schema: Record<string, unknown>;
    name: string;
  }): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: args.instructions,
      input: args.input,
      text: {
        format: {
          type: "json_schema",
          name: args.name,
          schema: args.schema,
          strict: true,
        },
      },
    });
    return response.output_text;
  }

  async generateJobDraft(input: AiGenerateJobInput): Promise<AiJobDraft> {
    const messages: OpenAI.Responses.ResponseInput = [
      ...input.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: refinementUserMessage(input) },
    ];
    const text = await this.structured({
      instructions: JOB_BUILDER_SYSTEM_PROMPT + systemContext(),
      input: messages,
      schema: DRAFT_SCHEMA,
      name: "job_draft",
    });
    return AiJobDraftSchema.parse(JSON.parse(text));
  }

  async diagnoseRun(job: Job, run: Run): Promise<AiDiagnoseRunResponse> {
    const text = await this.structured({
      instructions: DIAGNOSE_SYSTEM_PROMPT + systemContext(),
      input: [{ role: "user" as const, content: diagnoseUserMessage(job, run) }],
      schema: DIAGNOSIS_SCHEMA,
      name: "run_diagnosis",
    });
    return AiDiagnoseRunResponseSchema.parse(JSON.parse(text));
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
