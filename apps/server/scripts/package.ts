/**
 * Builds every downloadable artifact, version-stamped, into apps/server/dist/.
 *
 *   CronRunner-<version>-macos-arm64.dmg     drag-to-Applications disk image
 *   CronRunner-<version>-macos-x64.dmg
 *   CronRunner-<version>-windows-x64.exe     icon set, no console window
 *   CronRunner-<version>-linux-x64.tar.gz    binary + .desktop entry + install script
 *   SHA256SUMS.txt
 *
 * Each one is self-contained: the Bun runtime, the server and the whole web UI are inside.
 * There is nothing to install alongside them and no separate runtime to download.
 *
 * Platform artifacts have to be built on their own platform to be complete: .dmg needs
 * hdiutil, and Bun's --windows-icon / --windows-hide-console only work when compiling on
 * Windows. Running this on one machine still produces every file, but the ones for other
 * platforms come out plain. The release workflow builds each on its own runner, which is
 * what the published downloads come from. Run `bun run package` from the repo root.
 */
import { chmodSync, cpSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import rootPackage from "../../../package.json" with { type: "json" };

const VERSION = rootPackage.version;
const ROOT = join(import.meta.dir, "..", "..", "..");
const SERVER = join(ROOT, "apps", "server");
const DIST = join(SERVER, "dist");
const STAGE = join(SERVER, ".package");
const ICON_DIR = join(ROOT, "assets", "icon");

const BUNDLE_ID = "com.cronrunner.app";

async function run(cmd: string[], cwd = ROOT): Promise<void> {
  const proc = Bun.spawn(cmd, { cwd, stdout: "ignore", stderr: "pipe", stdin: "ignore" });
  const stderr = await new Response(proc.stderr).text();
  if ((await proc.exited) !== 0) {
    throw new Error(`${cmd.join(" ")}\n${stderr.trim()}`);
  }
}

function mb(path: string): string {
  return `${(statSync(path).size / 1_000_000).toFixed(0)} MB`;
}

/**
 * Compile the daemon for one Bun target. The Windows dressing (icon, no console window,
 * file properties) is only accepted by Bun when the host is Windows, so it is skipped
 * elsewhere and the caller warns about it.
 */
async function compile(target: string, outfile: string, windows = false): Promise<void> {
  const windowsDressing = windows && process.platform === "win32";
  await run(
    [
      "bun",
      "build",
      "src/index.ts",
      "--compile",
      `--target=${target}`,
      ...(windowsDressing
        ? [
            "--windows-hide-console",
            `--windows-icon=${join(ICON_DIR, "icon.ico")}`,
            "--windows-title=CronRunner",
            "--windows-publisher=CronRunner",
            "--windows-description=Schedule and run jobs on your own machine",
            `--windows-version=${VERSION}.0`,
          ]
        : []),
      "--outfile",
      outfile,
    ],
    SERVER,
  );
}

/**
 * Wrap a compiled binary in a macOS .app. The binary detects that it is running inside a
 * bundle and opens the UI itself, so no launcher script is needed.
 */
function buildAppBundle(binary: string, appPath: string): void {
  rmSync(appPath, { recursive: true, force: true });
  const macos = join(appPath, "Contents", "MacOS");
  const resources = join(appPath, "Contents", "Resources");
  mkdirSync(macos, { recursive: true });
  mkdirSync(resources, { recursive: true });

  cpSync(binary, join(macos, "CronRunner"));
  chmodSync(join(macos, "CronRunner"), 0o755);
  cpSync(join(ICON_DIR, "AppIcon.icns"), join(resources, "AppIcon.icns"));

  writeFileSync(
    join(appPath, "Contents", "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>CronRunner</string>
  <key>CFBundleDisplayName</key><string>CronRunner</string>
  <key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string>
  <key>CFBundleExecutable</key><string>CronRunner</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`,
  );
}

/** Disk image with the app and a shortcut to /Applications, the usual macOS install flow. */
async function buildDmg(appPath: string, dmgPath: string): Promise<void> {
  const staging = join(STAGE, "dmg");
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  cpSync(appPath, join(staging, "CronRunner.app"), { recursive: true });
  await run(["ln", "-s", "/Applications", join(staging, "Applications")]);
  rmSync(dmgPath, { force: true });
  await run([
    "hdiutil",
    "create",
    "-volname",
    `CronRunner ${VERSION}`,
    "-srcfolder",
    staging,
    "-ov",
    "-format",
    "UDZO",
    dmgPath,
  ]);
  rmSync(staging, { recursive: true, force: true });
}

/** Tarball with the binary, a desktop entry, an icon and an installer for the current user. */
async function buildLinuxTarball(binary: string, tarPath: string): Promise<void> {
  const dir = join(STAGE, `CronRunner-${VERSION}-linux-x64`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  cpSync(binary, join(dir, "cronrunner"));
  chmodSync(join(dir, "cronrunner"), 0o755);
  cpSync(join(ICON_DIR, "icon-512.png"), join(dir, "cronrunner.png"));

  writeFileSync(
    join(dir, "cronrunner.desktop"),
    `[Desktop Entry]
Type=Application
Name=CronRunner
Comment=Schedule and run jobs on your own machine
Exec=cronrunner
Icon=cronrunner
Terminal=false
Categories=Utility;System;
`,
  );

  writeFileSync(
    join(dir, "install.sh"),
    `#!/bin/sh
# Installs CronRunner for the current user. No root required.
set -e
BIN="\${HOME}/.local/bin"
APPS="\${HOME}/.local/share/applications"
ICONS="\${HOME}/.local/share/icons/hicolor/512x512/apps"
mkdir -p "$BIN" "$APPS" "$ICONS"
install -m 755 cronrunner "$BIN/cronrunner"
install -m 644 cronrunner.png "$ICONS/cronrunner.png"
install -m 644 cronrunner.desktop "$APPS/cronrunner.desktop"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" || true
echo "CronRunner installed to $BIN/cronrunner"
echo "Make sure $BIN is on your PATH, then run: cronrunner --open"
`,
  );
  chmodSync(join(dir, "install.sh"), 0o755);

  rmSync(tarPath, { force: true });
  await run(["tar", "-czf", tarPath, "-C", STAGE, `CronRunner-${VERSION}-linux-x64`]);
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------

/**
 * `--only=macos|windows|linux` limits the run to one platform. The release workflow uses it
 * so each runner builds the artifacts only it can build properly.
 */
const onlyArg = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const wants = (platform: string) => !onlyArg || onlyArg === platform;

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
mkdirSync(DIST, { recursive: true });

console.log(`[package] CronRunner ${VERSION}${onlyArg ? ` (${onlyArg} only)` : ""}`);

const artifacts: { platform: string; file: string }[] = [];

// macOS, one .dmg per architecture.
if (wants("macos") && process.platform === "darwin") {
  for (const [target, arch, label] of [
    ["bun-darwin-arm64", "arm64", "macOS (Apple silicon)"],
    ["bun-darwin-x64", "x64", "macOS (Intel)"],
  ] as const) {
    process.stdout.write(`  ${label} … `);
    const binary = join(STAGE, `cronrunner-${arch}`);
    await compile(target, binary);
    const app = join(STAGE, `CronRunner-${arch}.app`);
    buildAppBundle(binary, app);
    const dmg = join(DIST, `CronRunner-${VERSION}-macos-${arch}.dmg`);
    await buildDmg(app, dmg);
    artifacts.push({ platform: label, file: dmg });
    console.log(mb(dmg));
  }
} else if (wants("macos")) {
  console.log("  macOS .dmg skipped (needs hdiutil, so build it on a Mac)");
}

// Windows, a single self-contained .exe.
if (wants("windows")) {
  process.stdout.write("  Windows (x64) … ");
  const exe = join(DIST, `CronRunner-${VERSION}-windows-x64.exe`);
  await compile("bun-windows-x64", exe, true);
  artifacts.push({ platform: "Windows (x64)", file: exe });
  console.log(
    mb(exe) +
      (process.platform === "win32"
        ? ""
        : "  (no icon, shows a console: build on Windows for the real one)"),
  );
}

// Linux, a tarball with a desktop entry.
if (wants("linux")) {
  process.stdout.write("  Linux (x64) … ");
  const linuxBinary = join(STAGE, "cronrunner-linux");
  await compile("bun-linux-x64", linuxBinary);
  const tar = join(DIST, `CronRunner-${VERSION}-linux-x64.tar.gz`);
  await buildLinuxTarball(linuxBinary, tar);
  artifacts.push({ platform: "Linux (x64)", file: tar });
  console.log(mb(tar));
}

// Checksums, so downloads can be verified.
const sums: string[] = [];
for (const { file } of artifacts) {
  const hash = new Bun.CryptoHasher("sha256");
  hash.update(await Bun.file(file).arrayBuffer());
  sums.push(`${hash.digest("hex")}  ${file.split("/").pop()}`);
}
writeFileSync(join(DIST, "SHA256SUMS.txt"), `${sums.join("\n")}\n`);

rmSync(STAGE, { recursive: true, force: true });

console.log("\n  Platform                 File                                        Size");
for (const { platform, file } of artifacts) {
  const name = file.split("/").pop() ?? "";
  console.log(`  ${platform.padEnd(24)} ${name.padEnd(43)} ${mb(file)}`);
}
console.log(`\n[package] ${artifacts.length} artifact(s) in apps/server/dist/`);
