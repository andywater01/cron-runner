/**
 * Job queries and mutations. Every component reads jobs through these hooks so the
 * react-query cache stays the single source of truth (SSE events invalidate it).
 */

import type { CreateJobInput, JobWithStatus, UpdateJobInput } from "@cronrunner/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { ApiRequestError, api } from "@/lib/api";
import { qk } from "@/lib/queryKeys";

export function useJobs() {
  return useQuery({ queryKey: qk.jobs, queryFn: api.jobs.list });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: qk.job(id ?? ""),
    queryFn: () => api.jobs.get(id as string),
    enabled: Boolean(id),
  });
}

function message(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  return err instanceof Error ? err.message : "Something went wrong";
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobInput) => api.jobs.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobs }),
  });
}

export function useUpdateJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateJobInput) => api.jobs.update(id, patch),
    onSuccess: (job) => {
      qc.setQueryData(qk.job(id), job);
      qc.invalidateQueries({ queryKey: qk.jobs });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => api.jobs.remove(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: qk.job(id) });
      qc.invalidateQueries({ queryKey: qk.jobs });
    },
    onError: (err) => toast.error(`Could not delete job: ${message(err)}`),
  });
}

/**
 * Optimistic enable/disable: the switch flips immediately and rolls back on failure.
 */
export function useToggleJob() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? api.jobs.enable(id) : api.jobs.disable(id),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: qk.jobs });
      const previous = qc.getQueryData<JobWithStatus[]>(qk.jobs);
      qc.setQueryData<JobWithStatus[]>(qk.jobs, (jobs) =>
        jobs?.map((job) => (job.id === id ? { ...job, enabled } : job)),
      );
      const previousJob = qc.getQueryData<JobWithStatus>(qk.job(id));
      if (previousJob) qc.setQueryData<JobWithStatus>(qk.job(id), { ...previousJob, enabled });
      return { previous, previousJob, id };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) qc.setQueryData(qk.jobs, context.previous);
      if (context?.previousJob) qc.setQueryData(qk.job(context.id), context.previousJob);
      toast.error(`Could not update job: ${message(err)}`);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.job(vars.id) });
    },
  });
}

export function useRunNow() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => api.jobs.runNow(id),
    onSuccess: (_data, id) => {
      toast.info("Run started");
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.jobRuns(id) });
    },
    onError: (err) => toast.error(message(err)),
  });
}
