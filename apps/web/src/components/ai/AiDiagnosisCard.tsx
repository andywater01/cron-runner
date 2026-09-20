import type { AiDiagnoseRunResponse } from "@cronrunner/shared";
import { AlertTriangle, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { NoKeyCallout } from "./NoKeyCallout";

export interface AiDiagnosisCardProps {
  hasKey: boolean;
  diagnosis: AiDiagnoseRunResponse | undefined;
  loading: boolean;
  error: string | null;
  onAsk: () => void;
  onApply: (command: string) => void;
}

/** "Why did this fail?" panel at the bottom of the run drawer. */
export function AiDiagnosisCard({
  hasKey,
  diagnosis,
  loading,
  error,
  onAsk,
  onApply,
}: AiDiagnosisCardProps) {
  if (!hasKey) return <NoKeyCallout what="explain why a run failed" />;

  if (!diagnosis) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={loading}
          onClick={onAsk}
          icon={<Sparkles className="size-3.5" />}
        >
          {loading ? "Looking at the output…" : "Ask AI why this failed"}
        </Button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-default">{diagnosis.summary}</p>

      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
        <p className="text-xs leading-relaxed text-muted">{diagnosis.likelyCause}</p>
      </div>

      <div className="flex items-start gap-2">
        <Wrench className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
        <p className="text-xs leading-relaxed text-muted">{diagnosis.suggestedFix}</p>
      </div>

      {diagnosis.suggestedCommand && (
        <div className="flex flex-col gap-2">
          <CodeBlock code={diagnosis.suggestedCommand} maxHeight="max-h-32" />
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onApply(diagnosis.suggestedCommand as string)}
            >
              Apply suggested command
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
