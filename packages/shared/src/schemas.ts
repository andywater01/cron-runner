/**
 * Single source of truth for every data shape that crosses the server/web boundary.
 * The server validates request bodies with these; the web app derives its types from them.
 * Keep this file dependency-free apart from zod.
 */
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const JobIdSchema = z.string().min(1);
export const RunIdSchema = z.string().min(1);

/** Standard 5-field cron (minute hour day-of-month month day-of-week). Optional leading seconds field is allowed (croner supports 6 fields). */
export const CronExpressionSchema = z
  .string()
  .trim()
  .min(9, "Cron expression too short")
  .refine((s) => {
    const parts = s.split(/\s+/);
    return parts.length === 5 || parts.length === 6;
  }, "Cron expression must have 5 (or 6, with seconds) space-separated fields");

export const ShellSchema = z.enum(["auto", "bash", "zsh", "sh", "powershell", "cmd"]);
export type Shell = z.infer<typeof ShellSchema>;

export const RunStatusSchema = z.enum(["running", "success", "failed", "timeout", "killed"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunTriggerSchema = z.enum(["schedule", "manual"]);
export type RunTrigger = z.infer<typeof RunTriggerSchema>;

// ---------------------------------------------------------------------------
// Job
// ---------------------------------------------------------------------------

export const JobSchema = z.object({
  id: JobIdSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  /** 5- or 6-field cron expression. */
  schedule: CronExpressionSchema,
  /** IANA timezone, e.g. "America/New_York". Defaults to the machine's local zone when null. */
  timezone: z.string().nullable().default(null),
  /** The shell command to execute. Multi-line scripts are allowed. */
  command: z.string().min(1).max(20_000),
  /** Working directory. null = user's home directory. */
  cwd: z.string().nullable().default(null),
  shell: ShellSchema.default("auto"),
  /** Extra environment variables merged over the daemon's env. */
  env: z.record(z.string(), z.string()).default({}),
  /** Kill the process after this many seconds. null = no timeout. */
  timeoutSeconds: z.number().int().positive().max(86_400).nullable().default(null),
  enabled: z.boolean().default(true),
  /** Free-form labels for filtering in the UI. */
  tags: z.array(z.string().min(1).max(40)).default([]),
  /** Optional: how the job was created. Purely informational. */
  source: z.enum(["manual", "ai"]).default("manual"),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Job = z.infer<typeof JobSchema>;

/** Fields a client may send when creating a job. */
export const CreateJobInputSchema = JobSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;

/** Every field optional on update. */
export const UpdateJobInputSchema = CreateJobInputSchema.partial();
export type UpdateJobInput = z.infer<typeof UpdateJobInputSchema>;

/** A job plus derived runtime info the list/detail views need. */
export const JobWithStatusSchema = JobSchema.extend({
  nextRunAt: z.iso.datetime().nullable(),
  lastRun: z
    .object({
      id: RunIdSchema,
      status: RunStatusSchema,
      startedAt: z.iso.datetime(),
      finishedAt: z.iso.datetime().nullable(),
      exitCode: z.number().int().nullable(),
    })
    .nullable(),
  /** Human readable schedule, e.g. "At 02:00, every day". */
  scheduleHuman: z.string(),
  isRunning: z.boolean(),
});
export type JobWithStatus = z.infer<typeof JobWithStatusSchema>;

// ---------------------------------------------------------------------------
// Run (execution record)
// ---------------------------------------------------------------------------

export const RunSchema = z.object({
  id: RunIdSchema,
  jobId: JobIdSchema,
  trigger: RunTriggerSchema,
  status: RunStatusSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  exitCode: z.number().int().nullable(),
  /** Combined, capped output. See PRD for the cap (default 1 MB per stream). */
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number().int().nonnegative().nullable(),
  /**
   * Only present while a run is still going: the sequence number of the last output chunk
   * included in `stdout`/`stderr` above. A client that is also receiving `run.output` events
   * uses it to append only the chunks newer than this snapshot, with no gap and no duplicates.
   */
  outputSeq: z.number().int().nonnegative().optional(),
});
export type Run = z.infer<typeof RunSchema>;

/** Run without the potentially large stdout/stderr, for list views. */
export const RunSummarySchema = RunSchema.omit({ stdout: true, stderr: true });
export type RunSummary = z.infer<typeof RunSummarySchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const LlmProviderSchema = z.enum(["openai", "anthropic"]);
export type LlmProvider = z.infer<typeof LlmProviderSchema>;

export const SettingsSchema = z.object({
  llm: z.object({
    provider: LlmProviderSchema.default("anthropic"),
    /** Model override. null = provider default (see apps/server/src/llm/providers.ts). */
    model: z.string().nullable().default(null),
  }),
  /** Maximum runs kept per job before the oldest are pruned. */
  runRetentionPerJob: z.number().int().min(10).max(10_000).default(200),
  /** Default shell for new jobs. */
  defaultShell: ShellSchema.default("auto"),
  /** UI theme preference. */
  theme: z.enum(["system", "light", "dark"]).default("system"),
});
export type Settings = z.infer<typeof SettingsSchema>;

/** What the API returns: settings + whether each key is configured (never the key itself). */
export const SettingsResponseSchema = SettingsSchema.extend({
  keys: z.object({
    openai: z.object({ configured: z.boolean(), last4: z.string().nullable() }),
    anthropic: z.object({ configured: z.boolean(), last4: z.string().nullable() }),
  }),
});
export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

export const UpdateSettingsInputSchema = z.object({
  llm: z.object({ provider: LlmProviderSchema, model: z.string().nullable() }).partial().optional(),
  runRetentionPerJob: z.number().int().min(10).max(10_000).optional(),
  defaultShell: ShellSchema.optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
  /** Provide a key to set it; empty string clears it; omit to leave unchanged. */
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
});
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

// ---------------------------------------------------------------------------
// AI (LLM-assisted job creation)
// ---------------------------------------------------------------------------

/** What the LLM must return. Identical shape is used for OpenAI and Anthropic structured output. */
export const AiJobDraftSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000),
  schedule: CronExpressionSchema,
  timezone: z.string().nullable(),
  command: z.string().min(1),
  cwd: z.string().nullable(),
  shell: ShellSchema,
  timeoutSeconds: z.number().int().positive().nullable(),
  tags: z.array(z.string()),
  /** Plain-English explanation of what the command does and when it runs. Shown to the user. */
  explanation: z.string(),
  /** Anything the user should double check: destructive operations, assumptions, required tools. */
  warnings: z.array(z.string()),
  /** Questions the model would need answered to be confident. Empty when confident. */
  clarifyingQuestions: z.array(z.string()),
});
export type AiJobDraft = z.infer<typeof AiJobDraftSchema>;

export const AiGenerateJobInputSchema = z.object({
  prompt: z.string().min(3).max(4000),
  /** When refining an existing draft, send it back so the model edits instead of starting over. */
  currentDraft: AiJobDraftSchema.partial().nullable().default(null),
  /** Conversation so far (for multi-turn refinement). */
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .default([]),
});
export type AiGenerateJobInput = z.infer<typeof AiGenerateJobInputSchema>;

export const AiExplainCronInputSchema = z.object({ schedule: CronExpressionSchema });
export const AiDiagnoseRunInputSchema = z.object({ runId: RunIdSchema });
export const AiDiagnoseRunResponseSchema = z.object({
  summary: z.string(),
  likelyCause: z.string(),
  suggestedFix: z.string(),
  suggestedCommand: z.string().nullable(),
});
export type AiDiagnoseRunResponse = z.infer<typeof AiDiagnoseRunResponseSchema>;

// ---------------------------------------------------------------------------
// System / misc
// ---------------------------------------------------------------------------

export const SystemInfoSchema = z.object({
  version: z.string(),
  platform: z.enum(["darwin", "win32", "linux"]),
  hostname: z.string(),
  timezone: z.string(),
  dataDir: z.string(),
  uptimeSeconds: z.number(),
  schedulerRunning: z.boolean(),
  jobCount: z.number().int(),
  enabledJobCount: z.number().int(),
});
export type SystemInfo = z.infer<typeof SystemInfoSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Server-sent events pushed to the UI over /api/events. */
export const ServerEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run.started"), jobId: JobIdSchema, runId: RunIdSchema }),
  z.object({
    type: z.literal("run.finished"),
    jobId: JobIdSchema,
    runId: RunIdSchema,
    status: RunStatusSchema,
  }),
  z.object({
    type: z.literal("run.output"),
    runId: RunIdSchema,
    stream: z.enum(["stdout", "stderr"]),
    chunk: z.string(),
    /** Monotonic per run, starting at 1. See `Run.outputSeq`. */
    seq: z.number().int().positive(),
  }),
  z.object({ type: z.literal("job.changed"), jobId: JobIdSchema }),
  z.object({ type: z.literal("job.deleted"), jobId: JobIdSchema }),
  z.object({ type: z.literal("scheduler.tick"), at: z.iso.datetime() }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;
