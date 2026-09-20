import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * CSS-only tooltip: shows on hover and keyboard focus within.
 * Keep the label short; anything longer belongs in the page.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <span className={clsx("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 scale-95 rounded-md border border-default bg-surface px-2 py-1 font-mono text-[11px] whitespace-nowrap text-default opacity-0 shadow-card transition duration-150 group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:scale-100 group-focus-within/tooltip:opacity-100 motion-reduce:transition-none",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {label}
      </span>
    </span>
  );
}
