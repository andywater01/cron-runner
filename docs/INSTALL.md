# Installing CronRunner

CronRunner is one self-contained application per platform. There is no runtime to install
alongside it, no Node, no Bun, no Docker, and no account to create. Download it, open it, and
the interface appears in your browser.

## Download

Current version: **0.1.2**

| Platform | Download | What you get |
| --- | --- | --- |
| macOS, Apple silicon (M1 and later) | [CronRunner-0.1.2-macos-arm64.dmg](https://github.com/andywater01/cron-runner/releases/download/v0.1.2/CronRunner-0.1.2-macos-arm64.dmg) | Disk image, drag to Applications |
| macOS, Intel | [CronRunner-0.1.2-macos-x64.dmg](https://github.com/andywater01/cron-runner/releases/download/v0.1.2/CronRunner-0.1.2-macos-x64.dmg) | Disk image, drag to Applications |
| Windows 10 and 11, 64-bit | [CronRunner-0.1.2-windows-x64.exe](https://github.com/andywater01/cron-runner/releases/download/v0.1.2/CronRunner-0.1.2-windows-x64.exe) | Single executable, nothing to install |
| Linux, 64-bit | [CronRunner-0.1.2-linux-x64.tar.gz](https://github.com/andywater01/cron-runner/releases/download/v0.1.2/CronRunner-0.1.2-linux-x64.tar.gz) | Binary, desktop entry and installer |

Newer versions are on the [releases page](https://github.com/andywater01/cron-runner/releases/latest).
Every release also ships `SHA256SUMS.txt` if you want to verify your download.

## macOS

Open the `.dmg` and drag **CronRunner** into your Applications folder, the same as any other
Mac app. Launch it from Applications or Spotlight.

CronRunner is a background app, so it lives in the **menu bar** rather than the Dock, the same
as Dropbox or Tailscale. Look for the clock icon near the top right of your screen. Its menu
shows how many jobs are enabled, opens the interface, and quits CronRunner properly, which
stops the scheduler. The interface itself opens in your browser the first time it starts.

The first time you open it, macOS will refuse, saying it cannot verify the developer. The app
is signed, but not with a paid Apple Developer certificate, so it has not been notarized by
Apple. To get past it:

**On macOS 15 (Sequoia) and later**, including macOS 26, open **System Settings → Privacy &
Security**, scroll down to the Security section, and click **Open Anyway** next to the message
about CronRunner. Confirm with your password or Touch ID, then open the app again. Right
clicking and choosing Open no longer works on these versions; Apple removed that shortcut.

**On macOS 14 and earlier**, right-click the app and choose **Open**, then click Open in the
dialog.

Either way you only do it once. If you would rather do it from a terminal, this has the same
effect and works on every version:

```bash
xattr -dr com.apple.quarantine /Applications/CronRunner.app
```

Nothing here is specific to CronRunner. It applies to any app distributed outside the App Store
without a paid Apple Developer signature.

## Windows

Run the `.exe`. There is nothing to install and no console window.

SmartScreen will show "Windows protected your PC" because the executable is not signed with a
code signing certificate. Click **More info**, then **Run anyway**.

If you want it in the Start menu, right-click the file, choose **Create shortcut**, and move
the shortcut into:

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs
```

## Linux

Extract the archive and run the installer, which needs no root access:

```bash
tar -xzf CronRunner-0.1.2-linux-x64.tar.gz
cd CronRunner-0.1.2-linux-x64
./install.sh
```

That puts the binary in `~/.local/bin`, adds an icon, and registers a desktop entry so
CronRunner appears in your application launcher. Make sure `~/.local/bin` is on your `PATH`.

To run it without installing, just execute the binary directly:

```bash
./cronrunner --open
```

## After you open it

CronRunner starts a small local server and opens the interface at <http://127.0.0.1:4747>. If
your browser does not open on its own, visit that address yourself.

Two things worth doing straight away:

- **Turn on start at login**, in Settings. Jobs only run while CronRunner is running, so
  without this your schedules stop when you log out or restart. CronRunner reports any runs it
  missed while it was closed, and never silently replays them.
- **Add an API key**, in Settings, if you want to describe jobs in plain English. You supply
  your own OpenAI or Anthropic key and it is stored on your machine only. Everything else in
  the app works without one.

Closing the browser tab does not stop CronRunner. It keeps running so your jobs keep firing.
To quit it, choose **Quit CronRunner** from the menu bar icon on macOS, end it in Task Manager
on Windows, or stop the process on Linux.

## Where your data lives

| Platform | Location |
| --- | --- |
| macOS | `~/Library/Application Support/CronRunner` |
| Windows | `%APPDATA%\CronRunner` |
| Linux | `$XDG_DATA_HOME/cronrunner`, or `~/.local/share/cronrunner` |

That folder holds your jobs database, your settings including any API key, and the logs. None
of it is sent anywhere. Deleting that folder resets CronRunner completely.

## Uninstalling

Delete the application, then delete the data folder above. On Linux, also remove
`~/.local/bin/cronrunner` and `~/.local/share/applications/cronrunner.desktop`. If you turned
on start at login, switch it off in Settings first, or remove the entry by hand:

| Platform | Entry |
| --- | --- |
| macOS | `~/Library/LaunchAgents/com.cronrunner.daemon.plist` |
| Linux | `~/.config/systemd/user/cronrunner.service` |
| Windows | Scheduled task named `CronRunner` |
