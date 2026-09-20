import clsx from "clsx";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  items: DropdownItem[];
  label?: string;
  /** Custom trigger content; defaults to a ⋯ icon button. */
  trigger?: ReactNode;
  /** Override the trigger button's classes (e.g. to match an adjacent button's height). */
  triggerClassName?: string;
  align?: "left" | "right";
}

/** Small menu for row actions. Closes on outside click, Esc, or selection. */
export function DropdownMenu({
  items,
  label = "More actions",
  trigger,
  triggerClassName,
  align = "right",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={clsx(
          "inline-flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50",
          triggerClassName ?? "size-8 text-muted hover:bg-surface-muted hover:text-default",
        )}
      >
        {trigger ?? <MoreHorizontal className="size-4" />}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={clsx(
            "absolute top-full z-40 mt-1 min-w-44 overflow-hidden rounded-lg border border-default bg-surface py-1 shadow-card",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={clsx(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-40",
                item.destructive
                  ? "text-danger hover:bg-danger/10"
                  : "text-default hover:bg-surface-muted",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
