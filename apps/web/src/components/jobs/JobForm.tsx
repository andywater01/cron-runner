import type { CreateJobInput, Job, Shell } from "@cronrunner/shared";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { EnvVarsEditor } from "./EnvVarsEditor";
import { ScheduleField } from "./ScheduleField";
import { TagsInput } from "./TagsInput";
import { TimezoneSelect } from "./TimezoneSelect";
import type { ScheduleValidation } from "./types";

export type JobFormValues = CreateJobInput;
export type FieldErrors = Partial<Record<keyof JobFormValues, string>>;

const SHELLS: { value: Shell; label: string }[] = [
  { value: "auto", label: "Auto (recommended)" },
  { value: "bash", label: "bash" },
  { value: "zsh", label: "zsh" },
  { value: "sh", label: "sh" },
  { value: "powershell", label: "PowerShell" },
  { value: "cmd", label: "cmd.exe" },
];

export function emptyJobValues(defaultShell: Shell = "auto"): JobFormValues {
  return {
    name: "",
    description: "",
    schedule: "0 9 * * *",
    timezone: null,
    command: "",
    cwd: null,
    shell: defaultShell,
    env: {},
    timeoutSeconds: null,
    enabled: true,
    tags: [],
    source: "manual",
  };
}

/** Strip server-managed fields so an existing job can seed the form. */
export function jobToFormValues(job: Job): JobFormValues {
  const { id: _id, createdAt: _c, updatedAt: _u, ...values } = job;
  return values;
}

export interface JobFormProps {
  values: JobFormValues;
  onChange: (patch: Partial<JobFormValues>) => void;
  errors: FieldErrors;
  validation: ScheduleValidation | undefined;
  validating: boolean;
  onExplainCron?: () => void;
}

export function JobForm({
  values,
  onChange,
  errors,
  validation,
  validating,
  onExplainCron,
}: JobFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Name"
        required
        value={values.name}
        error={errors.name}
        placeholder="Nightly backup"
        onChange={(e) => onChange({ name: e.target.value })}
      />

      <Input
        label="Description"
        value={values.description}
        error={errors.description}
        placeholder="What this job is for"
        onChange={(e) => onChange({ description: e.target.value })}
      />

      <ScheduleField
        value={values.schedule}
        onChange={(schedule) => onChange({ schedule })}
        validation={validation}
        validating={validating}
        error={errors.schedule}
        onExplain={onExplainCron}
      />

      <TimezoneSelect value={values.timezone} onChange={(timezone) => onChange({ timezone })} />

      <Textarea
        label="Command"
        required
        mono
        rows={6}
        value={values.command}
        error={errors.command}
        placeholder={'echo "hello"'}
        spellCheck={false}
        onChange={(e) => onChange({ command: e.target.value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Working directory"
          value={values.cwd ?? ""}
          error={errors.cwd}
          placeholder="Home directory"
          spellCheck={false}
          onChange={(e) => onChange({ cwd: e.target.value.trim() === "" ? null : e.target.value })}
        />
        <Select
          label="Shell"
          value={values.shell}
          onChange={(e) => onChange({ shell: e.target.value as Shell })}
        >
          {SHELLS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Timeout (seconds)"
        type="number"
        min={1}
        value={values.timeoutSeconds ?? ""}
        error={errors.timeoutSeconds}
        placeholder="No timeout"
        hint="The job is killed if it runs longer than this."
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange({ timeoutSeconds: raw === "" ? null : Number(raw) });
        }}
      />

      <TagsInput value={values.tags} onChange={(tags) => onChange({ tags })} />

      <EnvVarsEditor value={values.env} onChange={(env) => onChange({ env })} />

      <div className="border-t border-default pt-4">
        <Switch
          checked={values.enabled}
          onChange={(enabled) => onChange({ enabled })}
          label="Enabled — run on this schedule"
          showLabel
        />
      </div>
    </div>
  );
}
