import { beforeEach, describe, expect, test } from "bun:test";
import * as db from "../db/db";
import { useInMemoryDb } from "../db/db";

function seedJob(name = "job") {
  return db.insertJob({
    name,
    description: "",
    schedule: "0 9 * * *",
    timezone: null,
    command: "echo hi",
    cwd: null,
    shell: "auto",
    env: {},
    timeoutSeconds: null,
    enabled: true,
    tags: [],
    source: "manual",
  });
}

beforeEach(() => {
  useInMemoryDb();
});

describe("jobs", () => {
  test("round-trips every field, including JSON columns", () => {
    const job = db.insertJob({
      name: "full",
      description: "desc",
      schedule: "*/5 * * * *",
      timezone: "Europe/Berlin",
      command: "echo a\necho b",
      cwd: "/tmp",
      shell: "zsh",
      env: { A: "1", B: "2" },
      timeoutSeconds: 30,
      enabled: false,
      tags: ["x", "y"],
      source: "ai",
    });
    const stored = db.getJob(job.id);
    expect(stored).toEqual(job);
    expect(stored?.env).toEqual({ A: "1", B: "2" });
    expect(stored?.tags).toEqual(["x", "y"]);
    expect(stored?.enabled).toBe(false);
  });

  test("update merges and bumps updatedAt", async () => {
    const job = seedJob();
    await Bun.sleep(5);
    const updated = db.updateJob(job.id, { name: "renamed" });
    expect(updated?.name).toBe("renamed");
    expect(updated?.command).toBe(job.command);
    expect(updated?.updatedAt).not.toBe(job.updatedAt);
  });

  test("update and delete report a missing job", () => {
    expect(db.updateJob("nope", { name: "x" })).toBeNull();
    expect(db.deleteJob("nope")).toBe(false);
  });

  test("deleting a job removes its runs", () => {
    const job = seedJob();
    db.insertRun(job.id, "manual");
    expect(db.listRunsForJob(job.id)).toHaveLength(1);
    expect(db.deleteJob(job.id)).toBe(true);
    expect(db.listRunsForJob(job.id)).toHaveLength(0);
  });
});

describe("runs", () => {
  test("lists newest first and reports the last run", async () => {
    const job = seedJob();
    const first = db.insertRun(job.id, "schedule");
    await Bun.sleep(5);
    const second = db.insertRun(job.id, "manual");
    const runs = db.listRunsForJob(job.id);
    expect(runs[0]?.id).toBe(second.id);
    expect(runs[1]?.id).toBe(first.id);
    expect(db.lastRunForJob(job.id)?.id).toBe(second.id);
  });

  test("summaries leave out the large output columns", () => {
    const job = seedJob();
    const run = db.insertRun(job.id, "manual");
    db.finishRun(run.id, {
      status: "success",
      exitCode: 0,
      stdout: "lots",
      stderr: "",
      durationMs: 5,
    });
    const summary = db.listRunsForJob(job.id)[0] as Record<string, unknown>;
    expect(summary).not.toHaveProperty("stdout");
    expect(db.getRun(run.id)?.stdout).toBe("lots");
  });

  test("prune keeps only the newest N runs of that job", async () => {
    const job = seedJob();
    const other = seedJob("other");
    for (let i = 0; i < 5; i++) {
      db.insertRun(job.id, "schedule");
      await Bun.sleep(2);
    }
    db.insertRun(other.id, "schedule");

    const removed = db.pruneRuns(job.id, 2);
    expect(removed).toBe(3);
    expect(db.listRunsForJob(job.id)).toHaveLength(2);
    // Other jobs are untouched.
    expect(db.listRunsForJob(other.id)).toHaveLength(1);
  });

  test("orphaned runs from a crash are marked killed on startup", () => {
    const job = seedJob();
    const run = db.insertRun(job.id, "schedule");
    expect(db.getRun(run.id)?.status).toBe("running");

    const marked = db.markOrphanedRunsKilled();
    expect(marked).toBe(1);
    const after = db.getRun(run.id);
    expect(after?.status).toBe("killed");
    expect(after?.finishedAt).not.toBeNull();
  });

  test("recent runs span every job", () => {
    const a = seedJob("a");
    const b = seedJob("b");
    db.insertRun(a.id, "manual");
    db.insertRun(b.id, "manual");
    expect(db.listRecentRuns(10)).toHaveLength(2);
  });
});
