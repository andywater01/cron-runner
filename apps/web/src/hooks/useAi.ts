import type { AiGenerateJobInput } from "@cronrunner/shared";
import { useMutation } from "@tanstack/react-query";
import { ApiRequestError, api } from "@/lib/api";

/** True when the failure is "no API key configured" rather than a provider problem. */
export function isNotConfigured(err: unknown): boolean {
  return err instanceof ApiRequestError && err.code === "llm_not_configured";
}

export function aiErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  return err instanceof Error ? err.message : "The request failed";
}

export function useGenerateJob() {
  return useMutation({ mutationFn: (input: AiGenerateJobInput) => api.ai.generateJob(input) });
}

export function useExplainCron() {
  return useMutation({ mutationFn: (schedule: string) => api.ai.explainCron(schedule) });
}

export function useDiagnoseRun() {
  return useMutation({ mutationFn: (runId: string) => api.ai.diagnoseRun(runId) });
}
