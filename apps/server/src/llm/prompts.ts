/**
 * Prompt text shared by both providers. Keep provider-agnostic.
 * Everything the model needs about the machine (OS, shell, timezone, home dir) is injected here
 * so it generates commands that actually work on this computer.
 */
import { homedir } from "node:os";
import type { AiGenerateJobInput, Job, Run } from "@cronrunner/shared";

export function systemContext(): string {
  const platform =
    process.platform === "darwin" ? "macOS" : process.platform === "win32" ? "Windows" : "Linux";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const defaultShell = process.platform === "win32" ? "powershell" : "bash";
  return [
    `Operating system: ${platform} (${process.platform} ${process.arch})`,
    `Default shell: ${defaultShell}`,
    `Home directory: ${homedir()}`,
    `Local timezone: ${tz}`,
    `Current local time: ${new Date().toString()}`,
  ].join("\n");
}

export const JOB_BUILDER_SYSTEM_PROMPT = `You are the job builder inside CronRunner, a desktop app that schedules and runs shell commands on the user's own computer using cron expressions.

Your task: turn the user's plain-English request into a complete, ready-to-run scheduled job.

Rules:
- Produce a standard 5-field cron expression (minute hour day-of-month month day-of-week). Use 6 fields only if the user explicitly needs seconds.
- Write the command for the machine described below. Prefer tools that ship with the OS. If a tool is probably not installed (e.g. rsync on Windows, jq), mention it in warnings.
- Use absolute paths. Expand "~" to the home directory given below. Never assume the working directory.
- Prefer non-interactive flags. Commands run unattended with no TTY.
- Never include secrets in the command. If a secret is needed, reference an environment variable and tell the user in warnings.
- For anything destructive (rm, delete, overwrite, force push, drop) add a clear warning.
- Set timezone to null unless the user names a place or zone. Set timeoutSeconds to a sensible value (e.g. 3600) for long tasks, otherwise null.
- If the request is ambiguous in a way that matters (which folder? which days?), make a reasonable assumption, state it in the explanation, and list the question in clarifyingQuestions. Do not refuse to produce a draft.
- The name should be short and descriptive (max 6 words). Tags: 1-3 lowercase single words.
- The explanation must be 1-3 sentences a non-technical person can understand. Say what it does and when, not how the command works.
- Quote every path that could contain a space.
- For a desktop notification or reminder, use the tool native to the OS below: macOS \`osascript -e 'display notification "..." with title "..."'\`, Linux \`notify-send\`, Windows a PowerShell toast. A notification only appears while the user is logged in; say so in warnings.
- To append output to a log file, redirect with \`>>\` and include a timestamp, e.g. \`echo "$(date -Is) ..." >> "$HOME/some.log"\`.
- When checking whether a URL is up, use curl with \`-s\`, \`--max-time\` and \`-o /dev/null -w "%{http_code}"\` rather than downloading the body.
- "Every N minutes" means \`*/N * * * *\`. "Weekdays" means \`1-5\`. Midnight is \`0 0\`, not \`24\`.

Machine context:
`;

export const DIAGNOSE_SYSTEM_PROMPT = `You are a debugging assistant inside CronRunner. A scheduled shell job failed. Given the job definition and the captured stdout/stderr, explain what went wrong in plain English and propose the smallest fix. If a corrected command would fix it, provide it in suggestedCommand, otherwise null.

Machine context:
`;

export const EXPLAIN_CRON_SYSTEM_PROMPT = `Explain the given cron expression in one friendly sentence, then list the next 3 times it would fire relative to the current time given below. Be concise.

Machine context:
`;

// ---------------------------------------------------------------------------
// User message builders (shared by both providers so the wording never drifts)
// ---------------------------------------------------------------------------

/** The user turn for a fresh draft, or for editing the draft already on screen. */
export function refinementUserMessage(input: AiGenerateJobInput): string {
  if (!input.currentDraft) return input.prompt;
  return [
    "Current draft (edit this rather than starting over):",
    JSON.stringify(input.currentDraft, null, 2),
    "",
    `Requested change: ${input.prompt}`,
  ].join("\n");
}

/** The user turn describing a failed run, with output tails kept small. */
export function diagnoseUserMessage(job: Job, run: Run): string {
  return [
    `Job: ${job.name}`,
    `Shell: ${job.shell}  cwd: ${job.cwd ?? "(home)"}`,
    `Command:\n${job.command}`,
    `Exit code: ${run.exitCode}  status: ${run.status}`,
    `--- stdout (tail) ---\n${run.stdout.slice(-8000)}`,
    `--- stderr (tail) ---\n${run.stderr.slice(-8000)}`,
  ].join("\n\n");
}
