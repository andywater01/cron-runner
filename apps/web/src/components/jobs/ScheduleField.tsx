import { SCHEDULE_PRESETS } from "@cronrunner/shared";
import { CalendarClock, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { ScheduleValidation } from "./types";

export interface ScheduleFieldProps {
  value: string;
  onChange: (cron: string) => void;
  validation: ScheduleValidation | undefined;
  validating: boolean;
  error?: string | null;
  /** Rendered as a link beside the label; Phase 6 uses it for the AI cron explainer. */
  onExplain?: () => void;
}

const CUSTOM = "__custom__";

export function ScheduleField({
  value,
  onChange,
  validation,
  validating,
  error,
  onExplain,
}: ScheduleFieldProps) {
  const preset = SCHEDULE_PRESETS.find((p) => p.cron === value)?.cron ?? CUSTOM;
  const invalid = validation && !validation.valid;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Select
        label="Schedule"
        value={preset}
        onChange={(e) => {
          if (e.target.value !== CUSTOM) onChange(e.target.value);
        }}
      >
        {SCHEDULE_PRESETS.map((p) => (
          <option key={p.cron} value={p.cron}>
            {p.label}
          </option>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </Select>

      <Input
        label="Cron expression"
        mono
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        error={error ?? (invalid ? (validation?.error ?? "Invalid cron expression") : null)}
        action={
          onExplain ? (
            <button
              type="button"
              onClick={onExplain}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-600 hover:underline dark:text-accent-300"
            >
              <Sparkles className="size-3" />
              Explain
            </button>
          ) : undefined
        }
      />

      <p className="col-span-2 -mt-1 flex items-center gap-1.5 text-xs text-muted">
        <CalendarClock className="size-3.5 shrink-0" aria-hidden />
        {validating
          ? "Checking…"
          : validation?.valid
            ? validation.human
            : "Enter a 5-field cron expression"}
      </p>
    </div>
  );
}
