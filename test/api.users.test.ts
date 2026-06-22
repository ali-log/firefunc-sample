import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { uniqueEmail, useTempDatabase } from "./helpers.js";

const db = useTempDatabase();

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  const { buildServer } = await import("../src/api/server.js");
  const { signToken } = await import("../src/api/auth.js");
  app = await buildServer();
  await app.ready();
  token = signToken({ userId: "bootstrap-admin", role: "admin" });
});

afterAll(async () => {
  await app.close();
  db.cleanup();
});

const authHeaders = () => ({ authorization: `Bearer ${token}` });

describe("users API", () => {
  it("rejects unauthenticated create with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { email: uniqueEmail(), name: "Nobody" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("unauthorized");
  });

  it("rejects invalid email with 400 validation error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: authHeaders(),
      payload: { email: "not-an-email", name: "Bad" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe("validation_error");
    expect(Array.isArray(body.details)).toBe(true);
  });

  it("creates, fetches, lists, updates, and deletes a user", async () => {
    const email = uniqueEmail("alice");
    const created = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: authHeaders(),
      payload: { email, name: "Alice", role: "member" },
    });
    expect(created.statusCode).toBe(201);
    const user = created.json();
    expect(user.id).toBeTruthy();
    expect(user.email).toBe(email);
    expect(user.role).toBe("member");

    const fetched = await app.inject({ method: "GET", url: `/api/users/${user.id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().id).toBe(user.id);

    const list = await app.inject({ method: "GET", url: "/api/users" });
    expect(list.statusCode).toBe(200);
    expect(list.json().items.some((u: { id: string }) => u.id === user.id)).toBe(true);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/users/${user.id}`,
      headers: authHeaders(),
      payload: { role: "admin", name: "Alice Cooper" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().role).toBe("admin");
    expect(patched.json().name).toBe("Alice Cooper");

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/users/${user.id}`,
      headers: authHeaders(),
    });
    expect(removed.statusCode).toBe(204);

    const gone = await app.inject({ method: "GET", url: `/api/users/${user.id}` });
    expect(gone.statusCode).toBe(404);
  });

  it("rejects duplicate email with 409", async () => {
    const email = uniqueEmail("dup");
    const payload = { email, name: "Dup" };
    const first = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: authHeaders(),
      payload,
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: authHeaders(),
      payload,
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("conflict");
  });

  it("returns the auth context from /api/me", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().userId).toBe("bootstrap-admin");
    expect(res.json().role).toBe("admin");
  });

  it("rejects /api/me without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/me" });
    expect(res.statusCode).toBe(401);
  });

  it("ignores an invalid bearer token (treated as anonymous)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer garbage.token.here" },
    });
    expect(res.statusCode).toBe(401);
  });
});
