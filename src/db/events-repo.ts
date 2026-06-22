import type { DB } from "./index.js";
import { getDb } from "./index.js";
import type { TaskEvent, TaskState } from "../shared/types.js";

interface TaskEventRow {
  id: string;
  task_id: string;
  actor_id: string;
  type: string;
  from_state: string | null;
  to_state: string | null;
  payload: string | null;
  created_at: string;
}

function mapEvent(row: TaskEventRow): TaskEvent {
  let payload: Record<string, unknown> | null = null;
  if (row.payload) {
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }
  return {
    id: row.id,
    taskId: row.task_id,
    actorId: row.actor_id,
    type: row.type as TaskEvent["type"],
    fromState: row.from_state as TaskState | null,
    toState: row.to_state as TaskState | null,
    payload,
    createdAt: row.created_at,
  };
}

export interface EventsRepo {
  /** Event history for a task, oldest first (createdAt ascending). */
  listByTask(taskId: string): TaskEvent[];
}

/** Construct an events repository bound to a DB connection. */
export function createEventsRepo(db: DB = getDb()): EventsRepo {
  const repo: EventsRepo = {
    listByTask(taskId: string): TaskEvent[] {
      const rows = db
        .prepare(
          "SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at ASC, id ASC",
        )
        .all(taskId) as TaskEventRow[];
      return rows.map(mapEvent);
    },
  };
  return repo;
}
