import { CalendarClock, FolderOpen, TerminalSquare, Timer } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Skeleton } from "@/components/ui/Skeleton";
import { absoluteTime, relativeTime } from "@/lib/format";
import type { JobFormValues } from "./JobForm";
import { LOCAL_TIMEZONE } from "./TimezoneSelect";
import type { ScheduleValidation } from "./types";

export interface JobPreviewCardProps {
  values: JobFormValues;
  validation: ScheduleValidation | undefined;
  validating: boolean;
}

export function JobPreviewCard({ values, validation, validating }: JobPreviewCardProps) {
  return (
    <Card>
      <CardHeader title="Preview" subtitle="What will happen once you save" />
      <CardBody className="flex flex-col gap-4">
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <CalendarClock className="size-3.5" aria-hidden />
            Runs
          </h3>
          {validating ? (
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : validation?.valid ? (
            <>
              <p className="text-sm text-default">{validation.human}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {values.timezone ?? `Local time — ${LOCAL_TIMEZONE}`}
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {validation.next.map((iso) => (
                  <li key={iso} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-default">{absoluteTime(iso)}</span>
                    <span className="shrink-0 text-muted">{relativeTime(iso)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-danger">
              {validation?.error ?? "Enter a valid cron expression"}
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <TerminalSquare className="size-3.5" aria-hidden />
            Command
          </h3>
          {values.command.trim() ? (
            <CodeBlock code={values.command} maxHeight="max-h-40" />
          ) : (
            <p className="text-xs text-muted">Nothing to run yet.</p>
          )}
        </section>

        <section className="flex flex-col gap-1.5 border-t border-default pt-3 text-xs">
          <div className="flex items-center gap-1.5 text-muted">
            <FolderOpen className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate font-mono text-[11px]">
              {values.cwd ?? "~ (home directory)"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted">
            <TerminalSquare className="size-3.5 shrink-0" aria-hidden />
            <span>{values.shell === "auto" ? "Default shell for this OS" : values.shell}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted">
            <Timer className="size-3.5 shrink-0" aria-hidden />
            <span>
              {values.timeoutSeconds ? `Killed after ${values.timeoutSeconds}s` : "No timeout"}
            </span>
          </div>
        </section>
      </CardBody>
    </Card>
  );
}
