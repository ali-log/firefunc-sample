import type { Task } from "../shared/types.js";

/**
 * Whether a task is overdue at a given moment.
 *
 * A task is overdue when it has a `dueAt` in the past AND it is not yet done.
 * Tasks without a `dueAt`, tasks whose `dueAt` is still in the future, and
 * `done` tasks are never overdue.
 */
export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.state === "done" || !task.dueAt) {
    return false;
  }
  const dueMs = new Date(task.dueAt).getTime();
  if (Number.isNaN(dueMs)) {
    return false;
  }
  return dueMs < now.getTime();
}
