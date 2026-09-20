import { beforeAll, describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { useInMemoryDb } from "../db/db";

const app = createApp();

beforeAll(() => {
  useInMemoryDb();
});

describe("jobs API", () => {
  test("creates and lists a job", async () => {
    const res = await app.request("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Echo", schedule: "0 9 * * *", command: "echo hi" }),
    });
    expect(res.status).toBe(201);
    const job = (await res.json()) as { scheduleHuman: string };
    expect(job.scheduleHuman).toContain("9:00 AM");

    const list = await (await app.request("/api/jobs")).json();
    expect(list).toHaveLength(1);
  });

  test("rejects an invalid schedule", async () => {
    const res = await app.request("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bad", schedule: "not a cron", command: "echo hi" }),
    });
    expect(res.status).toBe(400);
  });
});
