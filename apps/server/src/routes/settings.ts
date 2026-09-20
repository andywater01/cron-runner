/**
 * /api/settings
 *   GET   /              settings + key status (never the keys)
 *   PATCH /              update settings and/or keys
 *   POST  /test-llm      { provider, apiKey?, model? } -> { ok } or 400 with a friendly message
 */

import { LlmProviderSchema, UpdateSettingsInputSchema } from "@cronrunner/shared";
import { Hono } from "hono";
import { z } from "zod";
import { getLlmClient } from "../llm/provider";
import { getSettingsResponse, updateSettings } from "../settings";
import { HttpError, parseBody } from "./util";

export const settingsRoute = new Hono();

settingsRoute.get("/", (c) => c.json(getSettingsResponse()));

settingsRoute.patch("/", async (c) => {
  const input = await parseBody(c, UpdateSettingsInputSchema);
  return c.json(updateSettings(input));
});

settingsRoute.post("/test-llm", async (c) => {
  const input = await parseBody(
    c,
    z.object({
      provider: LlmProviderSchema,
      apiKey: z.string().optional(),
      model: z.string().optional(),
    }),
  );
  try {
    await getLlmClient(input).testConnection();
    return c.json({ ok: true });
  } catch (err) {
    throw new HttpError(400, "llm_test_failed", err instanceof Error ? err.message : String(err));
  }
});
