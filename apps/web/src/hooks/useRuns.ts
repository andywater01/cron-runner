import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { qk } from "@/lib/queryKeys";

export function useJobRuns(jobId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: qk.jobRuns(jobId ?? ""),
    queryFn: () => api.jobs.runs(jobId as string, limit),
    enabled: Boolean(jobId),
  });
}

export function useRecentRuns(limit = 100) {
  return useQuery({ queryKey: qk.recentRuns, queryFn: () => api.runs.recent(limit) });
}

export function useRun(runId: string | null) {
  return useQuery({
    queryKey: qk.run(runId ?? ""),
    queryFn: () => api.runs.get(runId as string),
    enabled: Boolean(runId),
  });
}

export function useKillRun() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (runId: string) => api.runs.kill(runId),
    onSuccess: (_d, runId) => {
      toast.info("Stopping the run…");
      qc.invalidateQueries({ queryKey: qk.run(runId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not stop the run"),
  });
}
