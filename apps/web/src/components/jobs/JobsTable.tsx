import type { JobWithStatus } from "@cronrunner/shared";
import { Copy, Pencil, Play, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusBadge, Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Table, TBody, Td, THead, Th, Tr } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useRunNow, useToggleJob } from "@/hooks/useJobs";
import { relativeTime, truncate } from "@/lib/format";

export interface JobsTableProps {
  jobs: JobWithStatus[];
  loading?: boolean;
  onDelete: (job: JobWithStatus) => void;
}

export function JobsTable({ jobs, loading, onDelete }: JobsTableProps) {
  const navigate = useNavigate();
  const toggle = useToggleJob();
  const runNow = useRunNow();

  return (
    <Table>
      <THead>
        <Tr>
          <Th className="w-14">On</Th>
          <Th>Name</Th>
          <Th>Schedule</Th>
          <Th className="w-40">Last run</Th>
          <Th className="w-32">Next run</Th>
          <Th className="w-24 text-right">Actions</Th>
        </Tr>
      </THead>
      <TBody>
        {loading ? (
          <SkeletonRows rows={4} cols={6} />
        ) : (
          jobs.map((job) => (
            // Mouse users can click anywhere in the row; keyboard users tab to the name link.
            <Tr key={job.id} clickable onClick={() => navigate(`/jobs/${job.id}`)}>
              <Td onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={job.enabled}
                  size="sm"
                  label={`${job.enabled ? "Disable" : "Enable"} ${job.name}`}
                  onChange={(enabled) => toggle.mutate({ id: job.id, enabled })}
                />
              </Td>

              <Td>
                <div className="flex items-center gap-2">
                  {job.isRunning && (
                    <>
                      <span
                        className="size-1.5 shrink-0 animate-pulse rounded-full bg-info motion-reduce:animate-none"
                        aria-hidden
                      />
                      <span className="sr-only">Running now</span>
                    </>
                  )}
                  <a
                    href={`/jobs/${job.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/jobs/${job.id}`);
                    }}
                    className="truncate text-sm font-medium text-default hover:text-accent-600 focus-visible:outline-none focus-visible:underline dark:hover:text-accent-300"
                  >
                    {job.name}
                  </a>
                  {job.source === "ai" && <Tag>ai</Tag>}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="truncate font-mono text-[11px] text-muted">
                    {truncate(job.command.split("\n")[0] ?? "", 52)}
                  </span>
                  {job.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              </Td>

              <Td>
                <Tooltip label={job.schedule}>
                  <span className="text-xs text-muted">{job.scheduleHuman}</span>
                </Tooltip>
              </Td>

              <Td>
                {job.lastRun ? (
                  <div className="flex flex-col gap-0.5">
                    <StatusBadge status={job.lastRun.status} className="w-fit" />
                    <span className="text-[11px] text-muted">
                      {relativeTime(job.lastRun.startedAt)}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted">Never run</span>
                )}
              </Td>

              <Td>
                <span className="text-xs text-muted">
                  {job.enabled ? relativeTime(job.nextRunAt) : "Disabled"}
                </span>
              </Td>

              <Td onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Run ${job.name} now`}
                    disabled={job.isRunning}
                    onClick={() => runNow.mutate(job.id)}
                    icon={<Play className="size-3.5" />}
                  />
                  <DropdownMenu
                    label={`Actions for ${job.name}`}
                    items={[
                      {
                        label: "Edit",
                        icon: <Pencil className="size-3.5" />,
                        onSelect: () => navigate(`/jobs/${job.id}/edit`),
                      },
                      {
                        label: "Duplicate",
                        icon: <Copy className="size-3.5" />,
                        onSelect: () => navigate(`/jobs/new?from=${job.id}`),
                      },
                      {
                        label: "Delete",
                        icon: <Trash2 className="size-3.5" />,
                        destructive: true,
                        onSelect: () => onDelete(job),
                      },
                    ]}
                  />
                </div>
              </Td>
            </Tr>
          ))
        )}
      </TBody>
    </Table>
  );
}
