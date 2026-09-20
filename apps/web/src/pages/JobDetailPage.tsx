import { Copy, History, Pencil, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RunDiagnosis } from "@/components/ai/RunDiagnosis";
import { LOCAL_TIMEZONE } from "@/components/jobs/TimezoneSelect";
import { RunDrawer } from "@/components/runs/RunDrawer";
import { RunsTable } from "@/components/runs/RunsTable";
import { StatusBadge, Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useDeleteJob, useJob, useRunNow, useToggleJob } from "@/hooks/useJobs";
import { useJobRuns } from "@/hooks/useRuns";
import { absoluteTime, relativeTime } from "@/lib/format";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-xs text-default">{children}</dd>
    </div>
  );
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: job, isPending, isError } = useJob(id);
  const runs = useJobRuns(id);
  const toggle = useToggleJob();
  const runNow = useRunNow();
  const deleteJob = useDeleteJob();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isError) {
    return (
      <>
        <PageHeader title="Job not found" />
        <EmptyState
          title="That job no longer exists"
          description="It may have been deleted."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate("/jobs")}>
              Back to jobs
            </Button>
          }
        />
      </>
    );
  }

  if (isPending || !job) {
    return (
      <>
        <PageHeader title="Loading…" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={job.name}
        subtitle={job.description || job.scheduleHuman}
        actions={
          <>
            <Switch
              checked={job.enabled}
              onChange={(enabled) => toggle.mutate({ id: job.id, enabled })}
              label={job.enabled ? "Enabled" : "Disabled"}
              showLabel
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="size-3.5" />}
              disabled={job.isRunning}
              onClick={() => runNow.mutate(job.id)}
            >
              {job.isRunning ? "Running…" : "Run now"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil className="size-3.5" />}
              onClick={() => navigate(`/jobs/${job.id}/edit`)}
            >
              Edit
            </Button>
            <DropdownMenu
              label={`More actions for ${job.name}`}
              items={[
                {
                  label: "Duplicate",
                  icon: <Copy className="size-3.5" />,
                  onSelect: () => navigate(`/jobs/new?from=${job.id}`),
                },
                {
                  label: "Delete",
                  icon: <Trash2 className="size-3.5" />,
                  destructive: true,
                  onSelect: () => setConfirmDelete(true),
                },
              ]}
            />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Schedule" />
          <CardBody>
            <dl className="divide-y divide-[var(--border)]">
              <DetailRow label="Runs">{job.scheduleHuman}</DetailRow>
              <DetailRow label="Cron">
                <span className="font-mono">{job.schedule}</span>
              </DetailRow>
              <DetailRow label="Timezone">{job.timezone ?? `Local — ${LOCAL_TIMEZONE}`}</DetailRow>
              <DetailRow label="Next run">
                {job.enabled ? (
                  <span title={absoluteTime(job.nextRunAt)}>{relativeTime(job.nextRunAt)}</span>
                ) : (
                  "Disabled"
                )}
              </DetailRow>
              <DetailRow label="Last run">
                {job.lastRun ? (
                  <span className="inline-flex items-center gap-2">
                    <StatusBadge status={job.lastRun.status} />
                    {relativeTime(job.lastRun.startedAt)}
                  </span>
                ) : (
                  "Never"
                )}
              </DetailRow>
            </dl>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Command"
            subtitle={`${job.shell === "auto" ? "Default shell" : job.shell} · ${job.cwd ?? "home directory"}`}
          />
          <CardBody className="flex flex-col gap-3">
            <CodeBlock code={job.command} maxHeight="max-h-48" />
            <dl className="divide-y divide-[var(--border)]">
              <DetailRow label="Timeout">
                {job.timeoutSeconds ? `${job.timeoutSeconds}s` : "None"}
              </DetailRow>
              <DetailRow label="Environment">
                {Object.keys(job.env).length === 0
                  ? "Inherited only"
                  : Object.keys(job.env).map((k) => <Tag key={k}>{k}</Tag>)}
              </DetailRow>
              <DetailRow label="Tags">
                {job.tags.length === 0 ? (
                  "None"
                ) : (
                  <span className="inline-flex gap-1">
                    {job.tags.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Created">{absoluteTime(job.createdAt)}</DetailRow>
            </dl>
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-default">Run history</h2>
      {!runs.isPending && (runs.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={History}
          title="No runs yet"
          description={
            job.enabled
              ? `This job next runs ${relativeTime(job.nextRunAt)}.`
              : "Enable the job or run it now to see output here."
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              icon={<Play className="size-3.5" />}
              onClick={() => runNow.mutate(job.id)}
            >
              Run now
            </Button>
          }
        />
      ) : (
        <RunsTable runs={runs.data ?? []} loading={runs.isPending} onSelect={setSelectedRun} />
      )}

      <RunDrawer
        runId={selectedRun}
        onClose={() => setSelectedRun(null)}
        jobName={job.name}
        renderDiagnosis={(runId) => <RunDiagnosis runId={runId} jobId={job.id} />}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await deleteJob.mutateAsync(job.id);
            toast.success(`Deleted “${job.name}”`);
            navigate("/jobs");
          } catch {
            setConfirmDelete(false);
          }
        }}
        loading={deleteJob.isPending}
        title={`Delete “${job.name}”?`}
        description="This removes the job and its entire run history. It cannot be undone."
        confirmLabel="Delete job"
        destructive
      />
    </>
  );
}
