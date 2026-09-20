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

/**
 * croner's messages are accurate but leak its internals ("CronPattern: ...").
 * Tidy them so the UI can show the text as-is.
 */
function friendlyCronError(raw: string): string {
  const message = raw.replace(/^CronPattern:\s*/i, "").trim();
  if (/exactly five or six space separated parts/i.test(message)) {
    return "A schedule needs five space-separated fields: minute hour day-of-month month day-of-week.";
  }
  return message.charAt(0).toUpperCase() + message.slice(1);
}

export function validateSchedule(schedule: string): { valid: boolean; error?: string } {
  try {
    new Cron(schedule);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: friendlyCronError(err instanceof Error ? err.message : String(err)),
    };
  }
}

/**
 * Jobs whose next run, computed from when they were last changed, has already passed.
 * These fired while the daemon was not running. v1 reports them rather than replaying
 * them: re-running a backup or a cleanup hours late can be worse than skipping it.
 */
let missedAtStartup: { jobId: string; name: string; missedAt: string }[] = [];

/** What `findMissedRuns()` returned when the daemon started. */
export function getMissedAtStartup() {
  return missedAtStartup;
}

export function recordMissedAtStartup(missed: { jobId: string; name: string; missedAt: string }[]) {
  missedAtStartup = missed;
}

export function findMissedRuns(): { jobId: string; name: string; missedAt: string }[] {
  const missed: { jobId: string; name: string; missedAt: string }[] = [];
  for (const job of db.listJobs()) {
    if (!job.enabled) continue;
    const last = db.lastRunForJob(job.id);
    // Look forward from whichever is later: the last run, or the last edit.
    const since = last ? new Date(last.startedAt) : new Date(job.updatedAt);
    try {
      const due = new Cron(job.schedule, { timezone: job.timezone ?? undefined }).nextRun(since);
      if (due && due.getTime() < Date.now()) {
        missed.push({ jobId: job.id, name: job.name, missedAt: due.toISOString() });
      }
    } catch {
      // An unparseable schedule is reported elsewhere.
    }
  }
  return missed;
}
