/**
 * Cross-compiles CronRunner for every supported desktop target.
 *
 * Run `bun run release` from the repo root: it builds the web UI, embeds it, then produces
 * one self-contained binary per target in `apps/server/dist/`.
 *
 * Bun cross-compiles from any host, so a single machine can produce all four.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const TARGETS = [
  { target: "bun-darwin-arm64", out: "cronrunner-macos-arm64" },
  { target: "bun-darwin-x64", out: "cronrunner-macos-x64" },
  { target: "bun-linux-x64", out: "cronrunner-linux-x64" },
  { target: "bun-windows-x64", out: "cronrunner-windows-x64.exe" },
] as const;

const SERVER_DIR = join(import.meta.dir, "..");
const DIST = join(SERVER_DIR, "dist");
mkdirSync(DIST, { recursive: true });

let failures = 0;

for (const { target, out } of TARGETS) {
  const started = Date.now();
  process.stdout.write(`[release] ${target} … `);
  const proc = Bun.spawn(
    [
      "bun",
      "build",
      "src/index.ts",
      "--compile",
      `--target=${target}`,
      "--outfile",
      join(DIST, out),
    ],
    { cwd: SERVER_DIR, stdout: "pipe", stderr: "pipe", stdin: "ignore" },
  );
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;

  if (code === 0) {
    console.log(`ok (${((Date.now() - started) / 1000).toFixed(1)}s) -> dist/${out}`);
  } else {
    failures += 1;
    console.log("FAILED");
    console.error(stderr.trim());
  }
}

if (failures > 0) {
  console.error(`\n[release] ${failures} target(s) failed.`);
  process.exit(1);
}
console.log(`\n[release] built ${TARGETS.length} binaries into apps/server/dist/`);
