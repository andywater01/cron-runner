import clsx from "clsx";
import { Ban, Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Switch } from "@/components/ui/Switch";
import { useRunOutput } from "@/hooks/useRunOutput";
import { useKillRun, useRun } from "@/hooks/useRuns";
import { absoluteTime, formatDuration } from "@/lib/format";

type Stream = "stdout" | "stderr";

export interface RunDrawerProps {
  runId: string | null;
  onClose: () => void;
  jobName?: string;
  /** Slot for the Phase 6 AI failure diagnosis. */
  renderDiagnosis?: (runId: string) => React.ReactNode;
}

export function RunDrawer({ runId, onClose, jobName, renderDiagnosis }: RunDrawerProps) {
  const { data: run, isPending } = useRun(runId);
  const output = useRunOutput(runId);
  const killRun = useKillRun();
  const [stream, setStream] = useState<Stream>("stdout");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const text = stream === "stdout" ? output.stdout : output.stderr;
  const isRunning = run?.status === "running";

  // Jump to stderr automatically when a failed run wrote nothing to stdout.
  useEffect(() => {
    if (!run || run.status === "running") return;
    if (run.status !== "success" && !run.stdout.trim() && run.stderr.trim()) setStream("stderr");
    else setStream("stdout");
  }, [run]);

  useEffect(() => {
    if (!autoScroll || !preRef.current) return;
    preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [autoScroll]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the end whenever new output lands
  useEffect(() => {
    if (autoScroll && preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [text, autoScroll]);

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable
    }
  }

  return (
    <Drawer
      open={runId !== null}
      onClose={onClose}
      title={jobName ? `${jobName} — run` : "Run"}
      subtitle={
        run ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{absoluteTime(run.startedAt)}</span>
            <span aria-hidden>·</span>
            <span>{run.trigger === "manual" ? "Manual" : "Scheduled"}</span>
            <span aria-hidden>·</span>
            <span>{formatDuration(run.durationMs)}</span>
            {run.exitCode !== null && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">exit {run.exitCode}</span>
              </>
            )}
          </span>
        ) : undefined
      }
      actions={
        <>
          {run && <StatusBadge status={run.status} />}
          {isRunning && runId && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Ban className="size-3.5" />}
              loading={killRun.isPending}
              onClick={() => killRun.mutate(runId)}
            >
              Kill
            </Button>
          )}
        </>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-default px-5 py-2.5">
          <div className="flex items-center gap-1 rounded-lg border border-default bg-surface p-0.5">
            {(["stdout", "stderr"] as Stream[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStream(s)}
                aria-pressed={stream === s}
                className={clsx(
                  "rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors",
                  stream === s
                    ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                    : "text-muted hover:text-default",
                )}
              >
                {s}
                {s === "stderr" && output.stderr.trim() !== "" && (
                  <span className="ml-1.5 inline-block size-1.5 rounded-full bg-danger align-middle" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {output.live && (
              <Switch
                checked={autoScroll}
                onChange={setAutoScroll}
                label="Follow output"
                size="sm"
                showLabel
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Copy output"
              onClick={copyOutput}
              icon={
                copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />
              }
            />
          </div>
        </div>

        <pre
          ref={preRef}
          className="min-h-0 flex-1 overflow-auto bg-surface-muted px-5 py-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-default"
        >
          {isPending
            ? "Loading…"
            : text.trim() === ""
              ? isRunning
                ? "Waiting for output…"
                : `No ${stream} output.`
              : text}
        </pre>

        {run && renderDiagnosis && run.status !== "success" && run.status !== "running" && (
          <div className="border-t border-default px-5 py-4">{renderDiagnosis(run.id)}</div>
        )}
      </div>
    </Drawer>
  );
}
