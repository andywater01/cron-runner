import type { AiJobDraft } from "@cronrunner/shared";
import { AlertTriangle, MessageCircleQuestion, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export interface AiDraftCalloutProps {
  draft: AiJobDraft;
  onRefine: (instruction: string) => void;
  refining: boolean;
}

/**
 * Sits above the form after a draft is generated: what it does, what to watch out for,
 * and anything the model still wants to know.
 */
export function AiDraftCallout({ draft, onRefine, refining }: AiDraftCalloutProps) {
  const [reply, setReply] = useState("");

  function submit() {
    const text = reply.trim();
    if (!text) return;
    onRefine(text);
    setReply("");
  }

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-card border border-accent-200 bg-accent-50/60 px-4 py-3.5 dark:border-accent-500/30 dark:bg-accent-500/10">
      <div className="flex items-start gap-2">
        <Sparkles
          className="mt-0.5 size-4 shrink-0 text-accent-600 dark:text-accent-300"
          aria-hidden
        />
        <p className="text-xs leading-relaxed text-default">{draft.explanation}</p>
      </div>

      {draft.warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-accent-200/70 pt-2.5 dark:border-accent-500/20">
          {draft.warnings.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-2 text-xs leading-relaxed text-warning"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}

      {draft.clarifyingQuestions.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-accent-200/70 pt-2.5 dark:border-accent-500/20">
          <ul className="flex flex-col gap-1">
            {draft.clarifyingQuestions.map((question) => (
              <li
                key={question}
                className="flex items-start gap-2 text-xs leading-relaxed text-muted"
              >
                <MessageCircleQuestion className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-accent-200/70 pt-2.5 dark:border-accent-500/20">
        <input
          type="text"
          value={reply}
          aria-label="Ask for a change"
          placeholder="Ask for a change — “make it 7pm”, “skip weekends”"
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className="h-8 flex-1 rounded-lg border border-default bg-surface px-3 text-xs text-default placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-500/40"
        />
        <Button
          size="sm"
          variant="secondary"
          loading={refining}
          disabled={reply.trim() === ""}
          onClick={submit}
        >
          Update
        </Button>
      </div>
    </div>
  );
}
