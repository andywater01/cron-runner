/**
 * Persistent left sidebar + scrollable content area. See docs/DESIGN.md §3 "Layout".
 */

import clsx from "clsx";
import {
  Activity,
  Clock,
  LayoutDashboard,
  ListChecks,
  Moon,
  Settings,
  Sun,
  WifiOff,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { useTheme } from "@/hooks/useTheme";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/jobs", label: "Jobs", icon: ListChecks },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { theme, setTheme } = useTheme();
  const system = useSystemInfo();
  // Two consecutive failures means the daemon is genuinely gone, not just a blip.
  const disconnected = system.isError && system.failureCount >= 2;

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-default bg-surface">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid size-8 place-items-center rounded-lg bg-accent-500 text-white">
            <Clock className="size-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">CronRunner</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                    : "text-muted hover:bg-surface-muted hover:text-default",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-default px-4 py-3 text-xs text-muted">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span
                className={clsx(
                  "size-1.5 rounded-full",
                  system.data?.schedulerRunning && !disconnected ? "bg-success" : "bg-danger",
                )}
              />
              {disconnected
                ? "Offline"
                : system.data
                  ? `${system.data.enabledJobCount} active`
                  : "Connecting…"}
            </span>
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-md p-1 hover:bg-surface-muted"
            >
              {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        {disconnected && (
          <div
            role="alert"
            className="flex items-center justify-center gap-2 border-b border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger"
          >
            <WifiOff className="size-3.5 shrink-0" aria-hidden />
            Can't reach the CronRunner daemon. Scheduled jobs are not running.
            <button
              type="button"
              onClick={() => system.refetch()}
              className="ml-1 font-medium underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
