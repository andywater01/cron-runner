/**
 * Settings persistence. Stored as JSON in DATA_DIR/settings.json with 0600 permissions.
 * API keys live here (never in the database, never returned to the client in full).
 * Env vars OPENAI_API_KEY / ANTHROPIC_API_KEY act as fallbacks when no key is stored.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  type LlmProvider,
  type Settings,
  type SettingsResponse,
  SettingsSchema,
  type UpdateSettingsInput,
} from "@cronrunner/shared";
import { SETTINGS_PATH } from "./config";

type StoredSettings = Settings & { openaiApiKey?: string; anthropicApiKey?: string };

let cache: StoredSettings | null = null;

function load(): StoredSettings {
  if (cache) return cache;
  if (!existsSync(SETTINGS_PATH)) {
    cache = SettingsSchema.parse({ llm: {} });
    return cache;
  }
  const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
  const { openaiApiKey, anthropicApiKey, ...rest } = raw;
  cache = { ...SettingsSchema.parse({ llm: {}, ...rest }), openaiApiKey, anthropicApiKey };
  return cache;
}

function save(s: StoredSettings): void {
  writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), { mode: 0o600 });
  if (process.platform !== "win32") chmodSync(SETTINGS_PATH, 0o600);
  cache = s;
}

export function getSettings(): Settings {
  const { openaiApiKey: _a, anthropicApiKey: _b, ...pub } = load();
  return pub;
}

export function getApiKey(provider: LlmProvider): string | null {
  const s = load();
  if (provider === "openai") return s.openaiApiKey || process.env.OPENAI_API_KEY || null;
  return s.anthropicApiKey || process.env.ANTHROPIC_API_KEY || null;
}

export function getSettingsResponse(): SettingsResponse {
  const openai = getApiKey("openai");
  const anthropic = getApiKey("anthropic");
  return {
    ...getSettings(),
    keys: {
      openai: { configured: !!openai, last4: openai ? openai.slice(-4) : null },
      anthropic: { configured: !!anthropic, last4: anthropic ? anthropic.slice(-4) : null },
    },
  };
}

/**
 * Merge a patch into the stored settings. Keys are handled separately from the rest:
 * omitting one leaves it untouched, an empty string clears it.
 */
export function updateSettings(input: UpdateSettingsInput): SettingsResponse {
  const current = load();
  const { openaiApiKey, anthropicApiKey, ...patch } = input;

  // Validate the public settings on their own; the keys are not part of that schema.
  const merged = SettingsSchema.parse({
    ...current,
    ...patch,
    llm: { ...current.llm, ...(patch.llm ?? {}) },
  });

  const next: StoredSettings = {
    ...merged,
    openaiApiKey: openaiApiKey === undefined ? current.openaiApiKey : openaiApiKey || undefined,
    anthropicApiKey:
      anthropicApiKey === undefined ? current.anthropicApiKey : anthropicApiKey || undefined,
  };

  save(next);
  return getSettingsResponse();
}
