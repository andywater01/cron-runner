import type { RunSummary } from "@cronrunner/shared";
import { StatusBadge } from "@/components/ui/Badge";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Table, TBody, Td, THead, Th, Tr } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { absoluteTime, formatDuration, relativeTime } from "@/lib/format";

export interface RunsTableProps {
  runs: RunSummary[];
  loading?: boolean;
  onSelect: (runId: string) => void;
  /** Resolve a job name for cross-job views (Activity). Omit on a single job's page. */
  jobName?: (jobId: string) => string | undefined;
}

export function RunsTable({ runs, loading, onSelect, jobName }: RunsTableProps) {
  const cols = jobName ? 6 : 5;
  return (
    <Table>
      <THead>
        <Tr>
          <Th className="w-32">Status</Th>
          {jobName && <Th>Job</Th>}
          <Th className="w-28">Trigger</Th>
          <Th>Started</Th>
          <Th className="w-24">Duration</Th>
          <Th className="w-20 text-right">Exit</Th>
        </Tr>
      </THead>
      <TBody>
        {loading ? (
          <SkeletonRows rows={4} cols={cols} />
        ) : (
          runs.map((run) => (
            <Tr key={run.id} clickable onClick={() => onSelect(run.id)}>
              <Td>
                <StatusBadge status={run.status} />
              </Td>
              {jobName && (
                <Td>
                  <button
                    type="button"
                    onClick={() => onSelect(run.id)}
                    className="truncate text-sm font-medium text-default hover:text-accent-600 dark:hover:text-accent-300"
                  >
                    {jobName(run.jobId) ?? "Deleted job"}
                  </button>
                </Td>
              )}
              <Td className="text-xs text-muted">
                {run.trigger === "manual" ? "Manual" : "Schedule"}
              </Td>
              <Td>
                <Tooltip label={absoluteTime(run.startedAt)}>
                  <span className="text-xs text-muted">{relativeTime(run.startedAt)}</span>
                </Tooltip>
              </Td>
              <Td className="text-xs text-muted tabular-nums">{formatDuration(run.durationMs)}</Td>
              <Td className="text-right font-mono text-xs text-muted">
                {run.exitCode === null ? "—" : run.exitCode}
              </Td>
            </Tr>
          ))
        )}
      </TBody>
    </Table>
  );
}
