import type { RunStatus } from "@cronrunner/shared";
import clsx from "clsx";
import { Activity } from "lucide-react";
import { useMemo, useState } from "react";
import { RunDiagnosis } from "@/components/ai/RunDiagnosis";
import { RunDrawer } from "@/components/runs/RunDrawer";
import { RunsTable } from "@/components/runs/RunsTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { useJobs } from "@/hooks/useJobs";
import { useRecentRuns } from "@/hooks/useRuns";

const STATUS_FILTERS: { value: "all" | RunStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "timeout", label: "Timed out" },
  { value: "running", label: "Running" },
];

export function ActivityPage() {
  const runs = useRecentRuns(100);
  const jobs = useJobs();
  const [status, setStatus] = useState<"all" | RunStatus>("all");
  const [jobId, setJobId] = useState("all");
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const jobName = useMemo(() => {
    const map = new Map((jobs.data ?? []).map((j) => [j.id, j.name]));
    return (id: string) => map.get(id);
  }, [jobs.data]);

  const visible = useMemo(
    () =>
      (runs.data ?? []).filter(
        (run) =>
          (status === "all" || run.status === status) && (jobId === "all" || run.jobId === jobId),
      ),
    [runs.data, status, jobId],
  );

  const selected =
    visible.find((r) => r.id === selectedRun) ?? runs.data?.find((r) => r.id === selectedRun);

  return (
    <>
      <PageHeader title="Activity" subtitle="Every run across all jobs, newest first" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-default bg-surface p-0.5">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              aria-pressed={status === option.value}
              className={clsx(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                status === option.value
                  ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                  : "text-muted hover:text-default",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="w-56">
          <Select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            aria-label="Filter by job"
          >
            <option value="all">All jobs</option>
            {(jobs.data ?? []).map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {!runs.isPending && visible.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nothing here yet"
          description={
            (runs.data?.length ?? 0) === 0
              ? "Runs appear here as your jobs fire."
              : "No runs match these filters."
          }
        />
      ) : (
        <RunsTable
          runs={visible}
          loading={runs.isPending}
          onSelect={setSelectedRun}
          jobName={jobName}
        />
      )}

      <RunDrawer
        runId={selectedRun}
        onClose={() => setSelectedRun(null)}
        jobName={selected ? jobName(selected.jobId) : undefined}
        renderDiagnosis={(runId) =>
          selected ? <RunDiagnosis runId={runId} jobId={selected.jobId} /> : null
        }
      />
    </>
  );
}
