import { describe, expect, test } from "bun:test";
import { AiDiagnoseRunResponseSchema, AiJobDraftSchema } from "@cronrunner/shared";
import { toProviderJsonSchema } from "../llm/jsonSchema";

describe("toProviderJsonSchema", () => {
  const schema = toProviderJsonSchema(AiJobDraftSchema);

  test("marks every property required", () => {
    const properties = Object.keys(schema.properties as Record<string, unknown>);
    expect(schema.required).toEqual(properties);
  });

  test("forbids extra properties", () => {
    expect(schema.additionalProperties).toBe(false);
  });

  test("drops keywords the providers reject in strict mode", () => {
    // AiJobDraftSchema caps name at 120 chars; that must not reach the provider.
    const json = JSON.stringify(schema);
    for (const keyword of ["minLength", "maxLength", "minimum", "maximum", "pattern", "format"]) {
      expect(json).not.toContain(keyword);
    }
  });

  test("keeps types, enums and nullability", () => {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.name?.type).toBe("string");
    expect(props.shell?.enum).toContain("powershell");
    // timezone is string | null
    expect(JSON.stringify(props.timezone)).toContain("null");
  });

  test("works for the diagnosis schema too", () => {
    const diagnosis = toProviderJsonSchema(AiDiagnoseRunResponseSchema);
    expect(diagnosis.required).toContain("suggestedCommand");
    expect(diagnosis.additionalProperties).toBe(false);
  });
});
