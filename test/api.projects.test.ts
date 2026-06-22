import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { uniqueEmail, useTempDatabase } from "./helpers.js";

const db = useTempDatabase();

let app: FastifyInstance;
let token: string;
let ownerId: string;

const authHeaders = () => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  const { buildServer } = await import("../src/api/server.js");
  const { signToken } = await import("../src/api/auth.js");
  app = await buildServer();
  await app.ready();
  token = signToken({ userId: "admin", role: "admin" });

  const owner = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: authHeaders(),
    payload: { email: uniqueEmail("owner"), name: "Owner", role: "owner" },
  });
  ownerId = owner.json().id;
});

afterAll(async () => {
  await app.close();
  db.cleanup();
});

describe("projects API", () => {
  it("rejects a bad project key with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: authHeaders(),
      payload: { key: "lowercase", name: "Bad", ownerId },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("validation_error");
  });

  it("rejects a non-existent owner with 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: authHeaders(),
      payload: { key: "GHOST", name: "No Owner", ownerId: "does-not-exist" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("invalid_reference");
  });

  it("creates, fetches, lists, and updates a project", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: authHeaders(),
      payload: { key: "FIRE", name: "FireFunc", description: "core", ownerId },
    });
    expect(created.statusCode).toBe(201);
    const project = created.json();
    expect(project.key).toBe("FIRE");
    expect(project.status).toBe("active");

    const fetched = await app.inject({ method: "GET", url: `/api/projects/${project.id}` });
    expect(fetched.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/projects" });
    expect(list.json().items.length).toBeGreaterThanOrEqual(1);

    const archived = await app.inject({
      method: "PATCH",
      url: `/api/projects/${project.id}`,
      headers: authHeaders(),
      payload: { status: "archived" },
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json().status).toBe("archived");
  });

  it("rejects a duplicate key with 409", async () => {
    await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: authHeaders(),
      payload: { key: "OPS", name: "Ops", ownerId },
    });
    const dup = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: authHeaders(),
      payload: { key: "OPS", name: "Ops 2", ownerId },
    });
    expect(dup.statusCode).toBe(409);
  });

  it("404s an unknown project", async () => {
    const res = await app.inject({ method: "GET", url: "/api/projects/nope" });
    expect(res.statusCode).toBe(404);
  });

  it("requires auth to create", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { key: "NOAUTH", name: "x", ownerId },
    });
    expect(res.statusCode).toBe(401);
  });
});
