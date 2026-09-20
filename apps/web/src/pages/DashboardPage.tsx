import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ListChecks,
  Play,
  Sparkles,
  SquarePen,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useJobs } from "@/hooks/useJobs";
import { useRecentRuns } from "@/hooks/useRuns";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { absoluteTime, formatDuration, relativeTime } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;

export function DashboardPage() {
  const navigate = useNavigate();
  const jobs = useJobs();
  const runs = useRecentRuns(200);
  const system = useSystemInfo();

  const upcoming = useMemo(
    () =>
      (jobs.data ?? [])
        .filter((job) => job.enabled && job.nextRunAt)
        .sort((a, b) => (a.nextRunAt ?? "").localeCompare(b.nextRunAt ?? ""))
        .slice(0, 8),
    [jobs.data],
  );

  const lastDay = useMemo(() => {
    const cutoff = Date.now() - DAY_MS;
    return (runs.data ?? []).filter((run) => new Date(run.startedAt).getTime() >= cutoff);
  }, [runs.data]);

  const failures = lastDay.filter((r) => r.status === "failed" || r.status === "timeout");
  const enabledCount = (jobs.data ?? []).filter((j) => j.enabled).length;
  const nextJob = upcoming[0];
  const recent = (runs.data ?? []).slice(0, 10);
  const hasJobs = (jobs.data?.length ?? 0) > 0;

  if (!jobs.isPending && !hasJobs) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={ListChecks}
          title="Nothing scheduled yet"
          description="Describe what you want to happen and when, and CronRunner will draft the command and run it on this machine."
          action={
            <>
              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles className="size-3.5" />}
                onClick={() => navigate("/jobs/new?mode=ai")}
              >
                Describe it with AI
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<SquarePen className="size-3.5" />}
                onClick={() => navigate("/jobs/new")}
              >
                Create manually
              </Button>
            </>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          system.data
            ? `${system.data.hostname} · ${system.data.timezone} · ${enabledCount} job${enabledCount === 1 ? "" : "s"} enabled`
            : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Enabled jobs"
          value={enabledCount}
          hint={`of ${jobs.data?.length ?? 0} total`}
          icon={ListChecks}
          loading={jobs.isPending}
        />
        <StatCard
          label="Runs (24h)"
          value={lastDay.length}
          hint={`${lastDay.filter((r) => r.status === "success").length} succeeded`}
          icon={Play}
          loading={runs.isPending}
        />
        <StatCard
          label="Failures (24h)"
          value={failures.length}
          hint={failures.length === 0 ? "All clear" : "Needs a look"}
          icon={failures.length > 0 ? AlertTriangle : CheckCircle2}
          tone={failures.length > 0 ? "danger" : "default"}
          loading={runs.isPending}
        />
        <StatCard
          label="Next run"
          value={nextJob ? relativeTime(nextJob.nextRunAt) : "—"}
          hint={nextJob ? nextJob.name : "Nothing scheduled"}
          icon={CalendarClock}
          loading={jobs.isPending}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Upcoming"
            subtitle="Next scheduled runs"
            actions={
              <Link
                to="/jobs"
                className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-300"
              >
                All jobs
              </Link>
            }
          />
          <CardBody className="p-0">
            {jobs.isPending ? (
              <div className="flex flex-col gap-2 px-5 py-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : upcoming.length === 0 ? (
              <p className="px-5 py-4 text-xs text-muted">No jobs are enabled.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {upcoming.map((job) => (
                  <li key={job.id}>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-surface-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-default">
                          {job.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          {job.scheduleHuman}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs text-default">
                          {relativeTime(job.nextRunAt)}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {absoluteTime(job.nextRunAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            subtitle="Latest runs"
            actions={
              <Link
                to="/activity"
                className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-300"
              >
                All activity
              </Link>
            }
          />
          <CardBody className="p-0">
            {runs.isPending ? (
              <div className="flex flex-col gap-2 px-5 py-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : recent.length === 0 ? (
              <p className="px-5 py-4 text-xs text-muted">No runs yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {recent.map((run) => {
                  const job = jobs.data?.find((j) => j.id === run.jobId);
                  return (
                    <li key={run.id}>
                      <Link
                        to={`/jobs/${run.jobId}`}
                        className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-surface-muted"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <StatusBadge status={run.status} />
                          <span className="truncate text-sm text-default">
                            {job?.name ?? "Deleted job"}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs text-muted">
                            {relativeTime(run.startedAt)}
                          </span>
                          <span className="block text-[11px] text-muted tabular-nums">
                            {formatDuration(run.durationMs)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
