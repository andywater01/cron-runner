/**
 * CronRunner daemon entry point.
 *   bun run dev        -> API on http://127.0.0.1:4747 (web dev server proxies to it)
 *   bun run compile    -> single binary that also serves the built UI
 */
import { join } from "node:path";
import { createApp } from "./app";
import { APP_VERSION, DATA_DIR, ensureDataDirs, HOST, PORT } from "./config";
import { getDb, markOrphanedRunsKilled } from "./db/db";
import { installFileLogging, LOG_FILE_PATH } from "./logging";
import * as scheduler from "./scheduler/scheduler";
import { mountStatic } from "./static";

ensureDataDirs();
installFileLogging();
getDb();
const orphaned = markOrphanedRunsKilled();
if (orphaned) console.warn(`[startup] marked ${orphaned} orphaned run(s) as killed`);

scheduler.start();

// Runs that were due while the daemon was stopped are reported, never replayed (see PRD).
const missed = scheduler.findMissedRuns();
scheduler.recordMissedAtStartup(missed);
if (missed.length > 0) {
  console.warn(
    `[startup] ${missed.length} job(s) had a run due while CronRunner was not running: ` +
      missed.map((m) => `${m.name} (${m.missedAt})`).join(", "),
  );
}

const app = createApp();
const staticSource = await mountStatic(app, join(import.meta.dir, "..", "public"));
if (staticSource === "none") {
  console.warn("[startup] no web UI found — run `bun run build` to serve it from this process");
}

const server = Bun.serve({ hostname: HOST, port: PORT, fetch: app.fetch, idleTimeout: 0 });
const url = `http://${HOST}:${server.port}`;
console.log(`CronRunner v${APP_VERSION} listening on ${url} (ui: ${staticSource})`);
console.log(`Data directory: ${DATA_DIR}`);
console.log(`Log file: ${LOG_FILE_PATH}`);

/**
 * Open the UI once the server is listening. Explicit with `--open`, and automatically when
 * launched from a macOS .app bundle or a Windows/Linux desktop entry, where there is no
 * terminal to read the address from — double-clicking the app should just show the app.
 */
const launchedFromDesktop =
  process.execPath.includes(".app/Contents/MacOS/") || process.env.CRONRUNNER_OPEN === "1";

if (process.argv.includes("--open") || launchedFromDesktop) {
  const opener =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  console.log(`[startup] opening ${url} in your browser`);
  try {
    Bun.spawn(opener, { stdout: "ignore", stderr: "ignore" });
  } catch {
    console.warn(`[startup] could not open a browser automatically; visit ${url}`);
  }
}

function shutdown() {
  console.log("[shutdown] stopping scheduler");
  scheduler.stop();
  server.stop(true);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
