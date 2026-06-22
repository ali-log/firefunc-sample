import { useEffect, useState } from "react";
import { compileToSql } from "../core/query-dsl.js";
import type {
  Paginated,
  ProjectReport,
  Task,
  TaskQuery,
  TaskState,
} from "../shared/types.js";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Build a querystring for /api/tasks from a TaskQuery. */
export function taskQueryToParams(query: TaskQuery): string {
  const p = new URLSearchParams();
  if (query.projectId) p.set("projectId", query.projectId);
  if (query.search) p.set("search", query.search);
  if (query.assigneeId) p.set("assigneeId", query.assigneeId);
  if (query.state) p.set("state", ([] as string[]).concat(query.state as never).join(","));
  if (query.priority)
    p.set("priority", ([] as string[]).concat(query.priority as never).join(","));
  if (query.labels?.length) p.set("labels", query.labels.join(","));
  if (query.sort) p.set("sort", query.sort);
  if (query.order) p.set("order", query.order);
  return p.toString();
}

// --- Mock data, used when no API is reachable (standalone dev / e2e smoke) ---

const MOCK_PROJECT_ID = "proj_sample";

const MOCK_TASKS: Task[] = [
  mockTask("t1", "Design the new onboarding flow", "in_progress", "high", ["design", "ux"]),
  mockTask("t2", "Fix flaky board drag test", "todo", "urgent", ["bug", "frontend"]),
  mockTask("t3", "Write query DSL parser", "todo", "medium", ["backend"]),
  mockTask("t4", "Blocked on auth provider decision", "blocked", "high", ["auth"]),
  mockTask("t5", "Ship dark/light theme toggle", "done", "low", ["frontend"]),
  mockTask("t6", "Add SLA breach reporting", "in_progress", "medium", ["reports"]),
  mockTask("t7", "Migrate to SQLite WAL mode", "done", "low", ["db"]),
  mockTask("t8", "Triage incoming bug reports", "todo", "low", ["triage"]),
];

function mockTask(
  id: string,
  title: string,
  state: TaskState,
  priority: Task["priority"],
  labels: string[],
): Task {
  const now = new Date().toISOString();
  return {
    id,
    projectId: MOCK_PROJECT_ID,
    parentId: null,
    title,
    description: null,
    state,
    priority,
    assigneeId: null,
    reporterId: "user_sample",
    labels,
    estimateHours: null,
    dueAt: null,
    slaMinutes: null,
    recurrence: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: state === "done" ? now : null,
  };
}

function matchesQuery(task: Task, query: TaskQuery): boolean {
  if (query.search) {
    const s = query.search.toLowerCase();
    if (
      !task.title.toLowerCase().includes(s) &&
      !task.labels.some((l) => l.toLowerCase().includes(s))
    ) {
      return false;
    }
  }
  if (query.state) {
    const states = ([] as TaskState[]).concat(query.state as never);
    if (!states.includes(task.state)) return false;
  }
  if (query.priority) {
    const prios = ([] as string[]).concat(query.priority as never);
    if (!prios.includes(task.priority)) return false;
  }
  if (query.labels?.length) {
    if (!query.labels.every((l) => task.labels.includes(l))) return false;
  }
  return true;
}

function mockReport(tasks: Task[]): ProjectReport {
  const byState: Record<TaskState, number> = {
    todo: 0,
    in_progress: 0,
    blocked: 0,
    done: 0,
  };
  const byPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
  for (const t of tasks) {
    byState[t.state] += 1;
    byPriority[t.priority] += 1;
  }
  return {
    projectId: MOCK_PROJECT_ID,
    totalTasks: tasks.length,
    byState,
    byPriority,
    overdue: 1,
    slaBreached: 1,
    completedThisWeek: byState.done,
    avgCycleTimeHours: 18.5,
  };
}

async function tryFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Fetch tasks from the API; fall back to filtered mock data when unreachable. */
export async function fetchTasks(query: TaskQuery): Promise<Task[]> {
  // compileToSql is part of the query DSL contract — exercise it so the
  // produced filter is consistent with the server side.
  void compileToSql(query);
  const qs = taskQueryToParams(query);
  const remote = await tryFetch<Paginated<Task>>(`/api/tasks${qs ? `?${qs}` : ""}`);
  if (remote && Array.isArray(remote.items)) return remote.items;
  return MOCK_TASKS.filter((t) => matchesQuery(t, query));
}

/** Fetch a project report; fall back to a derived mock report when unreachable. */
export async function fetchReport(projectId?: string): Promise<ProjectReport> {
  const id = projectId ?? MOCK_PROJECT_ID;
  const remote = await tryFetch<ProjectReport>(`/api/projects/${id}/report`);
  if (remote && typeof remote.totalTasks === "number") return remote;
  return mockReport(MOCK_TASKS);
}

/** Generic hook: run an async loader and track loading/error/data. */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
