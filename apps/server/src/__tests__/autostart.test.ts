import { describe, expect, test } from "bun:test";
import { status } from "../autostart";

describe("autostart", () => {
  test("refuses to register when running from source", async () => {
    // Under `bun test` the executable is bun itself, so registering a login item would
    // point at the wrong binary. It must report unsupported with a reason instead.
    const result = await status();
    expect(result.supported).toBe(false);
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain("compiled");
  });

  test("still reports where the registration would live", async () => {
    const result = await status();
    if (process.platform === "darwin") {
      expect(result.location).toContain("LaunchAgents");
    } else if (process.platform === "linux") {
      expect(result.location).toContain("systemd");
    }
  });
});
