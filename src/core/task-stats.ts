import { TASK_STATES } from "../shared/constants.js";
import type { Task, TaskState } from "../shared/types.js";

/**
 * Count tasks grouped by their state.
 *
 * Returns a complete `Record<TaskState, number>` with an entry for every state
 * (todo/in_progress/blocked/done), defaulting to 0 so callers never have to
 * guard against missing keys. An empty input yields all-zero counts.
 */
export function countTasksByState(tasks: Task[]): Record<TaskState, number> {
  const counts = {} as Record<TaskState, number>;
  for (const s of TASK_STATES) counts[s] = 0;
  for (const t of tasks) counts[t.state] += 1;
  return counts;
}
