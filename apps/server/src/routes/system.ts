import { hostname } from "node:os";
import type { SystemInfo } from "@cronrunner/shared";
import { Hono } from "hono";
import { APP_VERSION, DATA_DIR } from "../config";
import * as db from "../db/db";
import { isSchedulerRunning } from "../scheduler/scheduler";

export const systemRoute = new Hono();
const bootedAt = Date.now();

systemRoute.get("/", (c) => {
  const jobs = db.listJobs();
  const info: SystemInfo = {
    version: APP_VERSION,
    platform: process.platform as SystemInfo["platform"],
    hostname: hostname(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dataDir: DATA_DIR,
    uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000),
    schedulerRunning: isSchedulerRunning(),
    jobCount: jobs.length,
    enabledJobCount: jobs.filter((j) => j.enabled).length,
  };
  return c.json(info);
});
