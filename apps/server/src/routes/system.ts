import { hostname } from "node:os";
import type { SystemInfo } from "@cronrunner/shared";
import { Hono } from "hono";
import * as autostart from "../autostart";
import { APP_VERSION, DATA_DIR } from "../config";
import * as db from "../db/db";
import { getMissedAtStartup, isSchedulerRunning } from "../scheduler/scheduler";
import { HttpError } from "./util";

export const systemRoute = new Hono();
const bootedAt = Date.now();

systemRoute.get("/", async (c) => {
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
    missedRuns: getMissedAtStartup(),
    autostart: await autostart.status(),
  };
  return c.json(info);
});

/** Start at login: read, enable, disable. */
systemRoute.get("/autostart", async (c) => c.json(await autostart.status()));

systemRoute.post("/autostart", async (c) => {
  try {
    return c.json(await autostart.install());
  } catch (err) {
    throw new HttpError(
      400,
      "autostart_failed",
      err instanceof Error ? err.message : "Could not set up start at login",
    );
  }
});

systemRoute.delete("/autostart", async (c) => {
  try {
    return c.json(await autostart.uninstall());
  } catch (err) {
    throw new HttpError(
      400,
      "autostart_failed",
      err instanceof Error ? err.message : "Could not remove start at login",
    );
  }
});
