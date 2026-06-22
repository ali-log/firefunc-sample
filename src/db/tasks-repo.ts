import { randomUUID } from "node:crypto";
import type { DB } from "./index.js";
import { getDb } from "./index.js";
import type {
  CreateTaskInput,
  ISODateString,
  Paginated,
  Priority,
  RecurrenceRule,
  Task,
  TaskQuery,
  TaskSortField,
  TaskState,
  UpdateTaskInput,
} from "../shared/types.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../shared/constants.js";

/** Build a parameterized WHERE clause + params from a TaskQuery. Self-contained
 *  so the repo does not depend on the (separately-owned) query-dsl compiler. */
function buildWhere(query: TaskQuery): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (query.projectId) {
    clauses.push("project_id = ?");
    params.push(query.projectId);
  }
  if (query.state !== undefined) {
    const states = Array.isArray(query.state) ? query.state : [query.state];
    if (states.length > 0) {
      clauses.push(`state IN (${states.map(() => "?").join(", ")})`);
      params.push(...states);
    }
  }
  if (query.priority !== undefined) {
    const prios = Array.isArray(query.priority)
      ? query.priority
      : [query.priority];
    if (prios.length > 0) {
      clauses.push(`priority IN (${prios.map(() => "?").join(", ")})`);
      params.push(...prios);
    }
  }
  if (query.assigneeId !== undefined) {
    if (query.assigneeId === null) {
      clauses.push("assignee_id IS NULL");
    } else {
      clauses.push("assignee_id = ?");
      params.push(query.assigneeId);
    }
  }
  if (query.search) {
    clauses.push("(title LIKE ? OR description LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like);
  }
  if (query.dueBefore) {
    clauses.push("(due_at IS NOT NULL AND due_at < ?)");
    params.push(query.dueBefore);
  }
  if (query.dueAfter) {
    clauses.push("(due_at IS NOT NULL AND due_at > ?)");
    params.push(query.dueAfter);
  }
  if (query.labels && query.labels.length > 0) {
    // Task must carry every requested label.
    clauses.push(
      `id IN (
         SELECT tl.task_id FROM task_labels tl
         JOIN labels l ON l.id = tl.label_id
         WHERE l.name IN (${query.labels.map(() => "?").join(", ")})
         GROUP BY tl.task_id
         HAVING COUNT(DISTINCT l.name) = ?
       )`,
    );
    params.push(...query.labels, query.labels.length);
  }

  return { where: clauses.length > 0 ? clauses.join(" AND ") : "1 = 1", params };
}

export interface TasksRepo {
  create(input: CreateTaskInput): Task;
  getById(id: string): Task | null;
  update(id: string, patch: UpdateTaskInput): Task | null;
  delete(id: string): boolean;
  list(query: TaskQuery): Paginated<Task>;
  countByState(projectId: string): Record<string, number>;
}

interface TaskRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  state: string;
  priority: string;
  assignee_id: string | null;
  reporter_id: string;
  estimate_hours: number | null;
  due_at: string | null;
  sla_minutes: number | null;
  recurrence: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function nowIso(): ISODateString {
  return new Date().toISOString();
}

/** Map a SQL column → ORDER BY expression for a sortable field. */
const SORT_COLUMNS: Record<TaskSortField, string> = {
  priority:
    "CASE priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END",
  dueAt: "due_at",
  createdAt: "created_at",
  updatedAt: "updated_at",
  position: "position",
  title: "title",
};

function mapTask(row: TaskRow, labels: string[]): Task {
  let recurrence: RecurrenceRule | null = null;
  if (row.recurrence) {
    try {
      recurrence = JSON.parse(row.recurrence) as RecurrenceRule;
    } catch {
      recurrence = null;
    }
  }
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    state: row.state as TaskState,
    priority: row.priority as Priority,
    assigneeId: row.assignee_id,
    reporterId: row.reporter_id,
    labels,
    estimateHours: row.estimate_hours,
    dueAt: row.due_at,
    slaMinutes: row.sla_minutes,
    recurrence,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

/** Construct a tasks repository bound to a DB connection. */
export function createTasksRepo(db: DB = getDb()): TasksRepo {
  /** Ensure a label row exists for `name` and return its id. */
  function ensureLabel(name: string): string {
    const existing = db
      .prepare("SELECT id FROM labels WHERE name = ?")
      .get(name) as { id: string } | undefined;
    if (existing) return existing.id;
    const id = randomUUID();
    db.prepare("INSERT INTO labels (id, name, color) VALUES (?, ?, NULL)").run(
      id,
      name,
    );
    return id;
  }

  /** Replace the full label set attached to a task. */
  function setLabels(taskId: string, labels: string[]): void {
    db.prepare("DELETE FROM task_labels WHERE task_id = ?").run(taskId);
    const link = db.prepare(
      "INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)",
    );
    for (const name of labels) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      link.run(taskId, ensureLabel(trimmed));
    }
  }

  /** Load the label names attached to a task, sorted for determinism. */
  function labelsFor(taskId: string): string[] {
    const rows = db
      .prepare(
        `SELECT l.name AS name FROM task_labels tl
         JOIN labels l ON l.id = tl.label_id
         WHERE tl.task_id = ? ORDER BY l.name ASC`,
      )
      .all(taskId) as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }

  /** Next free board position within a project (append to the end). */
  function nextPosition(projectId: string): number {
    const row = db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) AS maxPos FROM tasks WHERE project_id = ?",
      )
      .get(projectId) as { maxPos: number };
    return row.maxPos + 1;
  }

  const repo: TasksRepo = {
    create(input: CreateTaskInput): Task {
      const title = (input.title ?? "").trim();
      if (!title) {
        throw new Error("task title must not be empty");
      }
      const id = randomUUID();
      const ts = nowIso();
      const row: TaskRow = {
        id,
        project_id: input.projectId,
        parent_id: input.parentId ?? null,
        title,
        description: input.description ?? null,
        state: "todo",
        priority: input.priority ?? "medium",
        assignee_id: input.assigneeId ?? null,
        reporter_id: input.reporterId,
        estimate_hours: input.estimateHours ?? null,
        due_at: input.dueAt ?? null,
        sla_minutes: input.slaMinutes ?? null,
        recurrence: input.recurrence ? JSON.stringify(input.recurrence) : null,
        position: nextPosition(input.projectId),
        created_at: ts,
        updated_at: ts,
        completed_at: null,
      };
      const labels = input.labels ?? [];
      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO tasks
             (id, project_id, parent_id, title, description, state, priority,
              assignee_id, reporter_id, estimate_hours, due_at, sla_minutes,
              recurrence, position, created_at, updated_at, completed_at)
           VALUES
             (@id, @project_id, @parent_id, @title, @description, @state, @priority,
              @assignee_id, @reporter_id, @estimate_hours, @due_at, @sla_minutes,
              @recurrence, @position, @created_at, @updated_at, @completed_at)`,
        ).run(row);
        setLabels(id, labels);
      });
      tx();
      return mapTask(row, [...labels].map((l) => l.trim()).filter(Boolean).sort());
    },

    getById(id: string): Task | null {
      const row = db
        .prepare("SELECT * FROM tasks WHERE id = ?")
        .get(id) as TaskRow | undefined;
      return row ? mapTask(row, labelsFor(id)) : null;
    },

    update(id: string, patch: UpdateTaskInput): Task | null {
      const existing = repo.getById(id);
      if (!existing) return null;

      const sets: string[] = [];
      const params: Record<string, unknown> = { id };

      const assign = (col: string, key: string, value: unknown): void => {
        sets.push(`${col} = @${key}`);
        params[key] = value;
      };

      if (patch.title !== undefined) assign("title", "title", patch.title);
      if (patch.description !== undefined)
        assign("description", "description", patch.description);
      if (patch.priority !== undefined)
        assign("priority", "priority", patch.priority);
      if (patch.assigneeId !== undefined)
        assign("assignee_id", "assignee_id", patch.assigneeId);
      if (patch.estimateHours !== undefined)
        assign("estimate_hours", "estimate_hours", patch.estimateHours);
      if (patch.dueAt !== undefined) assign("due_at", "due_at", patch.dueAt);
      if (patch.slaMinutes !== undefined)
        assign("sla_minutes", "sla_minutes", patch.slaMinutes);
      if (patch.recurrence !== undefined)
        assign(
          "recurrence",
          "recurrence",
          patch.recurrence ? JSON.stringify(patch.recurrence) : null,
        );
      if (patch.position !== undefined)
        assign("position", "position", patch.position);

      if (patch.state !== undefined) {
        assign("state", "state", patch.state);
        // Maintain completed_at in step with the state.
        if (patch.state === "done" && existing.state !== "done") {
          assign("completed_at", "completed_at", nowIso());
        } else if (patch.state !== "done" && existing.state === "done") {
          assign("completed_at", "completed_at", null);
        }
      }

      const ts = nowIso();
      assign("updated_at", "updated_at", ts);

      const tx = db.transaction(() => {
        if (sets.length > 0) {
          db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = @id`).run(
            params,
          );
        }
        if (patch.labels !== undefined) setLabels(id, patch.labels);
      });
      tx();
      return repo.getById(id);
    },

    delete(id: string): boolean {
      const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      return info.changes > 0;
    },

    list(query: TaskQuery): Paginated<Task> {
      const { where, params } = buildWhere(query);

      const limit = Math.min(
        Math.max(query.limit ?? DEFAULT_PAGE_LIMIT, 1),
        MAX_PAGE_LIMIT,
      );
      const offset = Math.max(query.offset ?? 0, 0);

      const sortField: TaskSortField = query.sort ?? "position";
      const sortExpr = SORT_COLUMNS[sortField] ?? SORT_COLUMNS.position;
      const order = query.order === "desc" ? "DESC" : "ASC";

      const total = (
        db
          .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE ${where}`)
          .get(...params) as { n: number }
      ).n;

      const rows = db
        .prepare(
          `SELECT * FROM tasks WHERE ${where}
           ORDER BY ${sortExpr} ${order}, id ASC
           LIMIT ? OFFSET ?`,
        )
        .all(...params, limit, offset) as TaskRow[];

      const items = rows.map((row) => mapTask(row, labelsFor(row.id)));
      return { items, total, limit, offset };
    },

    countByState(projectId: string): Record<string, number> {
      const rows = db
        .prepare(
          "SELECT state, COUNT(*) AS n FROM tasks WHERE project_id = ? GROUP BY state",
        )
        .all(projectId) as Array<{ state: string; n: number }>;
      const out: Record<string, number> = {
        todo: 0,
        in_progress: 0,
        blocked: 0,
        done: 0,
      };
      for (const r of rows) out[r.state] = r.n;
      return out;
    },
  };

  return repo;
}
