import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createTasksRepo } from "../../db/tasks-repo.js";
import { createProjectsRepo } from "../../db/projects-repo.js";
import { createEventsRepo } from "../../db/events-repo.js";
import { parseQuery, toTaskQuery } from "../../core/query-dsl.js";
import { canTransition } from "../../core/state-machine.js";
import {
  PRIORITIES,
  TASK_STATES,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "../../shared/constants.js";
import type { TaskQuery, TaskSortField } from "../../shared/types.js";
import { INVALID, notFound, requireAuth, sendError, validate } from "../http.js";

const recurrenceSchema = z.object({
  freq: z.enum(["none", "daily", "weekly", "monthly"]),
  interval: z.number().int().positive(),
  count: z.number().int().positive().nullable(),
  until: z.string().nullable(),
});

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigneeId: z.string().nullable().optional(),
  reporterId: z.string().min(1),
  labels: z.array(z.string()).optional(),
  estimateHours: z.number().nonnegative().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  slaMinutes: z.number().int().positive().nullable().optional(),
  recurrence: recurrenceSchema.nullable().optional(),
  parentId: z.string().nullable().optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    state: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assigneeId: z.string().nullable().optional(),
    labels: z.array(z.string()).optional(),
    estimateHours: z.number().nonnegative().nullable().optional(),
    dueAt: z.string().nullable().optional(),
    slaMinutes: z.number().int().positive().nullable().optional(),
    recurrence: recurrenceSchema.nullable().optional(),
    position: z.number().int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field must be provided",
  });

const csvToArray = (v: unknown): unknown =>
  typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v;

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  state: z.preprocess(csvToArray, z.array(z.enum(TASK_STATES as unknown as [string, ...string[]])).optional()),
  priority: z.preprocess(csvToArray, z.array(z.enum(PRIORITIES as unknown as [string, ...string[]])).optional()),
  assigneeId: z.string().optional(),
  labels: z.preprocess(csvToArray, z.array(z.string()).optional()),
  search: z.string().optional(),
  q: z.string().optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
  sort: z
    .enum(["priority", "dueAt", "createdAt", "updatedAt", "position", "title"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Register task CRUD + filter routes under /api/tasks. */
export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
  const tasks = createTasksRepo();
  const projects = createProjectsRepo();
  const events = createEventsRepo();

  // GET /api/tasks — list with structured filters + DSL free-text search.
  app.get("/api/tasks", async (req, reply) => {
    const parsed = validate(listQuerySchema, req.query, reply);
    if (parsed === INVALID) return reply;

    // Start from the structured query params.
    const query: TaskQuery = {
      sort: parsed.sort as TaskSortField | undefined,
      order: parsed.order,
      limit: parsed.limit,
      offset: parsed.offset,
    };
    if (parsed.projectId) query.projectId = parsed.projectId;
    if (parsed.state) query.state = parsed.state as TaskQuery["state"];
    if (parsed.priority) query.priority = parsed.priority as TaskQuery["priority"];
    if (parsed.assigneeId) {
      query.assigneeId =
        parsed.assigneeId === "none" || parsed.assigneeId === "null"
          ? null
          : parsed.assigneeId;
    }
    if (parsed.labels && parsed.labels.length > 0) query.labels = parsed.labels;
    if (parsed.search) query.search = parsed.search;
    if (parsed.dueBefore) query.dueBefore = parsed.dueBefore;
    if (parsed.dueAfter) query.dueAfter = parsed.dueAfter;

    // Overlay the `q` DSL string (e.g. `state:in_progress priority:high "text"`).
    if (parsed.q) {
      const dsl = toTaskQuery(parseQuery(parsed.q));
      if (dsl.projectId && !query.projectId) query.projectId = dsl.projectId;
      if (dsl.state && query.state === undefined) query.state = dsl.state;
      if (dsl.priority && query.priority === undefined) query.priority = dsl.priority;
      if (dsl.assigneeId !== undefined && query.assigneeId === undefined)
        query.assigneeId = dsl.assigneeId;
      if (dsl.labels) query.labels = [...(query.labels ?? []), ...dsl.labels];
      if (dsl.dueBefore && !query.dueBefore) query.dueBefore = dsl.dueBefore;
      if (dsl.dueAfter && !query.dueAfter) query.dueAfter = dsl.dueAfter;
      if (dsl.search) {
        query.search = query.search ? `${query.search} ${dsl.search}` : dsl.search;
      }
    }

    return tasks.list(query);
  });

  // GET /api/tasks/:id
  app.get<{ Params: { id: string } }>("/api/tasks/:id", async (req, reply) => {
    const task = tasks.getById(req.params.id);
    if (!task) return notFound(reply, "task not found");
    return task;
  });

  // GET /api/tasks/:id/events — task event history, oldest first.
  app.get<{ Params: { id: string } }>(
    "/api/tasks/:id/events",
    async (req, reply) => {
      if (!tasks.getById(req.params.id)) return notFound(reply, "task not found");
      return events.listByTask(req.params.id);
    },
  );

  // POST /api/tasks
  app.post("/api/tasks", async (req, reply) => {
    const auth = requireAuth(req, reply);
    if (!auth) return reply;

    const input = validate(createTaskSchema, req.body, reply);
    if (input === INVALID) return reply;

    if (!projects.getById(input.projectId)) {
      return sendError(reply, 422, "invalid_reference", "projectId does not exist");
    }
    if (input.parentId && !tasks.getById(input.parentId)) {
      return sendError(reply, 422, "invalid_reference", "parentId does not exist");
    }

    const created = tasks.create(input);
    return reply.code(201).send(created);
  });

  // PATCH /api/tasks/:id
  app.patch<{ Params: { id: string } }>("/api/tasks/:id", async (req, reply) => {
    const auth = requireAuth(req, reply);
    if (!auth) return reply;

    const existing = tasks.getById(req.params.id);
    if (!existing) return notFound(reply, "task not found");

    const patch = validate(updateTaskSchema, req.body, reply);
    if (patch === INVALID) return reply;

    if (patch.state && patch.state !== existing.state) {
      if (!canTransition(existing.state, patch.state)) {
        return sendError(
          reply,
          409,
          "illegal_transition",
          `cannot move task from ${existing.state} to ${patch.state}`,
        );
      }
    }

    const updated = tasks.update(req.params.id, patch);
    if (!updated) return notFound(reply, "task not found");
    return updated;
  });

  // DELETE /api/tasks/:id
  app.delete<{ Params: { id: string } }>("/api/tasks/:id", async (req, reply) => {
    const auth = requireAuth(req, reply);
    if (!auth) return reply;

    const ok = tasks.delete(req.params.id);
    if (!ok) return notFound(reply, "task not found");
    return reply.code(204).send();
  });
}
