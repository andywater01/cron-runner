import type { AiJobDraft } from "@cronrunner/shared";
import { CreateJobInputSchema } from "@cronrunner/shared";
import clsx from "clsx";
import { ArrowLeft, Sparkles, SquarePen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AiDraftCallout } from "@/components/ai/AiDraftCallout";
import { AiPromptPanel } from "@/components/ai/AiPromptPanel";
import type { FieldErrors, JobFormValues } from "@/components/jobs/JobForm";
import { emptyJobValues, JobForm, jobToFormValues } from "@/components/jobs/JobForm";
import { JobPreviewCard } from "@/components/jobs/JobPreviewCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { aiErrorMessage, isNotConfigured, useExplainCron, useGenerateJob } from "@/hooks/useAi";
import { useCreateJob, useJob, useUpdateJob } from "@/hooks/useJobs";
import { useScheduleValidation } from "@/hooks/useScheduleValidation";
import { useSettings } from "@/hooks/useSettings";

/** The subset of the form the model reads and writes. */
function toDraftShape(values: JobFormValues): Partial<AiJobDraft> {
  return {
    name: values.name,
    description: values.description,
    schedule: values.schedule,
    timezone: values.timezone,
    command: values.command,
    cwd: values.cwd,
    shell: values.shell,
    timeoutSeconds: values.timeoutSeconds,
    tags: values.tags,
  };
}

export function JobEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const duplicateFrom = searchParams.get("from") ?? undefined;
  const navigate = useNavigate();
  const toast = useToast();

  const isEdit = Boolean(id);
  const sourceId = id ?? duplicateFrom;
  const sourceJob = useJob(sourceId);
  const settings = useSettings();
  const hasKey = Boolean(settings.data?.keys[settings.data.llm.provider]?.configured);

  const [values, setValues] = useState<JobFormValues>(() => emptyJobValues());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dirty, setDirty] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [mode, setMode] = useState<"ai" | "manual">(
    searchParams.get("mode") === "ai" && !isEdit ? "ai" : "manual",
  );
  const [draft, setDraft] = useState<AiJobDraft | null>(null);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  const generate = useGenerateJob();
  const explainCron = useExplainCron();

  // Seed from an existing job (edit or duplicate), or from a command handed over by the
  // run drawer's "apply suggested command".
  useEffect(() => {
    if (seeded) return;
    const suggested = (location.state as { command?: string } | null)?.command;
    if (sourceId) {
      if (!sourceJob.data) return;
      const seed = jobToFormValues(sourceJob.data);
      setValues(
        isEdit
          ? { ...seed, ...(suggested ? { command: suggested } : {}) }
          : { ...seed, name: `${seed.name} (copy)` },
      );
      setSeeded(true);
      if (suggested) setDirty(true);
    } else if (suggested) {
      setValues((prev) => ({ ...prev, command: suggested }));
      setSeeded(true);
      setDirty(true);
    }
  }, [seeded, sourceId, sourceJob.data, isEdit, location.state]);

  const validationQuery = useScheduleValidation(values.schedule, values.timezone);
  const createJob = useCreateJob();
  const updateJob = useUpdateJob(id ?? "");
  const saving = createJob.isPending || updateJob.isPending;

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function change(patch: Partial<JobFormValues>) {
    setValues((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key as keyof JobFormValues];
      return next;
    });
  }

  /**
   * Generate or refine. The current form values go along as `currentDraft`, so edits the
   * user made by hand since the last generate are what the model revises.
   */
  function runGenerate(prompt: string, refining: boolean) {
    generate.mutate(
      {
        prompt,
        currentDraft: refining ? toDraftShape(values) : null,
        history,
      },
      {
        onSuccess: (result) => {
          setDraft(result);
          setValues((prev) => ({
            ...prev,
            name: result.name,
            description: result.description,
            schedule: result.schedule,
            timezone: result.timezone,
            command: result.command,
            cwd: result.cwd,
            shell: result.shell,
            timeoutSeconds: result.timeoutSeconds,
            tags: result.tags,
            source: "ai",
          }));
          setErrors({});
          setDirty(true);
          setMode("manual");
          setHistory((prev) => [
            ...prev,
            { role: "user", content: prompt },
            { role: "assistant", content: result.explanation },
          ]);
        },
      },
    );
  }

  function cancel() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    navigate(isEdit && id ? `/jobs/${id}` : "/jobs");
  }

  async function save() {
    const parsed = CreateJobInputSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof JobFormValues | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    if (validationQuery.data && !validationQuery.data.valid) {
      setErrors({ schedule: validationQuery.data.error ?? "Invalid cron expression" });
      toast.error("That schedule is not valid");
      return;
    }

    try {
      const saved =
        isEdit && id
          ? await updateJob.mutateAsync(parsed.data)
          : await createJob.mutateAsync(parsed.data);
      setDirty(false);
      toast.success(isEdit ? "Job updated" : `Created “${saved.name}”`);
      navigate(`/jobs/${saved.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the job");
    }
  }

  const title = useMemo(() => {
    if (isEdit) return sourceJob.data ? `Edit “${sourceJob.data.name}”` : "Edit job";
    if (duplicateFrom) return "Duplicate job";
    return "New job";
  }, [isEdit, duplicateFrom, sourceJob.data]);

  if (sourceId && sourceJob.isError) {
    return (
      <>
        <PageHeader title="Job not found" />
        <EmptyState
          title="That job no longer exists"
          description="It may have been deleted."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate("/jobs")}>
              Back to jobs
            </Button>
          }
        />
      </>
    );
  }

  const loadingSource = Boolean(sourceId) && sourceJob.isPending;
  const generateError = generate.isError
    ? isNotConfigured(generate.error)
      ? null
      : aiErrorMessage(generate.error)
    : null;

  return (
    <>
      <PageHeader
        title={title}
        subtitle="Runs on this machine with your user account."
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="size-3.5" />}
              onClick={cancel}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={save}
              disabled={loadingSource}
            >
              {isEdit ? "Save changes" : "Create job"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {!isEdit && (
            <div className="mb-5 inline-flex items-center gap-1 rounded-lg border border-default bg-surface p-0.5">
              {(
                [
                  { value: "ai", label: "Describe with AI", icon: Sparkles },
                  { value: "manual", label: "Manual", icon: SquarePen },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setMode(tab.value)}
                  aria-pressed={mode === tab.value}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    mode === tab.value
                      ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                      : "text-muted hover:text-default",
                  )}
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {mode === "ai" ? (
            <AiPromptPanel
              hasKey={hasKey}
              generating={generate.isPending}
              error={generateError}
              onGenerate={(prompt) => runGenerate(prompt, false)}
            />
          ) : loadingSource ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length loading placeholder
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              {draft && (
                <AiDraftCallout
                  draft={draft}
                  refining={generate.isPending}
                  onRefine={(instruction) => runGenerate(instruction, true)}
                />
              )}
              {generateError && <p className="mb-4 text-xs text-danger">{generateError}</p>}
              <JobForm
                values={values}
                onChange={change}
                errors={errors}
                validation={validationQuery.data}
                validating={validationQuery.isFetching}
                onExplainCron={
                  hasKey
                    ? () =>
                        explainCron.mutate(values.schedule, {
                          onSuccess: (res) => toast.info(res.text),
                          onError: (err) => toast.error(aiErrorMessage(err)),
                        })
                    : undefined
                }
              />
            </>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-8">
            <JobPreviewCard
              values={values}
              validation={validationQuery.data}
              validating={validationQuery.isFetching}
            />
          </div>
        </div>
      </div>
    </>
  );
}
