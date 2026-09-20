/**
 * "Start CronRunner when I log in", per operating system.
 *
 *   macOS    ~/Library/LaunchAgents/com.cronrunner.daemon.plist  + launchctl load/unload
 *   Linux    ~/.config/systemd/user/cronrunner.service           + systemctl --user enable/disable
 *   Windows  a scheduled task registered with schtasks /SC ONLOGON
 *
 * All three run the *current executable*. That is only meaningful for a compiled binary:
 * during development the executable is `bun` itself, so installation is refused with an
 * explanation rather than registering something that will not work after a reboot.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface AutostartStatus {
  /** False on an unrecognised platform, or when running under `bun` rather than a binary. */
  supported: boolean;
  enabled: boolean;
  /** Present when `supported` is false: why it cannot be set up here. */
  reason?: string;
  /** Where the registration lives, for the UI to show. */
  location?: string;
}

const LAUNCH_AGENT_LABEL = "com.cronrunner.daemon";
const SYSTEMD_UNIT = "cronrunner.service";
const WINDOWS_TASK = "CronRunner";

/** The binary to launch at login. */
function executablePath(): string {
  return process.execPath;
}

/**
 * True when the process is a compiled CronRunner binary rather than `bun run src/index.ts`.
 * `Bun.embeddedFiles` is non-empty only in a compiled executable that bundled files.
 */
function isCompiledBinary(): boolean {
  const exec = executablePath().toLowerCase();
  return !exec.endsWith("/bun") && !exec.endsWith("bun.exe") && !exec.endsWith("\\bun");
}

function agentPlistPath(): string {
  return join(homedir(), "Library", "LaunchAgents", `${LAUNCH_AGENT_LABEL}.plist`);
}

function systemdUnitPath(): string {
  return join(homedir(), ".config", "systemd", "user", SYSTEMD_UNIT);
}

function registrationPath(): string | undefined {
  switch (process.platform) {
    case "darwin":
      return agentPlistPath();
    case "linux":
      return systemdUnitPath();
    case "win32":
      return `Task Scheduler \\${WINDOWS_TASK}`;
    default:
      return undefined;
  }
}

async function run(cmd: string[]): Promise<{ ok: boolean; output: string }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { ok: exitCode === 0, output: `${stdout}${stderr}`.trim() };
}

function unsupportedReason(): string | undefined {
  if (!["darwin", "linux", "win32"].includes(process.platform)) {
    return `Start at login is not supported on ${process.platform}.`;
  }
  if (!isCompiledBinary()) {
    return "Start at login needs the compiled CronRunner binary. It is unavailable when running from source.";
  }
  return undefined;
}

export async function status(): Promise<AutostartStatus> {
  const reason = unsupportedReason();
  const location = registrationPath();
  if (reason) return { supported: false, enabled: false, reason, location };

  switch (process.platform) {
    case "darwin":
      return { supported: true, enabled: existsSync(agentPlistPath()), location };
    case "linux":
      return { supported: true, enabled: existsSync(systemdUnitPath()), location };
    case "win32": {
      const result = await run(["schtasks", "/Query", "/TN", WINDOWS_TASK]);
      return { supported: true, enabled: result.ok, location };
    }
    default:
      return { supported: false, enabled: false, location };
  }
}

export async function install(): Promise<AutostartStatus> {
  const reason = unsupportedReason();
  if (reason) throw new Error(reason);
  const exec = executablePath();

  if (process.platform === "darwin") {
    const path = agentPlistPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${exec}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
`,
    );
    // `load` fails harmlessly if it is already loaded; the plist on disk is what matters.
    await run(["launchctl", "load", "-w", path]);
    return status();
  }

  if (process.platform === "linux") {
    const path = systemdUnitPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      `[Unit]
Description=CronRunner scheduled job daemon

[Service]
ExecStart=${exec}
Restart=on-failure

[Install]
WantedBy=default.target
`,
    );
    await run(["systemctl", "--user", "daemon-reload"]);
    await run(["systemctl", "--user", "enable", "--now", SYSTEMD_UNIT]);
    return status();
  }

  const result = await run([
    "schtasks",
    "/Create",
    "/F",
    "/SC",
    "ONLOGON",
    "/TN",
    WINDOWS_TASK,
    "/TR",
    `"${exec}"`,
  ]);
  if (!result.ok) throw new Error(result.output || "schtasks could not create the task");
  return status();
}

export async function uninstall(): Promise<AutostartStatus> {
  if (process.platform === "darwin") {
    const path = agentPlistPath();
    if (existsSync(path)) {
      await run(["launchctl", "unload", "-w", path]);
      rmSync(path, { force: true });
    }
    return status();
  }

  if (process.platform === "linux") {
    const path = systemdUnitPath();
    if (existsSync(path)) {
      await run(["systemctl", "--user", "disable", "--now", SYSTEMD_UNIT]);
      rmSync(path, { force: true });
      await run(["systemctl", "--user", "daemon-reload"]);
    }
    return status();
  }

  if (process.platform === "win32") {
    await run(["schtasks", "/Delete", "/F", "/TN", WINDOWS_TASK]);
    return status();
  }

  return status();
}
