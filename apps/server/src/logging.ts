/**
 * Mirrors console output to DATA_DIR/logs/cronrunner.log so there is a record of what the
 * daemon did while nobody was watching — it usually runs in the background with no terminal.
 *
 * Size-based rotation: at MAX_LOG_BYTES the current file becomes cronrunner.1.log and a fresh
 * one starts, keeping at most MAX_LOG_FILES generations. Job stdout/stderr is not written here;
 * that lives in the database, per run.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { LOG_DIR } from "./config";

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_LOG_FILES = 3;

const LOG_FILE = join(LOG_DIR, "cronrunner.log");

function rotateIfNeeded(): void {
  try {
    if (!existsSync(LOG_FILE) || statSync(LOG_FILE).size < MAX_LOG_BYTES) return;
    // Drop the oldest, shift the rest down, then move the current file to .1.
    const oldest = join(LOG_DIR, `cronrunner.${MAX_LOG_FILES}.log`);
    if (existsSync(oldest)) rmSync(oldest, { force: true });
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const from = join(LOG_DIR, `cronrunner.${i}.log`);
      if (existsSync(from)) renameSync(from, join(LOG_DIR, `cronrunner.${i + 1}.log`));
    }
    renameSync(LOG_FILE, join(LOG_DIR, "cronrunner.1.log"));
  } catch {
    // Never let logging break the daemon.
  }
}

function write(level: string, args: unknown[]): void {
  try {
    const text = args
      .map((a) =>
        typeof a === "string" ? a : a instanceof Error ? (a.stack ?? a.message) : JSON.stringify(a),
      )
      .join(" ");
    rotateIfNeeded();
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${level} ${text}\n`);
  } catch {
    // Disk full, permissions, read-only volume: keep running regardless.
  }
}

let installed = false;

/** Tee console.log/warn/error to the log file. Safe to call more than once. */
export function installFileLogging(): void {
  if (installed) return;
  installed = true;
  mkdirSync(LOG_DIR, { recursive: true });

  for (const level of ["log", "warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      write(level.toUpperCase(), args);
    };
  }
}

export const LOG_FILE_PATH = LOG_FILE;
