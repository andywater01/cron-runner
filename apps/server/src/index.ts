/**
 * CronRunner daemon entry point.
 *   bun run dev        -> API on http://127.0.0.1:4747 (web dev server proxies to it)
 *   bun run compile    -> single binary that also serves the built UI
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";
import { APP_VERSION, DATA_DIR, ensureDataDirs, HOST, PORT } from "./config";
import { getDb, markOrphanedRunsKilled } from "./db/db";
import * as scheduler from "./scheduler/scheduler";

ensureDataDirs();
getDb();
const orphaned = markOrphanedRunsKilled();
if (orphaned) console.warn(`[startup] marked ${orphaned} orphaned run(s) as killed`);

scheduler.start();

// TODO(plan §7.1): when compiled with `bun build --compile`, embed the web build instead of reading from disk.
const staticDir = join(import.meta.dir, "..", "public");
const app = createApp({ staticDir: existsSync(staticDir) ? staticDir : undefined });

const server = Bun.serve({ hostname: HOST, port: PORT, fetch: app.fetch, idleTimeout: 0 });
console.log(`CronRunner v${APP_VERSION} listening on http://${HOST}:${server.port}`);
console.log(`Data directory: ${DATA_DIR}`);

function shutdown() {
  console.log("[shutdown] stopping scheduler");
  scheduler.stop();
  server.stop(true);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
