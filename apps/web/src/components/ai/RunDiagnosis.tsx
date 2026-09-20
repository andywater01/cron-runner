import { useNavigate } from "react-router-dom";
import { aiErrorMessage, isNotConfigured, useDiagnoseRun } from "@/hooks/useAi";
import { useSettings } from "@/hooks/useSettings";
import { AiDiagnosisCard } from "./AiDiagnosisCard";

/**
 * Connects the diagnosis card to the API. Applying a suggested command opens the job
 * editor with that command already filled in.
 */
export function RunDiagnosis({ runId, jobId }: { runId: string; jobId: string }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const diagnose = useDiagnoseRun();
  const hasKey = Boolean(settings.data?.keys[settings.data.llm.provider]?.configured);

  return (
    <AiDiagnosisCard
      hasKey={hasKey}
      diagnosis={diagnose.data}
      loading={diagnose.isPending}
      error={
        diagnose.isError && !isNotConfigured(diagnose.error) ? aiErrorMessage(diagnose.error) : null
      }
      onAsk={() => diagnose.mutate(runId)}
      onApply={(command) => navigate(`/jobs/${jobId}/edit`, { state: { command } })}
    />
  );
}
