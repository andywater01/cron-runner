/**
 * CronRunner daemon entry point.
 *   bun run dev        -> API on http://127.0.0.1:4747 (web dev server proxies to it)
 *   bun run compile    -> single binary that also serves the built UI
 */
import { join } from "node:path";
import { createApp } from "./app";
import { APP_VERSION, DATA_DIR, ensureDataDirs, HOST, PORT } from "./config";
import { getDb, markOrphanedRunsKilled } from "./db/db";
import * as scheduler from "./scheduler/scheduler";
import { mountStatic } from "./static";

ensureDataDirs();
getDb();
const orphaned = markOrphanedRunsKilled();
if (orphaned) console.warn(`[startup] marked ${orphaned} orphaned run(s) as killed`);

scheduler.start();

const app = createApp();
const staticSource = await mountStatic(app, join(import.meta.dir, "..", "public"));
if (staticSource === "none") {
  console.warn("[startup] no web UI found — run `bun run build` to serve it from this process");
}

const server = Bun.serve({ hostname: HOST, port: PORT, fetch: app.fetch, idleTimeout: 0 });
const url = `http://${HOST}:${server.port}`;
console.log(`CronRunner v${APP_VERSION} listening on ${url} (ui: ${staticSource})`);
console.log(`Data directory: ${DATA_DIR}`);

/** `--open` launches the default browser once the server is listening. */
if (process.argv.includes("--open")) {
  const opener =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    Bun.spawn(opener, { stdout: "ignore", stderr: "ignore" });
  } catch {
    console.warn(`[startup] could not open a browser; visit ${url}`);
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
