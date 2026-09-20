// Menu bar front end for CronRunner.
//
// CronRunner is a background daemon, so the app has no window of its own: the interface is a
// web page the daemon serves. What it needs instead is what every background app has — a
// visible sign that it is running, a way to open the interface, and a way to quit properly.
// This is that, in the shape Dropbox and Tailscale use.
//
// It owns the daemon's lifetime: it starts the executable bundled beside it in Resources and
// terminates it on quit, so quitting from the menu really does stop the schedule.

import AppKit
import Foundation

private let serverURL = URL(string: "http://127.0.0.1:4747")!
private let statusURL = URL(string: "http://127.0.0.1:4747/api/system")!

/// The slice of /api/system the menu shows.
private struct SystemInfo: Decodable {
    let version: String
    let enabledJobCount: Int
    let jobCount: Int
    let schedulerRunning: Bool
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private let statusLine = NSMenuItem(title: "Starting…", action: nil, keyEquivalent: "")
    private var daemon: Process?
    private var pollTimer: Timer?
    private var hasOpenedUI = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Menu bar only: no Dock icon, no window, like any other background utility.
        NSApp.setActivationPolicy(.accessory)
        buildStatusItem()
        startDaemon()

        pollTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            self?.refreshStatus()
        }
        refreshStatus()
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopDaemon()
    }

    // MARK: - Menu

    private func buildStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.image = NSImage(
            systemSymbolName: "clock",
            accessibilityDescription: "CronRunner"
        )
        // A template image follows the menu bar's light and dark appearance automatically.
        statusItem.button?.image?.isTemplate = true

        let menu = NSMenu()
        statusLine.isEnabled = false
        menu.addItem(statusLine)
        menu.addItem(.separator())

        let open = NSMenuItem(
            title: "Open CronRunner",
            action: #selector(openUI),
            keyEquivalent: "o"
        )
        open.target = self
        menu.addItem(open)

        let logs = NSMenuItem(title: "Reveal Data Folder", action: #selector(revealData), keyEquivalent: "")
        logs.target = self
        menu.addItem(logs)

        menu.addItem(.separator())

        let quit = NSMenuItem(
            title: "Quit CronRunner",
            action: #selector(quit),
            keyEquivalent: "q"
        )
        quit.target = self
        menu.addItem(quit)

        statusItem.menu = menu
    }

    // MARK: - Daemon lifetime

    private func startDaemon() {
        guard let executable = Bundle.main.url(forResource: "cronrunner", withExtension: nil) else {
            statusLine.title = "Daemon missing from the app"
            return
        }

        let process = Process()
        process.executableURL = executable
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        process.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async { self?.statusLine.title = "Not running" }
        }

        do {
            try process.run()
            daemon = process
        } catch {
            statusLine.title = "Could not start: \(error.localizedDescription)"
        }
    }

    private func stopDaemon() {
        guard let daemon, daemon.isRunning else { return }
        daemon.terminate()
        // Give it a moment to shut the scheduler down before the app goes away.
        let deadline = Date().addingTimeInterval(3)
        while daemon.isRunning && Date() < deadline {
            usleep(50_000)
        }
    }

    // MARK: - Status

    private func refreshStatus() {
        var request = URLRequest(url: statusURL)
        request.timeoutInterval = 2
        // The daemon only answers same-origin requests, so identify as the app itself.
        request.setValue("http://127.0.0.1:4747", forHTTPHeaderField: "Origin")

        URLSession.shared.dataTask(with: request) { [weak self] data, _, _ in
            guard let self else { return }
            guard let data, let info = try? JSONDecoder().decode(SystemInfo.self, from: data) else {
                DispatchQueue.main.async { self.statusLine.title = "Starting…" }
                return
            }
            DispatchQueue.main.async {
                let jobs = info.enabledJobCount == 1 ? "1 job enabled" : "\(info.enabledJobCount) jobs enabled"
                self.statusLine.title = info.schedulerRunning ? jobs : "Scheduler stopped"
                // Open the interface once, the first time the daemon is ready.
                if !self.hasOpenedUI {
                    self.hasOpenedUI = true
                    NSWorkspace.shared.open(serverURL)
                }
            }
        }.resume()
    }

    // MARK: - Actions

    @objc private func openUI() {
        NSWorkspace.shared.open(serverURL)
    }

    @objc private func revealData() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        guard let folder = support?.appendingPathComponent("CronRunner") else { return }
        NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: folder.path)
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
