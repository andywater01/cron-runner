import type { ApiError } from "@cronrunner/shared";
import type { Context } from "hono";
import { z } from "zod/v4";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function apiError(
  c: Context,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiError = { error: { code, message, details } };
  return c.json(body, status as 400);
}

/** Parse and validate a JSON body; throws HttpError(400) with zod issues on failure. */
export async function parseBody<S extends z.ZodTypeAny>(
  c: Context,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new HttpError(
      400,
      "validation_error",
      "Invalid request body",
      z.flattenError(result.error),
    );
  }
  return result.data;
}
