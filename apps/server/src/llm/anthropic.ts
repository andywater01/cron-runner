/**
 * Anthropic implementation.
 *
 * Structured output is requested with an explicit JSON Schema (see `./jsonSchema.ts`) rather
 * than the SDK's `zodOutputFormat` helper, so both providers share one code path. The reply is
 * validated here with the same zod schema that produced the JSON Schema.
 *
 * Model default: `claude-opus-5` (see DEFAULT_MODELS). Model ids carry no date suffix.
 * Thinking is adaptive by default on this model, so no `thinking` parameter is sent.
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  AiDiagnoseRunResponse,
  AiGenerateJobInput,
  AiJobDraft,
  Job,
  Run,
} from "@cronrunner/shared";
import { AiDiagnoseRunResponseSchema, AiJobDraftSchema } from "@cronrunner/shared";
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

export class AnthropicProvider implements LlmClient {
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
    baseURL?: string,
  ) {
    this.client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }

  /** Collect the plain text of a response. */
  private static text(message: Anthropic.Message): string {
    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  }

  /** Ask for JSON matching `schema` and return the raw text. */
  private async structured(args: {
    system: string;
    messages: Anthropic.MessageParam[];
    schema: Record<string, unknown>;
  }): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      system: args.system,
      messages: args.messages,
      // Anthropic's json_schema format takes the schema only; it has no name field.
      output_config: { format: { type: "json_schema", schema: args.schema } },
    });
    if (response.stop_reason === "refusal") {
      throw new Error("The model declined to answer this request.");
    }
    return AnthropicProvider.text(response);
  }

  async generateJobDraft(input: AiGenerateJobInput): Promise<AiJobDraft> {
    const messages: Anthropic.MessageParam[] = [
      ...input.history.map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
      { role: "user", content: refinementUserMessage(input) },
    ];
    const text = await this.structured({
      system: JOB_BUILDER_SYSTEM_PROMPT + systemContext(),
      messages,
      schema: DRAFT_SCHEMA,
    });
    return AiJobDraftSchema.parse(JSON.parse(text));
  }

  async diagnoseRun(job: Job, run: Run): Promise<AiDiagnoseRunResponse> {
    const text = await this.structured({
      system: DIAGNOSE_SYSTEM_PROMPT + systemContext(),
      messages: [{ role: "user", content: diagnoseUserMessage(job, run) }],
      schema: DIAGNOSIS_SCHEMA,
    });
    return AiDiagnoseRunResponseSchema.parse(JSON.parse(text));
  }

  async explainCron(schedule: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: EXPLAIN_CRON_SYSTEM_PROMPT + systemContext(),
      messages: [{ role: "user", content: schedule }],
    });
    return AnthropicProvider.text(response);
  }

  async testConnection(): Promise<void> {
    await this.client.messages.create({
      model: this.model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with OK." }],
    });
  }
}
