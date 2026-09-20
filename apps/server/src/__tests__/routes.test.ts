/**
 * Exercises the HTTP surface, especially the documented error codes in docs/API.md.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import type { ApiError, JobWithStatus, SettingsResponse } from "@cronrunner/shared";
import { createApp } from "../app";
import { useInMemoryDb } from "../db/db";

const app = createApp();

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function createJob(overrides: Record<string, unknown> = {}) {
  const res = await app.request(
    "/api/jobs",
    json({ name: "test", schedule: "0 9 * * *", command: "echo hi", ...overrides }),
  );
  return (await res.json()) as { id: string; name: string; enabled: boolean };
}

beforeEach(() => {
  useInMemoryDb();
});

describe("error codes", () => {
  test("invalid_json for a malformed body", async () => {
    const res = await app.request("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error.code).toBe("invalid_json");
  });

  test("validation_error names the offending fields", async () => {
    const res = await app.request(
      "/api/jobs",
      json({ name: "", schedule: "0 9 * * *", command: "" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiError & {
      error: { details: { fieldErrors: Record<string, string[]> } };
    };
    expect(body.error.code).toBe("validation_error");
    expect(Object.keys(body.error.details.fieldErrors)).toEqual(
      expect.arrayContaining(["name", "command"]),
    );
  });

  test("invalid_schedule for a cron the scheduler rejects", async () => {
    const res = await app.request(
      "/api/jobs",
      json({ name: "x", schedule: "99 99 * * *", command: "echo" }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error.code).toBe("invalid_schedule");
  });

  test("not_found for unknown jobs and runs", async () => {
    for (const path of ["/api/jobs/nope", "/api/runs/nope"]) {
      const res = await app.request(path);
      expect(res.status).toBe(404);
      expect(((await res.json()) as ApiError).error.code).toBe("not_found");
    }
  });

  test("not_running when killing a run that is not active", async () => {
    const res = await app.request("/api/runs/whatever/kill", { method: "POST" });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ApiError).error.code).toBe("not_running");
  });

  test("llm_not_configured when no API key is set", async () => {
    const res = await app.request("/api/ai/generate-job", json({ prompt: "back up my files" }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error.code).toBe("llm_not_configured");
  });

  test("unknown API routes return a JSON not_found", async () => {
    const res = await app.request("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(((await res.json()) as ApiError).error.code).toBe("not_found");
  });
});

describe("jobs", () => {
  test("create returns 201 with derived status fields", async () => {
    const res = await app.request(
      "/api/jobs",
      json({ name: "Nightly", schedule: "0 2 * * *", command: "echo hi" }),
    );
    expect(res.status).toBe(201);
    const job = (await res.json()) as JobWithStatus;
    expect(job.scheduleHuman).toContain("02:00");
    expect(job.nextRunAt).toBeTruthy();
    expect(job.lastRun).toBeNull();
    expect(job.isRunning).toBe(false);
  });

  test("enable and disable flip the flag and the next run", async () => {
    const job = await createJob();
    const disabled = (await (
      await app.request(`/api/jobs/${job.id}/disable`, { method: "POST" })
    ).json()) as JobWithStatus;
    expect(disabled.enabled).toBe(false);
    expect(disabled.nextRunAt).toBeNull();

    const enabled = (await (
      await app.request(`/api/jobs/${job.id}/enable`, { method: "POST" })
    ).json()) as JobWithStatus;
    expect(enabled.enabled).toBe(true);
    expect(enabled.nextRunAt).toBeTruthy();
  });

  test("patch applies a partial update", async () => {
    const job = await createJob();
    const res = await app.request(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });
    const updated = (await res.json()) as JobWithStatus;
    expect(updated.name).toBe("Renamed");
    expect(updated.command).toBe("echo hi");
  });

  test("delete returns 204 and the job is gone", async () => {
    const job = await createJob();
    expect((await app.request(`/api/jobs/${job.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await app.request(`/api/jobs/${job.id}`)).status).toBe(404);
  });

  test("validate-schedule explains a good cron and rejects a bad one", async () => {
    type Validation = { valid: boolean; error?: string; human: string | null; next: string[] };
    const ok = (await (
      await app.request(
        "/api/jobs/validate-schedule",
        json({ schedule: "0 9 * * 1-5", timezone: null }),
      )
    ).json()) as Validation;
    expect(ok.valid).toBe(true);
    expect(ok.human).toContain("Monday");
    expect(ok.next).toHaveLength(5);

    const bad = (await (
      await app.request("/api/jobs/validate-schedule", json({ schedule: "nope", timezone: null }))
    ).json()) as Validation;
    expect(bad.valid).toBe(false);
    expect(bad.error ?? "").toContain("five space-separated fields");
  });
});

describe("settings", () => {
  test("never returns the API key, only whether one is set", async () => {
    await app.request("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anthropicApiKey: "sk-ant-secret-value-9876" }),
    });
    const res = await app.request("/api/settings");
    const raw = await res.text();
    expect(raw).not.toContain("sk-ant-secret-value-9876");
    const body = JSON.parse(raw) as SettingsResponse;
    expect(body.keys.anthropic.configured).toBe(true);
    expect(body.keys.anthropic.last4).toBe("9876");

    // Clean up so the developer's real settings file is not left with a test key.
    await app.request("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anthropicApiKey: "" }),
    });
  });
});

describe("system", () => {
  test("reports platform, scheduler state and autostart support", async () => {
    const info = (await (await app.request("/api/system")).json()) as {
      platform: string;
      autostart: { supported: boolean };
      version: string;
    };
    expect(["darwin", "win32", "linux"]).toContain(info.platform);
    expect(typeof info.autostart.supported).toBe("boolean");
    expect(info.version).toBeTruthy();
  });

  test("health is a plain ok", async () => {
    expect(await (await app.request("/api/health")).json()).toEqual({ ok: true });
  });
});
