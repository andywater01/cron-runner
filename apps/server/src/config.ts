/**
 * Resolves where CronRunner stores its data and how it's configured.
 *
 * Data directory (override with CRONRUNNER_DATA_DIR):
 *   macOS:   ~/Library/Application Support/CronRunner
 *   Windows: %APPDATA%\CronRunner
 *   Linux:   $XDG_DATA_HOME/cronrunner or ~/.local/share/cronrunner
 *
 * Contents:
 *   cronrunner.db   SQLite database (jobs, runs)
 *   settings.json   User settings incl. API keys (0600 permissions on POSIX)
 *   logs/           Daemon log files
 */

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_PORT } from "@cronrunner/shared";
// Single source of truth for the version: the workspace root package.json, which is also
// what the packaging script stamps onto every downloadable file name.
import rootPackage from "../../../package.json" with { type: "json" };

export const APP_VERSION: string = rootPackage.version;

export function resolveDataDir(): string {
  const override = process.env.CRONRUNNER_DATA_DIR;
  if (override) return override;
  const home = homedir();
  switch (process.platform) {
    case "darwin":
      return join(home, "Library", "Application Support", "CronRunner");
    case "win32":
      return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "CronRunner");
    default:
      return join(process.env.XDG_DATA_HOME ?? join(home, ".local", "share"), "cronrunner");
  }
}

export const DATA_DIR = resolveDataDir();
export const DB_PATH = join(DATA_DIR, "cronrunner.db");
export const SETTINGS_PATH = join(DATA_DIR, "settings.json");
export const LOG_DIR = join(DATA_DIR, "logs");
export const PORT = Number(process.env.CRONRUNNER_PORT ?? DEFAULT_PORT);
export const HOST = "127.0.0.1"; // never bind to 0.0.0.0: the API can run arbitrary commands

export function ensureDataDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
}
