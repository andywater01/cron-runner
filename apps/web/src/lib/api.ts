/**
 * Typed fetch wrapper for the CronRunner API. All response shapes come from @cronrunner/shared.
 */
import type {
  AiDiagnoseRunResponse,
  AiGenerateJobInput,
  AiJobDraft,
  ApiError,
  CreateJobInput,
  JobWithStatus,
  Run,
  RunSummary,
  SettingsResponse,
  SystemInfo,
  UpdateJobInput,
  UpdateSettingsInput,
} from "@cronrunner/shared";
import { API_PREFIX } from "@cronrunner/shared";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiError | null)?.error;
    throw new ApiRequestError(
      res.status,
      err?.code ?? "unknown",
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return body as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  system: () => request<SystemInfo>("/system"),

  autostart: {
    get: () => request<SystemInfo["autostart"]>("/system/autostart"),
    enable: () => request<SystemInfo["autostart"]>("/system/autostart", { method: "POST" }),
    disable: () => request<SystemInfo["autostart"]>("/system/autostart", { method: "DELETE" }),
  },

  jobs: {
    list: () => request<JobWithStatus[]>("/jobs"),
    get: (id: string) => request<JobWithStatus>(`/jobs/${id}`),
    create: (input: CreateJobInput) =>
      request<JobWithStatus>("/jobs", { method: "POST", body: json(input) }),
    update: (id: string, patch: UpdateJobInput) =>
      request<JobWithStatus>(`/jobs/${id}`, { method: "PATCH", body: json(patch) }),
    remove: (id: string) => request<void>(`/jobs/${id}`, { method: "DELETE" }),
    enable: (id: string) => request<JobWithStatus>(`/jobs/${id}/enable`, { method: "POST" }),
    disable: (id: string) => request<JobWithStatus>(`/jobs/${id}/disable`, { method: "POST" }),
    runNow: (id: string) => request<{ ok: true }>(`/jobs/${id}/run`, { method: "POST" }),
    runs: (id: string, limit = 50, offset = 0) =>
      request<RunSummary[]>(`/jobs/${id}/runs?limit=${limit}&offset=${offset}`),
    validateSchedule: (schedule: string, timezone: string | null) =>
      request<{ valid: boolean; error?: string; human: string | null; next: string[] }>(
        "/jobs/validate-schedule",
        { method: "POST", body: json({ schedule, timezone }) },
      ),
  },

  runs: {
    recent: (limit = 50) => request<RunSummary[]>(`/runs?limit=${limit}`),
    get: (id: string) => request<Run>(`/runs/${id}`),
    kill: (id: string) => request<{ ok: true }>(`/runs/${id}/kill`, { method: "POST" }),
  },

  settings: {
    get: () => request<SettingsResponse>("/settings"),
    update: (input: UpdateSettingsInput) =>
      request<SettingsResponse>("/settings", { method: "PATCH", body: json(input) }),
    testLlm: (input: { provider: "openai" | "anthropic"; apiKey?: string; model?: string }) =>
      request<{ ok: true }>("/settings/test-llm", { method: "POST", body: json(input) }),
  },

  ai: {
    generateJob: (input: AiGenerateJobInput) =>
      request<AiJobDraft>("/ai/generate-job", { method: "POST", body: json(input) }),
    explainCron: (schedule: string) =>
      request<{ text: string }>("/ai/explain-cron", { method: "POST", body: json({ schedule }) }),
    diagnoseRun: (runId: string) =>
      request<AiDiagnoseRunResponse>("/ai/diagnose-run", { method: "POST", body: json({ runId }) }),
  },
};
