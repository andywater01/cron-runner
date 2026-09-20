import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";

export interface EnvVarsEditorProps {
  value: Record<string, string>;
  onChange: (env: Record<string, string>) => void;
}

type Row = { id: number; key: string; value: string };

/**
 * Rows are held locally (a Record can't express order, duplicate or half-typed keys)
 * and reduced back to a Record on every change.
 */
function toRows(env: Record<string, string>): Row[] {
  return Object.entries(env).map(([key, value], i) => ({ id: i, key, value }));
}

export function EnvVarsEditor({ value, onChange }: EnvVarsEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => toRows(value));
  /** The last record this component emitted, so we can tell our own edits from external ones. */
  const emitted = useRef(JSON.stringify(value));

  // Re-seed when the record is replaced from outside (job loaded for edit/duplicate, or an AI
  // draft applied). Without this the rows would stay frozen at their first-mount value.
  useEffect(() => {
    const incoming = JSON.stringify(value);
    if (incoming === emitted.current) return;
    emitted.current = incoming;
    setRows(toRows(value));
  }, [value]);

  function apply(next: Row[]) {
    setRows(next);
    const env: Record<string, string> = {};
    for (const row of next) {
      const key = row.key.trim();
      if (key) env[key] = row.value;
    }
    emitted.current = JSON.stringify(env);
    onChange(env);
  }

  return (
    <Field
      label="Environment variables"
      hint="Merged over the daemon's environment when the job runs."
    >
      <div className="flex flex-col gap-1.5">
        {rows.map((row, index) => (
          <div key={row.id} className="flex items-center gap-1.5">
            <input
              aria-label={`Variable ${index + 1} name`}
              placeholder="NAME"
              value={row.key}
              spellCheck={false}
              onChange={(e) =>
                apply(rows.map((r) => (r.id === row.id ? { ...r, key: e.target.value } : r)))
              }
              className="h-9 w-2/5 rounded-lg border border-default bg-surface px-3 font-mono text-[13px] text-default placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            />
            <input
              aria-label={`Variable ${index + 1} value`}
              placeholder="value"
              value={row.value}
              spellCheck={false}
              onChange={(e) =>
                apply(rows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)))
              }
              className="h-9 flex-1 rounded-lg border border-default bg-surface px-3 font-mono text-[13px] text-default placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Remove variable ${row.key || index + 1}`}
              onClick={() => apply(rows.filter((r) => r.id !== row.id))}
              icon={<X className="size-3.5" />}
            />
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="size-3.5" />}
            onClick={() => setRows([...rows, { id: Date.now(), key: "", value: "" }])}
          >
            Add variable
          </Button>
        </div>
      </div>
    </Field>
  );
}
