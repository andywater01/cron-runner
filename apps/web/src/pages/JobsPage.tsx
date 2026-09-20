import type { JobWithStatus } from "@cronrunner/shared";
import { ListChecks, Sparkles, SquarePen } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { JobFilter } from "@/components/jobs/JobFilters";
import { JobFilters, matchesFilter, matchesSearch } from "@/components/jobs/JobFilters";
import { JobsTable } from "@/components/jobs/JobsTable";
import { NewJobButton } from "@/components/jobs/NewJobButton";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kbd } from "@/components/ui/Kbd";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { useDeleteJob, useJobs } from "@/hooks/useJobs";

export function JobsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: jobs, isPending, isError, error, refetch } = useJobs();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<JobFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<JobWithStatus | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const deleteJob = useDeleteJob();

  // Global shortcuts: N = new job, / = focus search. Ignored while typing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") {
        e.preventDefault();
        navigate("/jobs/new?mode=ai");
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const counts = useMemo(() => {
    const all = jobs ?? [];
    return {
      all: all.length,
      enabled: all.filter((j) => matchesFilter(j, "enabled")).length,
      disabled: all.filter((j) => matchesFilter(j, "disabled")).length,
      failing: all.filter((j) => matchesFilter(j, "failing")).length,
    };
  }, [jobs]);

  const visible = useMemo(
    () => (jobs ?? []).filter((job) => matchesFilter(job, filter) && matchesSearch(job, query)),
    [jobs, filter, query],
  );

  async function confirmDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    try {
      await deleteJob.mutateAsync(pendingDelete.id);
      toast.success(`Deleted “${name}”`);
    } catch {
      // useDeleteJob already shows an error toast.
    } finally {
      setPendingDelete(null);
    }
  }

  const hasJobs = (jobs?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle={
          hasJobs
            ? `${counts.enabled} of ${counts.all} enabled`
            : "Scheduled commands that run on this machine"
        }
        actions={<NewJobButton />}
      />

      {isError ? (
        <EmptyState
          title="Could not load jobs"
          description={error instanceof Error ? error.message : "The daemon may not be running."}
          action={
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      ) : isPending ? (
        <JobsTable jobs={[]} loading onDelete={() => {}} />
      ) : !hasJobs ? (
        <EmptyState
          icon={ListChecks}
          title="No jobs yet"
          description="Describe what you want to happen and when, and CronRunner will draft the command for you."
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
      ) : (
        <>
          <JobFilters
            ref={searchRef}
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            counts={counts}
          />
          {visible.length === 0 ? (
            <EmptyState
              title="No jobs match"
              description="Try a different search or filter."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <JobsTable jobs={visible} onDelete={setPendingDelete} />
          )}
          <p className="mt-3 text-[11px] text-muted">
            Press <Kbd>N</Kbd> for a new job, <Kbd>/</Kbd> to search.
          </p>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleteJob.isPending}
        title={`Delete “${pendingDelete?.name ?? ""}”?`}
        description="This removes the job and its entire run history. It cannot be undone."
        confirmLabel="Delete job"
        destructive
      />
    </>
  );
}
