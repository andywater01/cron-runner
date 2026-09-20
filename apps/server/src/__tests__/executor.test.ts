import { beforeEach, describe, expect, test } from "bun:test";
import type { Job } from "@cronrunner/shared";
import * as db from "../db/db";
import { useInMemoryDb } from "../db/db";
import {
  executeJob,
  getLiveOutput,
  isJobRunning,
  killRun,
  resolveShell,
} from "../scheduler/executor";

function makeJob(overrides: Partial<Job> = {}): Job {
  const now = new Date().toISOString();
  const job: Job = {
    id: crypto.randomUUID(),
    name: "test",
    description: "",
    schedule: "0 0 * * *",
    timezone: null,
    command: "echo hello",
    cwd: null,
    shell: "auto",
    env: {},
    timeoutSeconds: null,
    enabled: true,
    tags: [],
    source: "manual",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  // executeJob writes a run row referencing this job, so it must exist (foreign key).
  db.insertJob({
    name: job.name,
    description: job.description,
    schedule: job.schedule,
    timezone: job.timezone,
    command: job.command,
    cwd: job.cwd,
    shell: job.shell,
    env: job.env,
    timeoutSeconds: job.timeoutSeconds,
    enabled: job.enabled,
    tags: job.tags,
    source: job.source,
  });
  const stored = db.listJobs().find((j) => j.command === job.command && j.name === job.name);
  return stored ?? job;
}

beforeEach(() => {
  useInMemoryDb();
});

describe("executeJob", () => {
  test("records a successful run with its output", async () => {
    const run = await executeJob(makeJob({ command: "echo hello" }), "manual");
    expect(run.status).toBe("success");
    expect(run.exitCode).toBe(0);
    expect(run.stdout.trim()).toBe("hello");
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("a non-zero exit is a failure, and stderr is captured separately", async () => {
    const run = await executeJob(makeJob({ command: "echo oops >&2; exit 7" }), "manual");
    expect(run.status).toBe("failed");
    expect(run.exitCode).toBe(7);
    expect(run.stderr.trim()).toBe("oops");
    expect(run.stdout).toBe("");
  });

  test("passes env vars and the working directory to the command", async () => {
    const run = await executeJob(
      makeJob({ command: 'echo "$GREETING from $(pwd)"', env: { GREETING: "hi" }, cwd: "/tmp" }),
      "manual",
    );
    expect(run.stdout).toContain("hi from");
    expect(run.stdout).toContain("tmp");
  });

  test("exposes the job and run id to the command", async () => {
    const job = makeJob({ command: "echo $CRONRUNNER_JOB_ID" });
    const run = await executeJob(job, "manual");
    expect(run.stdout.trim()).toBe(job.id);
  });

  test("kills a job that outlives its timeout", async () => {
    const run = await executeJob(makeJob({ command: "sleep 30", timeoutSeconds: 1 }), "manual");
    expect(run.status).toBe("timeout");
    expect(run.durationMs).toBeLessThan(10_000);
  });

  test("a manual kill ends the run as killed", async () => {
    const job = makeJob({ command: "sleep 30" });
    const promise = executeJob(job, "manual");
    // Wait for the run row to exist, then kill it by id.
    await Bun.sleep(300);
    const running = db.listRunsForJob(job.id, 1)[0];
    expect(running).toBeDefined();
    expect(killRun(running?.id ?? "")).toBe(true);
    const run = await promise;
    expect(run.status).toBe("killed");
  });

  test("reports a job as running only while it runs", async () => {
    const job = makeJob({ command: "sleep 1" });
    const promise = executeJob(job, "manual");
    await Bun.sleep(300);
    expect(isJobRunning(job.id)).toBe(true);
    await promise;
    expect(isJobRunning(job.id)).toBe(false);
  });

  test("exposes live output while running and nothing once finished", async () => {
    const job = makeJob({ command: "echo first; sleep 1" });
    const promise = executeJob(job, "manual");
    await Bun.sleep(500);
    const runId = db.listRunsForJob(job.id, 1)[0]?.id ?? "";
    const live = getLiveOutput(runId);
    expect(live?.stdout).toContain("first");
    expect(live?.seq).toBeGreaterThan(0);
    await promise;
    expect(getLiveOutput(runId)).toBeNull();
  });

  test("truncates runaway output instead of growing without limit", async () => {
    // Writes well over the 1 MB per-stream cap.
    const run = await executeJob(
      makeJob({
        command: "for i in $(seq 1 40000); do echo 0123456789012345678901234567890123456789; done",
      }),
      "manual",
    );
    expect(run.status).toBe("success");
    expect(run.stdout).toContain("[output truncated]");
    expect(run.stdout.length).toBeLessThan(1_100_000);
  });

  test("persists the finished run to the database", async () => {
    const job = makeJob({ command: "echo stored" });
    const run = await executeJob(job, "schedule");
    const stored = db.getRun(run.id);
    expect(stored?.status).toBe("success");
    expect(stored?.trigger).toBe("schedule");
    expect(stored?.stdout.trim()).toBe("stored");
  });
});

describe("resolveShell", () => {
  test("uses -c for POSIX shells", () => {
    expect(resolveShell("bash").commandFlag).toBe("-c");
    expect(resolveShell("sh").cmd).toEqual(["sh"]);
  });

  test("uses the right flags for Windows shells", () => {
    expect(resolveShell("powershell").commandFlag).toBe("-Command");
    expect(resolveShell("cmd").commandFlag).toBe("/C");
  });

  test("auto picks a shell that exists on this machine", () => {
    const { cmd } = resolveShell("auto");
    expect(["bash", "sh", "powershell.exe"]).toContain(cmd[0] ?? "");
  });
});
