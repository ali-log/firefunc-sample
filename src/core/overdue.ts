import type { Task } from "../shared/types.js";

/**
 * Whether a task is overdue at a given moment.
 *
 * A task is overdue when it has a `dueAt` strictly in the past AND it is not
 * yet terminal (`done`). Tasks with no `dueAt`, an unparseable `dueAt`, a
 * future/now `dueAt`, or a `done` state are not overdue.
 */
export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.state === "done") return false;
  if (!task.dueAt) return false;

  const due = new Date(task.dueAt).getTime();
  if (Number.isNaN(due)) return false;

  return due < now.getTime();
}
