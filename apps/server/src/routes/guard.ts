/**
 * Protects the API from other web pages.
 *
 * The daemon listens on 127.0.0.1, which stops remote machines but not the browser already
 * running on this one. Any site you visit can issue a "simple" cross-origin POST to
 * http://127.0.0.1:4747 without a CORS preflight. The reply is opaque to that site, but the
 * side effect is not: creating a CronRunner job means running an arbitrary shell command.
 *
 * Browsers attach an `Origin` header to every cross-origin request, including the simple ones
 * that skip preflight. So: reject any request whose Origin is not this machine. Requests with
 * no Origin at all are allowed, which keeps curl, scripts and other non-browser clients working
 * — they were never the risk, since anything that can run curl can already run commands.
 *
 * This is preferred over a shared token: nothing to store, nothing for the UI to fetch first,
 * and no secret that can leak through a log or a screenshot. See docs/ARCHITECTURE.md.
 */
import type { Context, Next } from "hono";
import { apiError } from "./util";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

/** True when the Origin header names this machine. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    return LOCAL_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

export async function originGuard(c: Context, next: Next) {
  const origin = c.req.header("origin");
  // No Origin means a non-browser client; browsers always send one cross-origin.
  if (origin && !isLocalOrigin(origin)) {
    console.warn(`[security] blocked ${c.req.method} ${c.req.path} from origin ${origin}`);
    return apiError(
      c,
      403,
      "forbidden_origin",
      "CronRunner only accepts requests from this machine.",
    );
  }
  return next();
}
