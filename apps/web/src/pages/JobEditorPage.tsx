import { CreateJobInputSchema } from "@cronrunner/shared";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { FieldErrors, JobFormValues } from "@/components/jobs/JobForm";
import { emptyJobValues, JobForm, jobToFormValues } from "@/components/jobs/JobForm";
import { JobPreviewCard } from "@/components/jobs/JobPreviewCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useCreateJob, useJob, useUpdateJob } from "@/hooks/useJobs";
import { useScheduleValidation } from "@/hooks/useScheduleValidation";

export function JobEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const duplicateFrom = searchParams.get("from") ?? undefined;
  const navigate = useNavigate();
  const toast = useToast();

  const isEdit = Boolean(id);
  const sourceId = id ?? duplicateFrom;
  const sourceJob = useJob(sourceId);

  const [values, setValues] = useState<JobFormValues>(() => emptyJobValues());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dirty, setDirty] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Seed the form once the source job (edit or duplicate) arrives.
  useEffect(() => {
    if (seeded || !sourceId || !sourceJob.data) return;
    const seed = jobToFormValues(sourceJob.data);
    setValues(isEdit ? seed : { ...seed, name: `${seed.name} (copy)` });
    setSeeded(true);
  }, [seeded, sourceId, sourceJob.data, isEdit]);

  const validationQuery = useScheduleValidation(values.schedule, values.timezone);
  const createJob = useCreateJob();
  const updateJob = useUpdateJob(id ?? "");
  const saving = createJob.isPending || updateJob.isPending;

  // Warn before a full page unload with unsaved edits.
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
          {loadingSource ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length loading placeholder
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <JobForm
              values={values}
              onChange={change}
              errors={errors}
              validation={validationQuery.data}
              validating={validationQuery.isFetching}
            />
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
