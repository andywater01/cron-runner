import type { JobWithStatus } from "@cronrunner/shared";
import clsx from "clsx";
import { Search } from "lucide-react";
import { forwardRef } from "react";

export type JobFilter = "all" | "enabled" | "disabled" | "failing";

const FILTERS: { value: JobFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
  { value: "failing", label: "Failing" },
];

export function matchesFilter(job: JobWithStatus, filter: JobFilter): boolean {
  switch (filter) {
    case "enabled":
      return job.enabled;
    case "disabled":
      return !job.enabled;
    case "failing":
      return job.lastRun?.status === "failed" || job.lastRun?.status === "timeout";
    default:
      return true;
  }
}

export function matchesSearch(job: JobWithStatus, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    job.name.toLowerCase().includes(q) ||
    job.command.toLowerCase().includes(q) ||
    job.description.toLowerCase().includes(q) ||
    job.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

export interface JobFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: JobFilter;
  onFilterChange: (value: JobFilter) => void;
  counts: Record<JobFilter, number>;
}

export const JobFilters = forwardRef<HTMLInputElement, JobFiltersProps>(function JobFilters(
  { query, onQueryChange, filter, onFilterChange, counts },
  ref,
) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="relative w-72">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          ref={ref}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search jobs…"
          aria-label="Search jobs"
          className="h-9 w-full rounded-lg border border-default bg-surface pr-3 pl-8.5 text-sm text-default placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-500/40"
        />
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-default bg-surface p-0.5">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onFilterChange(option.value)}
            aria-pressed={filter === option.value}
            className={clsx(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === option.value
                ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                : "text-muted hover:text-default",
            )}
          >
            {option.label}
            <span className="ml-1.5 tabular-nums opacity-60">{counts[option.value]}</span>
          </button>
        ))}
      </div>
    </div>
  );
});
