/**
 * Runs a single job's command as a child process and records the result.
 *
 * Responsibilities:
 *  - pick the right shell for the platform / job.shell
 *  - stream stdout/stderr (capped) and publish run.output events
 *  - enforce timeoutSeconds (kill on expiry -> status "timeout")
 *  - support manual kill (status "killed")
 *  - write the Run row and publish run.started / run.finished
 *
 * TODO(plan §4.3): implement. Skeleton below shows the intended shape.
 */

import { homedir } from "node:os";
import type { Job, Run, RunTrigger, Shell } from "@cronrunner/shared";
import { MAX_OUTPUT_BYTES_PER_STREAM } from "@cronrunner/shared";
import * as db from "../db/db";
import { publish } from "../events";

/** Active child processes keyed by run id so they can be killed. */
const active = new Map<string, { proc: Bun.Subprocess; jobId: string }>();

export function isJobRunning(jobId: string): boolean {
  for (const v of active.values()) if (v.jobId === jobId) return true;
  return false;
}

export function killRun(runId: string): boolean {
  const entry = active.get(runId);
  if (!entry) return false;
  entry.proc.kill();
  return true;
}

/** Resolve the shell executable + args for a job on this platform. */
export function resolveShell(shell: Shell): { cmd: string[]; commandFlag: string } {
  const isWin = process.platform === "win32";
  const effective: Shell = shell === "auto" ? (isWin ? "powershell" : "bash") : shell;
  switch (effective) {
    case "powershell":
      return { cmd: ["powershell.exe", "-NoProfile", "-NonInteractive"], commandFlag: "-Command" };
    case "cmd":
      return { cmd: ["cmd.exe"], commandFlag: "/C" };
    case "zsh":
      return { cmd: ["zsh", "-l"], commandFlag: "-c" };
    case "sh":
      return { cmd: ["sh"], commandFlag: "-c" };
    default:
      return { cmd: ["bash", "-l"], commandFlag: "-c" };
  }
}

/**
 * Execute a job. Resolves when the process exits. Never throws for command failures
 * (those become status "failed"); only throws for programmer errors.
 */
export async function executeJob(job: Job, trigger: RunTrigger): Promise<Run> {
  const run = db.insertRun(job.id, trigger);
  publish({ type: "run.started", jobId: job.id, runId: run.id });

  const { cmd, commandFlag } = resolveShell(job.shell);
  const startedAt = Date.now();

  let stdout = "";
  let stderr = "";
  let truncatedOut = false;
  let truncatedErr = false;

  const proc = Bun.spawn([...cmd, commandFlag, job.command], {
    cwd: job.cwd ?? homedir(),
    env: { ...process.env, ...job.env, CRONRUNNER_JOB_ID: job.id, CRONRUNNER_RUN_ID: run.id },
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  active.set(run.id, { proc, jobId: job.id });

  let timedOut = false;
  const timer = job.timeoutSeconds
    ? setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, job.timeoutSeconds * 1000)
    : null;

  const pump = async (stream: ReadableStream<Uint8Array>, which: "stdout" | "stderr") => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true });
      if (which === "stdout") {
        if (stdout.length < MAX_OUTPUT_BYTES_PER_STREAM) stdout += text;
        else truncatedOut = true;
      } else {
        if (stderr.length < MAX_OUTPUT_BYTES_PER_STREAM) stderr += text;
        else truncatedErr = true;
      }
      publish({ type: "run.output", runId: run.id, stream: which, chunk: text });
    }
  };

  await Promise.all([pump(proc.stdout, "stdout"), pump(proc.stderr, "stderr")]);
  const exitCode = await proc.exited;
  if (timer) clearTimeout(timer);
  active.delete(run.id);

  if (truncatedOut) stdout += "\n[output truncated]";
  if (truncatedErr) stderr += "\n[output truncated]";

  const status: Run["status"] = timedOut
    ? "timeout"
    : proc.signalCode
      ? "killed"
      : exitCode === 0
        ? "success"
        : "failed";

  const durationMs = Date.now() - startedAt;
  db.finishRun(run.id, { status, exitCode, stdout, stderr, durationMs });
  publish({ type: "run.finished", jobId: job.id, runId: run.id, status });

  return {
    ...run,
    status,
    exitCode,
    stdout,
    stderr,
    durationMs,
    finishedAt: new Date().toISOString(),
  };
}
