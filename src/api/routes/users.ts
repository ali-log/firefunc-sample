import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createUsersRepo } from "../../db/users-repo.js";
import { INVALID, notFound, requireAuth, sendError, validate } from "../http.js";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["owner", "admin", "member", "viewer"]).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    role: z.enum(["owner", "admin", "member", "viewer"]).optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field must be provided",
  });

/** Register user routes under /api/users. */
export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  const users = createUsersRepo();

  app.get("/api/users", async () => {
    const items = users.list();
    return { items, total: items.length };
  });

  app.get<{ Params: { id: string } }>("/api/users/:id", async (req, reply) => {
    const user = users.getById(req.params.id);
    if (!user) return notFound(reply, "user not found");
    return user;
  });

  app.post("/api/users", async (req, reply) => {
    const auth = requireAuth(req, reply);
    if (!auth) return reply;

    const input = validate(createUserSchema, req.body, reply);
    if (input === INVALID) return reply;

    if (users.getByEmail(input.email)) {
      return sendError(reply, 409, "conflict", `email ${input.email} already exists`);
    }

    const created = users.create(input);
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>("/api/users/:id", async (req, reply) => {
    const auth = requireAuth(req, reply);
    if (!auth) return reply;

    if (!users.getById(req.params.id)) return notFound(reply, "user not found");

    const patch = validate(updateUserSchema, req.body, reply);
    if (patch === INVALID) return reply;

    const updated = users.update(req.params.id, patch);
    if (!updated) return notFound(reply, "user not found");
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/api/users/:id", async (req, reply) => {
    const auth = requireAuth(req, reply);
    if (!auth) return reply;

    const ok = users.delete(req.params.id);
    if (!ok) return notFound(reply, "user not found");
    return reply.code(204).send();
  });

  // GET /api/me — current authenticated user context.
  app.get("/api/me", async (req, reply) => {
    const auth = requireAuth(req, reply);
    if (!auth) return reply;
    const user = users.getById(auth.userId);
    return { userId: auth.userId, role: auth.role, user: user ?? null };
  });
}
