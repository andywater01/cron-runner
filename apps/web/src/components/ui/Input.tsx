import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";

export const FIELD_BASE =
  "w-full rounded-lg border bg-surface px-3 text-sm text-default placeholder:text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500/40 disabled:opacity-60";

export interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  /** Extra node rendered on the right of the label row (e.g. an "Explain" link). */
  action?: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
  action,
}: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-xs font-medium text-default">
              {label}
              {required && <span className="ml-0.5 text-danger">*</span>}
            </label>
          )}
          {action}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string | null;
  mono?: boolean;
  action?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, mono, action, className, id, required, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      action={action}
    >
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={clsx(
          FIELD_BASE,
          "h-9",
          mono && "font-mono",
          error ? "border-danger" : "border-default",
          className,
        )}
        {...rest}
      />
    </Field>
  );
});
