import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { NoKeyCallout } from "./NoKeyCallout";

const EXAMPLES = [
  "Back up ~/Documents to ~/Backups every night at 2am",
  "Delete files in my Downloads older than 30 days every Sunday morning",
  "Every 5 minutes check if https://example.com responds and append the status to ~/uptime.log",
  "Run git pull in ~/code/myrepo every weekday at 8am",
];

export interface AiPromptPanelProps {
  onGenerate: (prompt: string) => void;
  generating: boolean;
  hasKey: boolean;
  error?: string | null;
}

export function AiPromptPanel({ onGenerate, generating, hasKey, error }: AiPromptPanelProps) {
  const [prompt, setPrompt] = useState("");

  if (!hasKey) return <NoKeyCallout what="describe jobs in plain English" />;

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        label="What should happen, and when?"
        rows={4}
        value={prompt}
        placeholder="Back up my Documents folder to my external drive every night at 2am"
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim())
            onGenerate(prompt.trim());
        }}
        error={error}
        hint="Press ⌘/Ctrl + Enter to generate."
      />

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setPrompt(example)}
            className="rounded-full border border-default bg-surface px-2.5 py-1 text-[11px] text-muted transition-colors hover:bg-surface-muted hover:text-default"
          >
            {example.length > 52 ? `${example.slice(0, 51)}…` : example}
          </button>
        ))}
      </div>

      <div>
        <Button
          variant="primary"
          icon={<Sparkles className="size-4" />}
          loading={generating}
          disabled={prompt.trim() === ""}
          onClick={() => onGenerate(prompt.trim())}
        >
          {generating ? "Drafting…" : "Generate"}
        </Button>
      </div>
    </div>
  );
}
