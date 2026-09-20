import type { LlmProvider, SettingsResponse } from "@cronrunner/shared";
import { DEFAULT_MODELS } from "@cronrunner/shared";
import clsx from "clsx";
import { Check, Eye, EyeOff, KeyRound, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTestLlm } from "@/hooks/useSettings";

const PROVIDERS: { value: LlmProvider; label: string; blurb: string }[] = [
  { value: "anthropic", label: "Anthropic", blurb: "Claude models" },
  { value: "openai", label: "OpenAI", blurb: "GPT models" },
];

export interface ProviderCardProps {
  settings: SettingsResponse;
  onChangeProvider: (provider: LlmProvider) => void;
  onSaveKey: (provider: LlmProvider, key: string) => void;
  onClearKey: (provider: LlmProvider) => void;
  onChangeModel: (model: string | null) => void;
  saving: boolean;
}

export function ProviderCard({
  settings,
  onChangeProvider,
  onSaveKey,
  onClearKey,
  onChangeModel,
  saving,
}: ProviderCardProps) {
  const provider = settings.llm.provider;
  const keyStatus = settings.keys[provider];
  const [draftKey, setDraftKey] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [model, setModel] = useState(settings.llm.model ?? "");
  const testLlm = useTestLlm();

  const showKeyInput = replacing || !keyStatus.configured;

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-default">Provider</legend>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((p) => {
            const active = provider === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  onChangeProvider(p.value);
                  setReplacing(false);
                  setDraftKey("");
                  testLlm.reset();
                }}
                aria-pressed={active}
                className={clsx(
                  "flex flex-col items-start gap-0.5 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                  active
                    ? "border-accent-500 bg-accent-50 dark:bg-accent-500/10"
                    : "border-default bg-surface hover:bg-surface-muted",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-default">
                  {p.label}
                  {settings.keys[p.value].configured && <Check className="size-3.5 text-success" />}
                </span>
                <span className="text-[11px] text-muted">{p.blurb}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-default">API key</span>
          {keyStatus.configured && !replacing && (
            <Badge tone="success" dot>
              Configured · ends in {keyStatus.last4}
            </Badge>
          )}
        </div>

        {showKeyInput ? (
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                type={revealed ? "text" : "password"}
                value={draftKey}
                autoComplete="off"
                spellCheck={false}
                placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
                onChange={(e) => setDraftKey(e.target.value)}
                hint="Stored on this machine only, readable by your user account."
              />
            </div>
            <Button
              variant="ghost"
              size="md"
              iconOnly
              aria-label={revealed ? "Hide key" : "Show key"}
              onClick={() => setRevealed((v) => !v)}
              icon={revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            />
            <Button
              variant="primary"
              size="md"
              loading={saving}
              disabled={draftKey.trim() === ""}
              onClick={() => {
                onSaveKey(provider, draftKey.trim());
                setDraftKey("");
                setReplacing(false);
              }}
            >
              Save key
            </Button>
            {replacing && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setReplacing(false);
                  setDraftKey("");
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<KeyRound className="size-3.5" />}
              onClick={() => setReplacing(true)}
            >
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="size-3.5" />}
              onClick={() => {
                onClearKey(provider);
                testLlm.reset();
              }}
            >
              Remove
            </Button>
          </div>
        )}
      </div>

      <Input
        label="Model"
        value={model}
        spellCheck={false}
        autoComplete="off"
        placeholder={DEFAULT_MODELS[provider]}
        hint={`Leave blank to use ${DEFAULT_MODELS[provider]}.`}
        onChange={(e) => setModel(e.target.value)}
        onBlur={() => onChangeModel(model.trim() === "" ? null : model.trim())}
      />

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          loading={testLlm.isPending}
          disabled={!keyStatus.configured && draftKey.trim() === ""}
          onClick={() =>
            testLlm.mutate({
              provider,
              // Test what is typed but not yet saved, so a key can be checked first.
              apiKey: draftKey.trim() || undefined,
              model: model.trim() || undefined,
            })
          }
        >
          Test connection
        </Button>
        {testLlm.isSuccess && (
          <span className="flex items-center gap-1.5 text-xs text-success">
            <Check className="size-3.5" />
            Connected
          </span>
        )}
        {testLlm.isError && (
          <span className="text-xs text-danger">
            {testLlm.error instanceof Error ? testLlm.error.message : "Test failed"}
          </span>
        )}
      </div>
    </div>
  );
}
