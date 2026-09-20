import type { RunStatus } from "@cronrunner/shared";
import clsx from "clsx";
import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "danger" | "warning" | "info" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  accent: "bg-accent-500/10 text-accent-600 dark:text-accent-300",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-slate-400",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  accent: "bg-accent-500",
};

export interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", dot, pulse, children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={clsx(
            "size-1.5 rounded-full",
            DOTS[tone],
            pulse && "animate-pulse motion-reduce:animate-none",
          )}
        />
      )}
      {children}
    </span>
  );
}

const STATUS_META: Record<RunStatus, { tone: Tone; label: string }> = {
  running: { tone: "info", label: "Running" },
  success: { tone: "success", label: "Success" },
  failed: { tone: "danger", label: "Failed" },
  timeout: { tone: "warning", label: "Timed out" },
  killed: { tone: "neutral", label: "Killed" },
};

export function StatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} dot pulse={status === "running"} className={className}>
      {meta.label}
    </Badge>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-muted">
      {children}
    </span>
  );
}
