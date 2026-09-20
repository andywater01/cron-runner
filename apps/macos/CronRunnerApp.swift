// Native macOS front end for CronRunner.
//
// CronRunner's interface is a web app served by its own daemon. On macOS it is shown in a real
// window rather than a browser tab: a WKWebView hosting http://127.0.0.1:4747, with its own
// Dock icon, Cmd+Tab entry, menus and traffic lights, and the interface drawn right up into
// the title bar the way Docker Desktop does. A menu bar icon stays alongside it, because the
// scheduler keeps running when the window is closed and there has to be a way to see that and
// quit.
//
// This process owns the daemon's lifetime. It starts the executable bundled in Resources and
// terminates it on quit, so quitting really does stop the schedule. Closing the window does not.

import AppKit
import Foundation
import WebKit

private let serverURL = URL(string: "http://127.0.0.1:4747")!
private let statusURL = URL(string: "http://127.0.0.1:4747/api/system")!

/// The slice of /api/system the menu bar shows.
private struct SystemInfo: Decodable {
    let enabledJobCount: Int
    let schedulerRunning: Bool
}

/// Covers the strip under the transparent title bar. The web view would otherwise swallow the
/// mouse there and the window could not be dragged; WebKit has no equivalent of Electron's
/// -webkit-app-region. The interface leaves this strip empty when it runs inside the shell.
private final class TitlebarDragView: NSView {
    override func mouseDown(with event: NSEvent) {
        if event.clickCount == 2 {
            window?.performZoom(nil)
        } else {
            window?.performDrag(with: event)
        }
    }
}

private let darkBackground = NSColor(srgbRed: 0.043, green: 0.059, blue: 0.098, alpha: 1) // #0b0f19
private let lightBackground = NSColor(srgbRed: 0.973, green: 0.980, blue: 0.988, alpha: 1) // #f8fafc

private let loadingPage = """
<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:#0b0f19;color:#94a3b8;
    font:13px -apple-system,BlinkMacSystemFont,sans-serif;-webkit-user-select:none;cursor:default}
  body{display:flex;align-items:center;justify-content:center}
  @media (prefers-color-scheme: light){html,body{background:#f8fafc;color:#64748b}}
</style></head><body><div id="m">Starting CronRunner…</div></body></html>
"""

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    private var statusItem: NSStatusItem!
    private let statusLine = NSMenuItem(title: "Starting…", action: nil, keyEquivalent: "")
    private var window: NSWindow!
    private var webView: WKWebView!
    private var daemon: Process?
    private var pollTimer: Timer?
    private var appLoaded = false
    private let launchedAt = Date()

    // MARK: - Lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        buildMainMenu()
        buildStatusItem()
        buildWindow()
        showWindow()
        startDaemon()
        schedulePolling(every: 0.5)
        refreshStatus()
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopDaemon()
    }

    /// Closing the window leaves CronRunner running so jobs keep firing.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    /// Clicking the Dock icon brings the window back.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showWindow()
        return true
    }

    // MARK: - Window

    private func buildWindow() {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1240, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "CronRunner"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 960, height: 620)
        window.delegate = self
        window.backgroundColor = NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? darkBackground : lightBackground
        }
        window.center()
        window.setFrameAutosaveName("CronRunnerMainWindow")

        // Height of the title bar strip the content now extends under.
        let titlebarHeight = max(28, window.frame.height - window.contentLayoutRect.height)

        let config = WKWebViewConfiguration()
        // Tell the interface it is inside the native window, so it reserves the title bar strip
        // (clear of the traffic lights and the drag area) instead of putting content there.
        let marker = WKUserScript(
            source: """
            document.documentElement.classList.add('desktop-shell');
            document.documentElement.style.setProperty('--titlebar-height', '\(Int(titlebarHeight))px');
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(marker)

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        // Let the window colour show through until the first paint, instead of a white flash.
        webView.setValue(false, forKey: "drawsBackground")
        window.contentView!.addSubview(webView)

        let bounds = window.contentView!.bounds
        let drag = TitlebarDragView(
            frame: NSRect(x: 0, y: bounds.height - titlebarHeight, width: bounds.width, height: titlebarHeight)
        )
        drag.autoresizingMask = [.width, .minYMargin]
        window.contentView!.addSubview(drag)

        webView.loadHTMLString(loadingPage, baseURL: nil)
    }

    @objc private func showWindow() {
        window.makeKeyAndOrderFront(nil)
        if #available(macOS 14.0, *) {
            NSApp.activate()
        } else {
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    @objc private func reload() {
        if appLoaded { webView.reload() }
    }

    // MARK: - Menus

    private func buildMainMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About CronRunner",
                        action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide CronRunner", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: "Hide Others",
                                         action: #selector(NSApplication.hideOtherApplications(_:)),
                                         keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit CronRunner", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)

        // Without an Edit menu, copy and paste do not work inside the web view's text fields.
        let editItem = NSMenuItem()
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        main.addItem(editItem)

        let viewItem = NSMenuItem()
        let view = NSMenu(title: "View")
        let reloadItem = view.addItem(withTitle: "Reload", action: #selector(reload), keyEquivalent: "r")
        reloadItem.target = self
        viewItem.submenu = view
        main.addItem(viewItem)

        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowItem.submenu = windowMenu
        main.addItem(windowItem)
        NSApp.windowsMenu = windowMenu

        NSApp.mainMenu = main
    }

    private func buildStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.image = NSImage(systemSymbolName: "clock", accessibilityDescription: "CronRunner")
        statusItem.button?.image?.isTemplate = true

        let menu = NSMenu()
        statusLine.isEnabled = false
        menu.addItem(statusLine)
        menu.addItem(.separator())
        menu.addItem(item("Show CronRunner", #selector(showWindow), key: "o"))
        menu.addItem(item("Open in Browser", #selector(openInBrowser)))
        menu.addItem(item("Reveal Data Folder", #selector(revealData)))
        menu.addItem(.separator())
        menu.addItem(item("Quit CronRunner", #selector(quit), key: "q"))
        statusItem.menu = menu
    }

    private func item(_ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let menuItem = NSMenuItem(title: title, action: action, keyEquivalent: key)
        menuItem.target = self
        return menuItem
    }

    @objc private func openInBrowser() { NSWorkspace.shared.open(serverURL) }

    @objc private func revealData() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        guard let folder = support?.appendingPathComponent("CronRunner") else { return }
        NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: folder.path)
    }

    @objc private func quit() { NSApp.terminate(nil) }

    // MARK: - Daemon

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
        let deadline = Date().addingTimeInterval(3)
        while daemon.isRunning && Date() < deadline { usleep(50_000) }
    }

    // MARK: - Status

    private func schedulePolling(every seconds: TimeInterval) {
        pollTimer?.invalidate()
        pollTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: true) { [weak self] _ in
            self?.refreshStatus()
        }
    }

    private func refreshStatus() {
        var request = URLRequest(url: statusURL)
        request.timeoutInterval = 2
        URLSession.shared.dataTask(with: request) { [weak self] data, _, _ in
            let info = data.flatMap { try? JSONDecoder().decode(SystemInfo.self, from: $0) }
            DispatchQueue.main.async { self?.applyStatus(info) }
        }.resume()
    }

    private func applyStatus(_ info: SystemInfo?) {
        guard let info else {
            statusLine.title = "Starting…"
            if !appLoaded && Date().timeIntervalSince(launchedAt) > 20 {
                webView.evaluateJavaScript(
                    "document.getElementById('m').textContent = 'CronRunner could not start. See the log in the data folder.'"
                )
            }
            return
        }
        let jobs = info.enabledJobCount == 1 ? "1 job enabled" : "\(info.enabledJobCount) jobs enabled"
        statusLine.title = info.schedulerRunning ? jobs : "Scheduler stopped"

        // The daemon answers: swap the loading page for the real interface, once.
        if !appLoaded {
            appLoaded = true
            webView.load(URLRequest(url: serverURL))
            schedulePolling(every: 5)
        }
    }

    // MARK: - Web view

    /// Keep the window on the app. Anything else, such as a documentation link, opens in the
    /// user's browser rather than replacing the interface.
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.allow) }
        let isApp = url.host == serverURL.host && url.port == serverURL.port
        if isApp || url.scheme == "about" || url.scheme == "data" {
            decisionHandler(.allow)
        } else {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    /// WKWebView shows no alert() or confirm() unless the host does. The interface uses
    /// confirm() for "discard unsaved changes?", which would otherwise silently answer no.
    func webView(_ webView: WKWebView,
                 runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { response in
            completionHandler(response == .alertFirstButtonReturn)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if appLoaded { webView.load(URLRequest(url: serverURL)) }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
