import type { LlmProvider, Shell } from "@cronrunner/shared";
import clsx from "clsx";
import { useState } from "react";
import { ProviderCard } from "@/components/settings/ProviderCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { useTheme } from "@/hooks/useTheme";

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const SHELLS: Shell[] = ["auto", "bash", "zsh", "sh", "powershell", "cmd"];

export function SettingsPage() {
  const { data: settings, isPending, isError } = useSettings();
  const update = useUpdateSettings();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const system = useSystemInfo();
  const [retention, setRetention] = useState<string | null>(null);

  if (isError) {
    return (
      <>
        <PageHeader title="Settings" />
        <EmptyState title="Could not load settings" description="The daemon may not be running." />
      </>
    );
  }

  if (isPending || !settings) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Stored on this machine, never sent anywhere else." />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader
            title="AI provider"
            subtitle="Used to draft jobs from a description and explain failures."
          />
          <CardBody>
            <ProviderCard
              settings={settings}
              saving={update.isPending}
              onChangeProvider={(provider: LlmProvider) => update.mutate({ llm: { provider } })}
              onSaveKey={(provider, key) => {
                update.mutate(
                  provider === "anthropic" ? { anthropicApiKey: key } : { openaiApiKey: key },
                  { onSuccess: () => toast.success("API key saved") },
                );
              }}
              onClearKey={(provider) => {
                update.mutate(
                  provider === "anthropic" ? { anthropicApiKey: "" } : { openaiApiKey: "" },
                  { onSuccess: () => toast.info("API key removed") },
                );
              }}
              onChangeModel={(model) => {
                if (model !== settings.llm.model) update.mutate({ llm: { model } });
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Execution" subtitle="Defaults applied when jobs run." />
          <CardBody className="grid grid-cols-2 gap-4">
            <Select
              label="Default shell for new jobs"
              value={settings.defaultShell}
              onChange={(e) => update.mutate({ defaultShell: e.target.value as Shell })}
            >
              {SHELLS.map((s) => (
                <option key={s} value={s}>
                  {s === "auto" ? "Auto (recommended)" : s}
                </option>
              ))}
            </Select>
            <Input
              label="Runs kept per job"
              type="number"
              min={10}
              max={10000}
              value={retention ?? String(settings.runRetentionPerJob)}
              hint="Older runs are pruned automatically."
              onChange={(e) => setRetention(e.target.value)}
              onBlur={() => {
                const next = Number(retention);
                setRetention(null);
                if (!retention || Number.isNaN(next) || next === settings.runRetentionPerJob)
                  return;
                if (next < 10 || next > 10000) {
                  toast.error("Keep between 10 and 10,000 runs per job");
                  return;
                }
                update.mutate({ runRetentionPerJob: next });
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Appearance" />
          <CardBody>
            <div className="inline-flex items-center gap-1 rounded-lg border border-default bg-surface p-0.5">
              {THEMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setTheme(option.value);
                    update.mutate({ theme: option.value });
                  }}
                  aria-pressed={theme === option.value}
                  className={clsx(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    theme === option.value
                      ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                      : "text-muted hover:text-default",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="About" />
          <CardBody>
            <dl className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Version</dt>
                <dd className="font-mono text-default">{system.data?.version ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Platform</dt>
                <dd className="text-default">
                  {system.data ? `${system.data.platform} · ${system.data.hostname}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Timezone</dt>
                <dd className="text-default">{system.data?.timezone ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-muted">Data directory</dt>
                <dd className="truncate font-mono text-default" title={system.data?.dataDir}>
                  {system.data?.dataDir ?? "—"}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
