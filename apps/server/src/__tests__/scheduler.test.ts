import { describe, expect, test } from "bun:test";
import { describeSchedule, previewRuns, validateSchedule } from "../scheduler/scheduler";

describe("schedule helpers", () => {
  test("validates a good expression", () => {
    expect(validateSchedule("0 9 * * 1-5").valid).toBe(true);
  });
  test("rejects a bad expression", () => {
    expect(validateSchedule("99 99 * *").valid).toBe(false);
  });
  test("describes in English", () => {
    expect(describeSchedule("0 9 * * 1-5")).toContain("9:00 AM");
  });
  test("previews next runs", () => {
    expect(previewRuns("*/5 * * * *", null, 3)).toHaveLength(3);
  });
});
