/**
 * Anthropic implementation using the official SDK with structured outputs (zod).
 *
 * Reference: https://docs.claude.com/en/docs/build-with-claude/structured-outputs
 * - `client.messages.parse` + `zodOutputFormat` returns `parsed_output` typed by the zod schema.
 * - Thinking is adaptive by default on claude-opus-5; no `thinking` param is needed.
 * - Default model: claude-opus-5 (see DEFAULT_MODELS). Do NOT append date suffixes to model ids.
 *
 * TODO(plan §5.2): finish diagnoseRun / explainCron / testConnection, add friendly error mapping
 * (401 -> "Invalid API key", 429 -> "Rate limited, try again", network -> "Cannot reach api.anthropic.com").
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type {
  AiDiagnoseRunResponse,
  AiGenerateJobInput,
  AiJobDraft,
  Job,
  Run,
} from "@cronrunner/shared";
import { AiDiagnoseRunResponseSchema, AiJobDraftSchema } from "@cronrunner/shared";
import {
  DIAGNOSE_SYSTEM_PROMPT,
  EXPLAIN_CRON_SYSTEM_PROMPT,
  JOB_BUILDER_SYSTEM_PROMPT,
  systemContext,
} from "./prompts";
import type { LlmClient } from "./provider";

export class AnthropicProvider implements LlmClient {
  private client: Anthropic;
  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generateJobDraft(input: AiGenerateJobInput): Promise<AiJobDraft> {
    const messages: Anthropic.MessageParam[] = [
      ...input.history.map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
    ];
    const userText = input.currentDraft
      ? `Current draft (edit this rather than starting over):\n${JSON.stringify(input.currentDraft, null, 2)}\n\nRequested change: ${input.prompt}`
      : input.prompt;
    messages.push({ role: "user", content: userText });

    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 4096,
      system: JOB_BUILDER_SYSTEM_PROMPT + systemContext(),
      messages,
      output_config: { format: zodOutputFormat(AiJobDraftSchema) },
    });
    if (!response.parsed_output) {
      throw new Error(`Model returned no structured output (stop_reason: ${response.stop_reason})`);
    }
    return response.parsed_output;
  }

  async diagnoseRun(job: Job, run: Run): Promise<AiDiagnoseRunResponse> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 4096,
      system: DIAGNOSE_SYSTEM_PROMPT + systemContext(),
      messages: [
        {
          role: "user",
          content: [
            `Job: ${job.name}`,
            `Shell: ${job.shell}  cwd: ${job.cwd ?? "(home)"}`,
            `Command:\n${job.command}`,
            `Exit code: ${run.exitCode}  status: ${run.status}`,
            `--- stdout (tail) ---\n${run.stdout.slice(-8000)}`,
            `--- stderr (tail) ---\n${run.stderr.slice(-8000)}`,
          ].join("\n\n"),
        },
      ],
      output_config: { format: zodOutputFormat(AiDiagnoseRunResponseSchema) },
    });
    if (!response.parsed_output) throw new Error("Model returned no structured output");
    return response.parsed_output;
  }

  async explainCron(schedule: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: EXPLAIN_CRON_SYSTEM_PROMPT + systemContext(),
      messages: [{ role: "user", content: schedule }],
    });
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }

  async testConnection(): Promise<void> {
    await this.client.messages.create({
      model: this.model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with OK." }],
    });
  }
}
