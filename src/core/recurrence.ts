/**
 * Recurrence module: date math for repeating tasks driven by a `RecurrenceRule`.
 *
 * Supports `daily`, `weekly`, and `monthly` frequencies with an `interval`
 * multiplier, and honours the rule's `count` (total occurrences including the
 * anchor) and `until` (inclusive upper bound) limits. Monthly steps use
 * calendar-month arithmetic, clamping to the last valid day of the target month.
 *
 * Main exports:
 *   - {@link isRecurring}        — whether a rule actually produces repeats.
 *   - {@link nextOccurrence}     — the next date strictly after a given point.
 *   - {@link expandOccurrences}  — the series of occurrence dates from an anchor.
 */

// FIREFUNC-BUG(5): ZERO test coverage — this module (isRecurring/nextOccurrence/expandOccurrences) has no test file; coverage-backfill target.
import type { RecurrenceRule } from "../shared/types.js";

const DEFAULT_MAX = 100;
const HARD_CAP = 10_000; // absolute ceiling to prevent runaway expansion

/** Whether a rule actually produces repeats. */
export function isRecurring(rule: RecurrenceRule | null): boolean {
  return (
    rule !== null &&
    rule.freq !== "none" &&
    Number.isFinite(rule.interval) &&
    rule.interval >= 1
  );
}

/**
 * Add one recurrence step to a date according to freq/interval.
 *
 * Monthly steps use calendar-month arithmetic and clamp the day to the last
 * valid day of the target month (e.g. Jan 31 + 1 month → Feb 28/29), while
 * preserving the time-of-day.
 */
function addStep(date: Date, freq: RecurrenceRule["freq"], interval: number): Date {
  const next = new Date(date.getTime());
  switch (freq) {
    case "daily":
      next.setDate(next.getDate() + interval);
      return next;
    case "weekly":
      next.setDate(next.getDate() + interval * 7);
      return next;
    case "monthly": {
      const targetMonthIndex = date.getMonth() + interval;
      const targetYear = date.getFullYear() + Math.floor(targetMonthIndex / 12);
      const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
      const desiredDay = date.getDate();
      const lastDay = daysInMonth(targetYear, targetMonth);
      const day = Math.min(desiredDay, lastDay);
      return new Date(
        targetYear,
        targetMonth,
        day,
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds(),
      );
    }
    case "none":
    default:
      return next;
  }
}

function daysInMonth(year: number, monthIndex: number): number {
  // Day 0 of the *next* month is the last day of this month.
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Compute the next occurrence strictly after `from` for a recurrence rule,
 * starting the series from `from` itself, or null if the rule has ended or is
 * not recurring.
 *
 * The series is anchored at `from`: the first candidate is `from + 1 step`.
 * Bounded by the rule's `until` (inclusive). Note: `count` bounds the *total
 * series length* and is best honoured via expandOccurrences; here it caps how
 * many steps we will advance.
 */
export function nextOccurrence(rule: RecurrenceRule, from: Date): Date | null {
  if (!isRecurring(rule)) return null;
  const fromMs = from.getTime();
  if (Number.isNaN(fromMs)) return null;

  const candidate = addStep(from, rule.freq, rule.interval);

  const untilMs = rule.until ? new Date(rule.until).getTime() : null;
  if (untilMs !== null && !Number.isNaN(untilMs) && candidate.getTime() > untilMs) {
    return null;
  }

  // count semantics: total occurrences in the series including the anchor.
  // count <= 1 means the anchor is the only occurrence — no "next".
  if (rule.count !== null && rule.count <= 1) {
    return null;
  }

  return candidate;
}

/**
 * Expand a recurrence rule into occurrence dates, beginning with `start`
 * (the anchor / first occurrence), bounded by:
 *   - the rule's `count` (total occurrences, inclusive of the anchor),
 *   - the rule's `until` (inclusive upper bound),
 *   - the `max` cap (and a hard internal ceiling).
 *
 * Returns an empty array for non-recurring rules or an invalid `start`.
 */
export function expandOccurrences(
  rule: RecurrenceRule,
  start: Date,
  max = DEFAULT_MAX,
): Date[] {
  if (!isRecurring(rule)) return [];
  const startMs = start.getTime();
  if (Number.isNaN(startMs)) return [];

  const effectiveMax = Math.max(0, Math.min(max, HARD_CAP));
  if (effectiveMax === 0) return [];

  const untilMs = rule.until ? new Date(rule.until).getTime() : null;
  const hasUntil = untilMs !== null && !Number.isNaN(untilMs);

  const countLimit =
    rule.count !== null && Number.isFinite(rule.count) && rule.count >= 0
      ? rule.count
      : null;

  const out: Date[] = [];
  let cursor = new Date(start.getTime());

  while (out.length < effectiveMax) {
    if (hasUntil && cursor.getTime() > (untilMs as number)) break;
    out.push(new Date(cursor.getTime()));
    if (countLimit !== null && out.length >= countLimit) break;
    cursor = addStep(cursor, rule.freq, rule.interval);
  }

  return out;
}
