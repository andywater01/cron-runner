/**
 * Provider abstraction. Both implementations must return AiJobDraft-shaped JSON validated by zod.
 *
 * Model defaults live in @cronrunner/shared DEFAULT_MODELS.
 * The user can override the model string in Settings.
 */
import type {
  AiDiagnoseRunResponse,
  AiGenerateJobInput,
  AiJobDraft,
  Job,
  LlmProvider,
  Run,
} from "@cronrunner/shared";
import { DEFAULT_MODELS } from "@cronrunner/shared";
import { getApiKey, getSettings } from "../settings";
import { AnthropicProvider } from "./anthropic";
import { OpenAiProvider } from "./openai";

export interface LlmClient {
  generateJobDraft(input: AiGenerateJobInput): Promise<AiJobDraft>;
  diagnoseRun(job: Job, run: Run): Promise<AiDiagnoseRunResponse>;
  explainCron(schedule: string): Promise<string>;
  /** Cheap request to verify the key works. Throws with a friendly message on failure. */
  testConnection(): Promise<void>;
}

export class LlmNotConfiguredError extends Error {
  constructor(provider: LlmProvider) {
    super(`No API key configured for ${provider}. Add one in Settings.`);
    this.name = "LlmNotConfiguredError";
  }
}

export function getLlmClient(override?: {
  provider?: LlmProvider;
  apiKey?: string;
  model?: string;
}): LlmClient {
  const settings = getSettings();
  const provider = override?.provider ?? settings.llm.provider;
  const apiKey = override?.apiKey ?? getApiKey(provider);
  if (!apiKey) throw new LlmNotConfiguredError(provider);
  const model = override?.model ?? settings.llm.model ?? DEFAULT_MODELS[provider];
  return provider === "anthropic"
    ? new AnthropicProvider(apiKey, model)
    : new OpenAiProvider(apiKey, model);
}
