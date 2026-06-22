import { PRIORITY_WEIGHT } from "../shared/constants.js";
import type { Priority, Task } from "../shared/types.js";

const MS_PER_HOUR = 3_600_000;

// Tuning weights for the composite rank score. Priority dominates; due-date
// urgency and age provide tie-breaking nudges within a priority band.
const PRIORITY_FACTOR = 100;
const OVERDUE_BONUS = 50;
const DUE_SOON_WINDOW_HOURS = 72; // due within 3 days starts adding urgency
const DUE_SOON_FACTOR = 30;
const AGE_FACTOR = 0.5; // per hour of age
const AGE_CAP = 20; // age contribution never exceeds this

/** Numeric weight for a priority (higher = more important). */
export function priorityWeight(priority: Priority): number {
  return PRIORITY_WEIGHT[priority] ?? 0;
}

/**
 * Compare two priorities. Returns a positive number if `a` outranks `b`,
 * negative if `b` outranks `a`, and 0 if equal. Suitable as the basis of a
 * descending-importance sort comparator.
 */
export function comparePriority(a: Priority, b: Priority): number {
  return priorityWeight(a) - priorityWeight(b);
}

/**
 * Composite ranking score combining, in order of influence:
 *   1. priority weight (dominant term),
 *   2. due-date urgency — overdue tasks get a flat bonus, and tasks due within
 *      a window ramp up linearly as the deadline approaches,
 *   3. age — older tasks float up slightly, capped so age never dominates.
 *
 * Higher score = should be worked first. Completed tasks are deprioritised to
 * the floor so they never outrank live work.
 */
export function rankScore(task: Task, now: Date = new Date()): number {
  if (task.state === "done") {
    return Number.NEGATIVE_INFINITY;
  }

  let score = priorityWeight(task.priority) * PRIORITY_FACTOR;

  if (task.dueAt) {
    const due = new Date(task.dueAt).getTime();
    if (!Number.isNaN(due)) {
      const hoursUntilDue = (due - now.getTime()) / MS_PER_HOUR;
      if (hoursUntilDue <= 0) {
        // Overdue: flat bonus plus a growing term for how far past due.
        score += OVERDUE_BONUS + Math.min(OVERDUE_BONUS, -hoursUntilDue);
      } else if (hoursUntilDue < DUE_SOON_WINDOW_HOURS) {
        // Approaching: closer deadline → larger contribution.
        const closeness = 1 - hoursUntilDue / DUE_SOON_WINDOW_HOURS;
        score += closeness * DUE_SOON_FACTOR;
      }
    }
  }

  const created = new Date(task.createdAt).getTime();
  if (!Number.isNaN(created)) {
    const ageHours = Math.max(0, (now.getTime() - created) / MS_PER_HOUR);
    score += Math.min(AGE_CAP, ageHours * AGE_FACTOR);
  }

  return score;
}

/**
 * Sort tasks by descending rank score (most urgent first). Stable for tasks of
 * equal score; does not mutate the input array.
 */
export function sortByRank(tasks: Task[], now: Date = new Date()): Task[] {
  return [...tasks]
    .map((task, index) => ({ task, index, score: rankScore(task, now) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.task);
}
