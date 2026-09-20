import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { FIELD_BASE, Field } from "./Input";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, required, children, ...rest },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={selectId}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={clsx(
            FIELD_BASE,
            "h-9 cursor-pointer appearance-none pr-9",
            error ? "border-danger" : "border-default",
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
      </div>
    </Field>
  );
});
