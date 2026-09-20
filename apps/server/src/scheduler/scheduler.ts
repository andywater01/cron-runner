/**
 * In-process scheduler built on croner.
 *
 * One Cron instance per enabled job. Reload a job's schedule whenever it changes.
 * Overlap policy: if a job is still running when its next tick fires, the tick is skipped
 * (croner `protect: true`) and a warning is logged.
 *
 * Missed runs while the daemon was not running are NOT replayed in v1 (see PRD "Non-goals").
 */

import type { Job } from "@cronrunner/shared";
import { Cron } from "croner";
import cronstrue from "cronstrue";
import * as db from "../db/db";
import { getSettings } from "../settings";
import { executeJob, isJobRunning } from "./executor";

const crons = new Map<string, Cron>();
let started = false;

export function isSchedulerRunning(): boolean {
  return started;
}

export function start(): void {
  if (started) return;
  started = true;
  for (const job of db.listJobs()) schedule(job);
  console.log(`[scheduler] started with ${crons.size} active job(s)`);
}

export function stop(): void {
  for (const c of crons.values()) c.stop();
  crons.clear();
  started = false;
}

/** (Re)register a job. Call after create/update. Unschedules disabled jobs. */
export function schedule(job: Job): void {
  unschedule(job.id);
  if (!job.enabled) return;
  try {
    const cron = new Cron(
      job.schedule,
      { timezone: job.timezone ?? undefined, protect: true, name: job.id, catch: true },
      async () => {
        const fresh = db.getJob(job.id);
        if (!fresh?.enabled) return;
        if (isJobRunning(fresh.id)) {
          console.warn(`[scheduler] skipping "${fresh.name}": previous run still active`);
          return;
        }
        await executeJob(fresh, "schedule");
        db.pruneRuns(fresh.id, getSettings().runRetentionPerJob);
      },
    );
    crons.set(job.id, cron);
  } catch (err) {
    console.error(`[scheduler] invalid schedule for job ${job.id} (${job.schedule})`, err);
  }
}

export function unschedule(jobId: string): void {
  crons.get(jobId)?.stop();
  crons.delete(jobId);
}

export function nextRunAt(job: Job): string | null {
  const c = crons.get(job.id);
  if (c) return c.nextRun()?.toISOString() ?? null;
  // Disabled job: still compute what it *would* be, for display.
  try {
    return (
      new Cron(job.schedule, { timezone: job.timezone ?? undefined }).nextRun()?.toISOString() ??
      null
    );
  } catch {
    return null;
  }
}

/** Next N occurrences, for the schedule preview in the editor. */
export function previewRuns(schedule: string, timezone: string | null, count = 5): string[] {
  const c = new Cron(schedule, { timezone: timezone ?? undefined });
  return c.nextRuns(count).map((d) => d.toISOString());
}

export function describeSchedule(schedule: string): string {
  try {
    return cronstrue.toString(schedule, { use24HourTimeFormat: false, verbose: false });
  } catch {
    return "Invalid schedule";
  }
}

export function validateSchedule(schedule: string): { valid: boolean; error?: string } {
  try {
    new Cron(schedule);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}
