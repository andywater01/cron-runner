import clsx from "clsx";
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { FIELD_BASE, Field } from "./Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  mono?: boolean;
  action?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, mono, action, className, id, required, rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={textareaId}
      action={action}
    >
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={clsx(
          FIELD_BASE,
          "resize-y py-2 leading-relaxed",
          mono && "font-mono text-[13px]",
          error ? "border-danger" : "border-default",
          className,
        )}
        {...rest}
      />
    </Field>
  );
});
