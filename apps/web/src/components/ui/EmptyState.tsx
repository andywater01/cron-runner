import type { ComponentType, ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-default bg-surface px-6 py-14 text-center">
      {Icon && (
        <div className="grid size-10 place-items-center rounded-full bg-surface-muted">
          <Icon className="size-5 text-muted" />
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-default">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1 flex items-center gap-2">{action}</div>}
    </div>
  );
}
