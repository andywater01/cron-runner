import clsx from "clsx";
import type { ComponentType, ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "danger";
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  loading,
}: StatCardProps) {
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <Icon
          className={clsx("size-3.5", tone === "danger" ? "text-danger" : "text-muted")}
          aria-hidden
        />
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p
          className={clsx(
            "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
            tone === "danger" ? "text-danger" : "text-default",
          )}
        >
          {value}
        </p>
      )}
      {hint && <p className="mt-0.5 truncate text-[11px] text-muted">{hint}</p>}
    </Card>
  );
}
