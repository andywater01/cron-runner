import type { LlmProvider, UpdateSettingsInput } from "@cronrunner/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { qk } from "@/lib/queryKeys";

export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: api.settings.get });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => api.settings.update(input),
    onSuccess: (settings) => qc.setQueryData(qk.settings, settings),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save settings"),
  });
}

/** Tests a key without saving it, so the user can check before committing. */
export function useTestLlm() {
  return useMutation({
    mutationFn: (input: { provider: LlmProvider; apiKey?: string; model?: string }) =>
      api.settings.testLlm(input),
  });
}
