import clsx from "clsx";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-hidden rounded-card border border-default bg-surface shadow-card">
      <table className={clsx("w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-surface-muted">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  clickable?: boolean;
}

export function Tr({ clickable, className, children, ...rest }: TrProps) {
  return (
    <tr
      className={clsx(
        "border-b border-default last:border-0",
        clickable &&
          "cursor-pointer transition-colors hover:bg-surface-muted/60 focus-within:bg-surface-muted/60",
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function Th({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={clsx(
        "px-4 py-2.5 text-left text-xs font-medium tracking-wide text-muted",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={clsx("px-4 py-3 align-middle text-default", className)} {...rest}>
      {children}
    </td>
  );
}
