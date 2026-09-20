/**
 * Preloaded before every test (see bunfig.toml).
 *
 * Points CronRunner at a throwaway data directory so the suite can never read or write the
 * developer's real jobs database, settings file or API keys.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.env.CRONRUNNER_DATA_DIR) {
  process.env.CRONRUNNER_DATA_DIR = mkdtempSync(join(tmpdir(), "cronrunner-test-"));
}
