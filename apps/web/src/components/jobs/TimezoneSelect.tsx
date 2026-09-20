import { useId, useMemo } from "react";
import { Field } from "@/components/ui/Input";

/** All IANA zones the browser knows, with a graceful fallback for older engines. */
function allTimezones(): string[] {
  try {
    const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    if (supported) return supported("timeZone");
  } catch {
    // fall through
  }
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Berlin",
    "Asia/Tokyo",
  ];
}

export const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface TimezoneSelectProps {
  /** null means "use the machine's local zone". */
  value: string | null;
  onChange: (tz: string | null) => void;
}

export function TimezoneSelect({ value, onChange }: TimezoneSelectProps) {
  const listId = useId();
  const inputId = useId();
  const zones = useMemo(allTimezones, []);
  const unknown = value !== null && value.length > 0 && !zones.includes(value);

  return (
    <Field
      label="Timezone"
      htmlFor={inputId}
      error={unknown ? "Unknown timezone" : null}
      hint={unknown ? undefined : value === null ? `Local — ${LOCAL_TIMEZONE}` : undefined}
    >
      <input
        id={inputId}
        list={listId}
        type="text"
        value={value ?? ""}
        placeholder={`Local (${LOCAL_TIMEZONE})`}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value.trim();
          onChange(next === "" ? null : next);
        }}
        className={`h-9 w-full rounded-lg border bg-surface px-3 text-sm text-default placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-500/40 ${
          unknown ? "border-danger" : "border-default"
        }`}
      />
      <datalist id={listId}>
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    </Field>
  );
}
