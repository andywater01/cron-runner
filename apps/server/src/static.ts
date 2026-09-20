/**
 * Serves the web UI.
 *
 * Compiled binary: assets come from `embedded.gen.ts`, bundled into the executable.
 * From source: they are read from `apps/server/public` on disk.
 * Either way unknown paths fall back to index.html so client-side routes work on reload.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { API_PREFIX } from "@cronrunner/shared";
import type { Hono } from "hono";

type AssetMap = Record<string, string>;

async function loadEmbedded(): Promise<AssetMap | null> {
  try {
    // Present only after scripts/embed.ts has run; absent in a plain source checkout.
    const mod = (await import("./embedded.gen")) as { EMBEDDED_ASSETS?: AssetMap };
    const assets = mod.EMBEDDED_ASSETS;
    return assets && Object.keys(assets).length > 0 ? assets : null;
  } catch {
    return null;
  }
}

export async function mountStatic(
  app: Hono,
  diskDir: string,
): Promise<"embedded" | "disk" | "none"> {
  const embedded = await loadEmbedded();

  if (embedded) {
    const index = embedded["index.html"];
    app.get("/*", async (c) => {
      const path = c.req.path.replace(/^\//, "") || "index.html";
      const file = embedded[path] ?? index;
      if (!file) return c.notFound();
      return new Response(Bun.file(file));
    });
    return "embedded";
  }

  if (!existsSync(join(diskDir, "index.html"))) return "none";

  app.get("/*", async (c) => {
    const path = c.req.path.replace(/^\//, "") || "index.html";
    const candidate = Bun.file(join(diskDir, path));
    if (await candidate.exists()) return new Response(candidate);
    // SPA fallback, but never for API paths (those 404 as JSON elsewhere).
    if (c.req.path.startsWith(API_PREFIX)) return c.notFound();
    return new Response(Bun.file(join(diskDir, "index.html")));
  });
  return "disk";
}
