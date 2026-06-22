import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createProjectsRepo } from "../../db/projects-repo.js";
import { createUsersRepo } from "../../db/users-repo.js";
import { PROJECT_KEY_PATTERN } from "../../shared/constants.js";
import { INVALID, notFound, requireAuth, sendError, validate } from "../http.js";

const createProjectSchema = z.object({
  key: z
    .string()
    .regex(PROJECT_KEY_PATTERN, "key must match /^[A-Z][A-Z0-9]{1,9}$/"),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  ownerId: z.string().min(1),
});

const updateProjectSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: z.enum(["active", "archived"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field must be provided",
  });

/** Register project CRUD routes under /api/projects. */
export async function registerProjectRoutes(
  app: FastifyInstance,
): Promise<void> {
  const projects = createProjectsRepo();
  const users = createUsersRepo();

  app.get("/api/projects", async () => {
    const items = projects.list();
    return { items, total: items.length };
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const project = projects.getById(req.params.id);
    if (!project) return notFound(reply, "project not found");
    return project;
  });

  app.post("/api/projects", async (req, reply) => {
    const auth = requireAuth(req, reply);
    if (!auth) return reply;

    const input = validate(createProjectSchema, req.body, reply);
    if (input === INVALID) return reply;

    if (projects.getByKey(input.key)) {
      return sendError(reply, 409, "conflict", `project key ${input.key} already exists`);
    }
    if (!users.getById(input.ownerId)) {
      return sendError(reply, 422, "invalid_reference", "ownerId does not exist");
    }

    const created = projects.create(input);
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>(
    "/api/projects/:id",
    async (req, reply) => {
      const auth = requireAuth(req, reply);
      if (!auth) return reply;

      if (!projects.getById(req.params.id)) {
        return notFound(reply, "project not found");
      }

      const patch = validate(updateProjectSchema, req.body, reply);
      if (patch === INVALID) return reply;

      const updated = projects.update(req.params.id, patch);
      if (!updated) return notFound(reply, "project not found");
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/projects/:id",
    async (req, reply) => {
      const auth = requireAuth(req, reply);
      if (!auth) return reply;

      const ok = projects.delete(req.params.id);
      if (!ok) return notFound(reply, "project not found");
      return reply.code(204).send();
    },
  );
}
