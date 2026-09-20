import { X } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/ui/Input";

export interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

/** Chip input: Enter or comma commits a tag, Backspace on an empty field removes the last one. */
export function TagsInput({ value, onChange }: TagsInputProps) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/,+$/, "");
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  }

  return (
    <Field label="Tags" hint="Used for filtering in the jobs list.">
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-default bg-surface px-2 py-1.5 focus-within:ring-2 focus-within:ring-accent-500/40">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded-full p-0.5 hover:text-danger"
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          aria-label="Add a tag"
          placeholder={value.length === 0 ? "backup, nightly…" : ""}
          onChange={(e) => {
            if (e.target.value.endsWith(",")) commit(e.target.value);
            else setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          className="min-w-24 flex-1 bg-transparent text-sm text-default placeholder:text-muted focus:outline-none"
        />
      </div>
    </Field>
  );
}
