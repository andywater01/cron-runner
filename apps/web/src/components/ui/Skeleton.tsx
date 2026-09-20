import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none",
        className,
      )}
      aria-hidden
    />
  );
}

/** Placeholder rows for a table while its data loads. */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows, never reordered
        <tr key={r} className="border-b border-default last:border-0">
          {Array.from({ length: cols }, (_, c) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cells, never reordered
            <td key={c} className="px-4 py-3.5">
              <Skeleton className={clsx("h-4", c === 0 ? "w-40" : "w-24")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
