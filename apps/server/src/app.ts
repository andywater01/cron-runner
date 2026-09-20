/**
 * Hono application: mounts API routes and (in production) serves the built web UI.
 * Exported separately from index.ts so tests can hit it with app.request().
 */

import { API_PREFIX } from "@cronrunner/shared";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { aiRoute } from "./routes/ai";
import { eventsRoute } from "./routes/events";
import { jobsRoute } from "./routes/jobs";
import { runsRoute } from "./routes/runs";
import { settingsRoute } from "./routes/settings";
import { systemRoute } from "./routes/system";
import { apiError, HttpError } from "./routes/util";

export function createApp(opts: { staticDir?: string } = {}) {
  const app = new Hono();
  app.use("*", logger());

  app.onError((err, c) => {
    if (err instanceof HttpError)
      return apiError(c, err.status, err.code, err.message, err.details);
    console.error("[api] unhandled error", err);
    return apiError(c, 500, "internal_error", err instanceof Error ? err.message : "Unknown error");
  });

  app.get(`${API_PREFIX}/health`, (c) => c.json({ ok: true }));
  app.route(`${API_PREFIX}/system`, systemRoute);
  app.route(`${API_PREFIX}/jobs`, jobsRoute);
  app.route(`${API_PREFIX}/runs`, runsRoute);
  app.route(`${API_PREFIX}/settings`, settingsRoute);
  app.route(`${API_PREFIX}/ai`, aiRoute);
  app.route(`${API_PREFIX}/events`, eventsRoute);
  app.notFound((c) =>
    c.req.path.startsWith(API_PREFIX)
      ? apiError(c, 404, "not_found", `No route for ${c.req.method} ${c.req.path}`)
      : c.text("Not found", 404),
  );

  // Production: serve the built SPA from apps/server/public (copied there by the web build).
  if (opts.staticDir) {
    app.use("/*", serveStatic({ root: opts.staticDir }));
    app.get("/*", serveStatic({ root: opts.staticDir, path: "index.html" }));
  }
  return app;
}
