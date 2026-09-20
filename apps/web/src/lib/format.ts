/**
 * Display formatting helpers. All inputs are ISO-8601 UTC strings from the API;
 * all outputs are in the viewer's local timezone.
 */
import { format, formatDistanceToNowStrict } from "date-fns";

/** "3 minutes ago" / "in 2 hours" / "just now". Returns "—" for null. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  if (Math.abs(Date.now() - d.getTime()) < 10_000) return "just now";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** "Mon 22 Sep 2026, 2:00 PM" — local, with weekday. Used in tooltips and previews. */
export function absoluteTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "EEE d MMM yyyy, h:mm a");
}

/** Short local time of day, e.g. "2:00 PM". */
export function timeOfDay(iso: string): string {
  return format(new Date(iso), "h:mm a");
}

/** "840ms" / "3.2s" / "4m 12s" / "1h 5m". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

/** Collapse a multi-line command to a single line for table cells. */
export function singleLine(command: string): string {
  return command.replace(/\s*\n\s*/g, " ; ").trim();
}
