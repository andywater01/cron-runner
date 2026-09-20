export const APP_NAME = "CronRunner";
export const DEFAULT_PORT = 4747;
export const API_PREFIX = "/api";

/** Per-stream output cap stored per run (bytes). Older output is truncated with a marker. */
export const MAX_OUTPUT_BYTES_PER_STREAM = 1_000_000;

/** Provider default models. Keep in sync with docs/ARCHITECTURE.md. */
export const DEFAULT_MODELS = {
  anthropic: "claude-opus-5",
  openai: "gpt-5",
} as const;

/** Presets shown in the schedule picker. */
export const SCHEDULE_PRESETS: { label: string; cron: string }[] = [
  { label: "Every minute", cron: "* * * * *" },
  { label: "Every 5 minutes", cron: "*/5 * * * *" },
  { label: "Every 15 minutes", cron: "*/15 * * * *" },
  { label: "Hourly", cron: "0 * * * *" },
  { label: "Daily at midnight", cron: "0 0 * * *" },
  { label: "Daily at 9am", cron: "0 9 * * *" },
  { label: "Weekdays at 9am", cron: "0 9 * * 1-5" },
  { label: "Weekly (Mon 9am)", cron: "0 9 * * 1" },
  { label: "Monthly (1st, midnight)", cron: "0 0 1 * *" },
];
