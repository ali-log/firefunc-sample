import type { Priority, Task, TaskState } from "../shared/types.js";

/** Human-readable label for a task state. */
export function formatState(state: TaskState): string {
  const labels: Record<TaskState, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    blocked: "Blocked",
    done: "Done",
  };
  return labels[state] ?? state;
}

/** Human-readable label for a priority. */
export function formatPriority(priority: Priority): string {
  if (!priority) return "";
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

/**
 * Format a duration in minutes as a compact human string, e.g.
 *   0      -> "0m"
 *   45     -> "45m"
 *   90     -> "1h 30m"
 *   1500   -> "1d 1h"
 *   -30    -> "-30m"
 *
 * Shows at most the two most-significant non-zero units (d, h, m). Sub-minute
 * inputs round to the nearest minute. Negative durations keep a leading sign.
 */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return "0m";

  const sign = minutes < 0 ? "-" : "";
  let total = Math.round(Math.abs(minutes));

  if (total === 0) return "0m";

  const days = Math.floor(total / (60 * 24));
  total -= days * 60 * 24;
  const hours = Math.floor(total / 60);
  const mins = total - hours * 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);

  // Keep at most the two most-significant units.
  return sign + parts.slice(0, 2).join(" ");
}

/**
 * Format a monetary amount. Defaults to USD-style with two decimals and
 * thousands separators, e.g. formatMoney(1234.5) -> "$1,234.50".
 * Pass a currency symbol/code to override (e.g. "€", "£").
 */
export function formatMoney(
  amount: number,
  currency = "$",
  fractionDigits = 2,
): string {
  if (!Number.isFinite(amount)) return `${currency}0.00`;
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const fixed = abs.toFixed(fractionDigits);
  const [whole, frac] = fixed.split(".");
  const grouped = (whole as string).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = frac ? `${grouped}.${frac}` : grouped;
  return `${sign}${currency}${body}`;
}

const REL_UNITS: Array<{ limitMs: number; divMs: number; unit: string }> = [
  { limitMs: 60_000, divMs: 1_000, unit: "second" },
  { limitMs: 3_600_000, divMs: 60_000, unit: "minute" },
  { limitMs: 86_400_000, divMs: 3_600_000, unit: "hour" },
  { limitMs: 604_800_000, divMs: 86_400_000, unit: "day" },
  { limitMs: 2_629_800_000, divMs: 604_800_000, unit: "week" },
  { limitMs: 31_557_600_000, divMs: 2_629_800_000, unit: "month" },
  { limitMs: Infinity, divMs: 31_557_600_000, unit: "year" },
];

/**
 * Format a date relative to `now`, e.g. "in 3 days", "2 hours ago", "just now".
 * Past dates use "... ago"; future dates use "in ...". Invalid dates fall back
 * to the ISO string.
 */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const t = date.getTime();
  if (Number.isNaN(t)) {
    try {
      return date.toISOString();
    } catch {
      return "invalid date";
    }
  }

  const diffMs = t - now.getTime();
  const absMs = Math.abs(diffMs);

  if (absMs < 45_000) return "just now";

  const future = diffMs > 0;
  let value = 0;
  let unit = "second";
  for (const u of REL_UNITS) {
    if (absMs < u.limitMs) {
      value = Math.round(absMs / u.divMs);
      unit = u.unit;
      break;
    }
  }
  // Guard against rounding to 0 of the chosen unit.
  if (value === 0) value = 1;

  const plural = value === 1 ? unit : `${unit}s`;
  return future ? `in ${value} ${plural}` : `${value} ${plural} ago`;
}

/** Build a task reference key like "FIRE-123". */
export function formatTaskRef(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

/**
 * Compact one-line task summary for notifications, e.g.
 *   "[HIGH] Fix the parser (in_progress)"
 * — uppercased priority in brackets, the title, then the state in parentheses.
 */
export function formatTaskSummary(
  task: Pick<Task, "priority" | "title" | "state">,
): string {
  return `[${task.priority.toUpperCase()}] ${task.title} (${task.state})`;
}
