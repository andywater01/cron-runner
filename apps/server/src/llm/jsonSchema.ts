/**
 * Turns a zod schema into the JSON Schema dialect both providers accept for structured output.
 *
 * Why not the SDKs' zod helpers? They disagree: Anthropic's `zodOutputFormat` converts through
 * zod v4, OpenAI's `zodTextFormat` through a vendored v3 converter. Generating the schema here
 * keeps one code path, one source of truth, and no dependency on either helper's zod flavour.
 *
 * Both providers' strict modes accept only a subset of JSON Schema: every object must list all
 * of its properties as `required` and set `additionalProperties: false`, and validation keywords
 * such as `minLength` or `maximum` are rejected. Those constraints are dropped here and enforced
 * afterwards by parsing the model's reply with the zod schema itself, which is where they belong:
 * a length cap should not make a whole response invalid at the provider.
 */
import { z } from "zod/v4";

/** Keywords neither provider allows inside a strict structured-output schema. */
const UNSUPPORTED_KEYWORDS = new Set([
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
  "default",
  "$schema",
]);

type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (!isPlainObject(node)) return node;

  const out: JsonObject = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    out[key] = sanitize(value);
  }

  if (isPlainObject(out.properties)) {
    // Strict mode: every property must be required and no extras may be invented.
    out.required = Object.keys(out.properties);
    out.additionalProperties = false;
  }
  return out;
}

/**
 * JSON Schema for a model's response. `io: "output"` describes what the schema produces,
 * which is what the model has to emit.
 */
export function toProviderJsonSchema(schema: z.ZodType): JsonObject {
  const raw = z.toJSONSchema(schema, { io: "output", target: "draft-2020-12" }) as JsonObject;
  return sanitize(raw) as JsonObject;
}
