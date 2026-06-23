import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createTasksRepo } from "../../db/tasks-repo.js";
import { createProjectsRepo } from "../../db/projects-repo.js";
import { effectiveSlaMinutes, slaDeadline } from "../../core/sla.js";
import { countTasksByState } from "../../core/task-stats.js";
import { PRIORITIES } from "../../shared/constants.js";
import type {
  BurndownPoint,
  Priority,
  ProjectReport,
  Task,
} from "../../shared/types.js";
import { INVALID, notFound, validate } from "../http.js";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Load every task in a project (paging past the page cap). */
function allProjectTasks(
  tasks: ReturnType<typeof createTasksRepo>,
  projectId: string,
): Task[] {
  const out: Task[] = [];
  let offset = 0;
  const limit = 200;
  for (;;) {
    const page = tasks.list({ projectId, limit, offset });
    out.push(...page.items);
    offset += page.items.length;
    if (page.items.length < limit || offset >= page.total) break;
  }
  return out;
}

function emptyByPriority(): Record<Priority, number> {
  const r = {} as Record<Priority, number>;
  for (const p of PRIORITIES) r[p] = 0;
  return r;
}

/** Compute a project rollup report from its task set. */
export function buildProjectReport(
  projectId: string,
  tasks: Task[],
  now: Date = new Date(),
): ProjectReport {
  const byState = countTasksByState(tasks);
  const byPriority = emptyByPriority();
  let overdue = 0;
  let slaBreached = 0;
  let completedThisWeek = 0;
  let cycleSum = 0;
  let cycleCount = 0;

  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);

  for (const t of tasks) {
    byPriority[t.priority] += 1;

    const open = t.state !== "done";

    if (open && t.dueAt && new Date(t.dueAt).getTime() < now.getTime()) {
      overdue += 1;
    }

    if (open) {
      const minutes = effectiveSlaMinutes(t.slaMinutes, t.priority);
      const deadline = slaDeadline(new Date(t.createdAt), minutes);
      if (deadline.getTime() < now.getTime()) slaBreached += 1;
    }

    if (t.state === "done" && t.completedAt) {
      const completedAt = new Date(t.completedAt);
      if (completedAt.getTime() >= weekAgo.getTime()) completedThisWeek += 1;
      const hours =
        (completedAt.getTime() - new Date(t.createdAt).getTime()) / MS_PER_HOUR;
      if (hours >= 0) {
        cycleSum += hours;
        cycleCount += 1;
      }
    }
  }

  return {
    projectId,
    totalTasks: tasks.length,
    byState,
    byPriority,
    overdue,
    slaBreached,
    completedThisWeek,
    avgCycleTimeHours:
      cycleCount > 0 ? Math.round((cycleSum / cycleCount) * 100) / 100 : null,
  };
}

/** Build a daily burndown series over the trailing `days` window. */
export function buildBurndown(
  tasks: Task[],
  days: number,
  now: Date = new Date(),
): BurndownPoint[] {
  const points: BurndownPoint[] = [];
  const total = tasks.length;

  for (let d = days - 1; d >= 0; d--) {
    const dayEnd = new Date(now.getTime() - d * MS_PER_DAY);
    const cutoff = dayEnd.getTime();

    let completed = 0;
    let createdByThen = 0;
    for (const t of tasks) {
      if (new Date(t.createdAt).getTime() <= cutoff) createdByThen += 1;
      if (
        t.state === "done" &&
        t.completedAt &&
        new Date(t.completedAt).getTime() <= cutoff
      ) {
        completed += 1;
      }
    }
    const remaining = Math.max(createdByThen - completed, 0);
    points.push({
      date: dayEnd.toISOString().slice(0, 10),
      remaining,
      completed,
    });
  }

  // Suppress unused-var lint for total while keeping the symbol meaningful.
  void total;
  return points;
}

const burndownQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

/** Register reporting/analytics routes under /api/reports. */
export async function registerReportRoutes(
  app: FastifyInstance,
): Promise<void> {
  const tasks = createTasksRepo();
  const projects = createProjectsRepo();

  // GET /api/reports/project/:id — rollup summary for one project.
  app.get<{ Params: { id: string } }>(
    "/api/reports/project/:id",
    async (req, reply) => {
      if (!projects.getById(req.params.id)) {
        return notFound(reply, "project not found");
      }
      const projectTasks = allProjectTasks(tasks, req.params.id);
      return buildProjectReport(req.params.id, projectTasks);
    },
  );

  // GET /api/reports/burndown/:id?days=14 — daily remaining/completed series.
  app.get<{ Params: { id: string } }>(
    "/api/reports/burndown/:id",
    async (req, reply) => {
      if (!projects.getById(req.params.id)) {
        return notFound(reply, "project not found");
      }
      const query = validate(burndownQuerySchema, req.query, reply);
      if (query === INVALID) return reply;

      const projectTasks = allProjectTasks(tasks, req.params.id);
      const points = buildBurndown(projectTasks, query.days);
      return { projectId: req.params.id, days: query.days, points };
    },
  );
}
