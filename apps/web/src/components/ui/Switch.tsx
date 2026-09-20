import clsx from "clsx";
import { useId } from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Names the control. Shown on screen only when `showLabel` is set. */
  label: string;
  /** Show the label text next to the control instead of only to screen readers. */
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * A switch is a `<button role="switch">`, not a checkbox, so a wrapping `<label>` does NOT
 * give it an accessible name — labels only name true form controls. The name therefore comes
 * from `aria-labelledby` when the text is visible, and `aria-label` when it is not.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  showLabel,
  size = "md",
  className,
}: SwitchProps) {
  const labelId = useId();
  const track = size === "sm" ? "h-4 w-7" : "h-5 w-9";
  const knob = size === "sm" ? "size-3" : "size-4";
  const shift = size === "sm" ? "translate-x-3" : "translate-x-4";

  return (
    <span className={clsx("inline-flex items-center gap-2", disabled && "opacity-50", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={showLabel ? undefined : label}
        aria-labelledby={showLabel ? labelId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          track,
          "relative shrink-0 cursor-pointer rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 disabled:cursor-not-allowed",
          checked ? "bg-accent-600" : "bg-slate-300 dark:bg-slate-600",
        )}
      >
        <span
          className={clsx(
            knob,
            "absolute top-1/2 left-0.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none",
            checked && shift,
          )}
        />
      </button>
      {showLabel && (
        <button
          type="button"
          id={labelId}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          tabIndex={-1}
          className="cursor-pointer text-left text-sm text-default disabled:cursor-not-allowed"
        >
          {label}
        </button>
      )}
    </span>
  );
}
