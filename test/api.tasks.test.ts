import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { uniqueEmail, useTempDatabase } from "./helpers.js";

const db = useTempDatabase();

let app: FastifyInstance;
let token: string;
let projectId: string;
let reporterId: string;
let assigneeId: string;

const authHeaders = () => ({ authorization: `Bearer ${token}` });

async function createTask(body: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: authHeaders(),
    payload: { projectId, reporterId, ...body },
  });
}

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
  reporterId = owner.json().id;

  const dev = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: authHeaders(),
    payload: { email: uniqueEmail("dev"), name: "Dev", role: "member" },
  });
  assigneeId = dev.json().id;

  const project = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers: authHeaders(),
    payload: { key: "FIRE", name: "FireFunc", ownerId: reporterId },
  });
  projectId = project.json().id;
});

afterAll(async () => {
  await app.close();
  db.cleanup();
});

describe("tasks API — CRUD", () => {
  it("creates a task with defaults", async () => {
    const res = await createTask({ title: "First task" });
    expect(res.statusCode).toBe(201);
    const task = res.json();
    expect(task.id).toBeTruthy();
    expect(task.state).toBe("todo");
    expect(task.priority).toBe("medium");
    expect(task.projectId).toBe(projectId);
    expect(task.labels).toEqual([]);
  });

  it("rejects create with a non-existent project (422)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: authHeaders(),
      payload: { projectId: "ghost", title: "x", reporterId },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("invalid_reference");
  });

  it("rejects create missing required fields (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: authHeaders(),
      payload: { projectId, title: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("validation_error");
  });

  it("rejects a whitespace-only title (400)", async () => {
    const res = await createTask({ title: "   " });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("validation_error");
  });

  it("requires auth to create", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      payload: { projectId, title: "x", reporterId },
    });
    expect(res.statusCode).toBe(401);
  });

  it("fetches and 404s correctly", async () => {
    const created = await createTask({ title: "Fetch me" });
    const id = created.json().id;
    const ok = await app.inject({ method: "GET", url: `/api/tasks/${id}` });
    expect(ok.statusCode).toBe(200);
    const miss = await app.inject({ method: "GET", url: "/api/tasks/nope" });
    expect(miss.statusCode).toBe(404);
  });

  it("updates labels, priority, and assignee", async () => {
    const created = await createTask({ title: "Mutate me" });
    const id = created.json().id;
    const res = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${id}`,
      headers: authHeaders(),
      payload: { priority: "urgent", assigneeId, labels: ["backend", "api"] },
    });
    expect(res.statusCode).toBe(200);
    const task = res.json();
    expect(task.priority).toBe("urgent");
    expect(task.assigneeId).toBe(assigneeId);
    expect(task.labels.sort()).toEqual(["api", "backend"]);
  });

  it("rejects empty patch body (400)", async () => {
    const created = await createTask({ title: "no-op" });
    const id = created.json().id;
    const res = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${id}`,
      headers: authHeaders(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("deletes a task", async () => {
    const created = await createTask({ title: "Delete me" });
    const id = created.json().id;
    const res = await app.inject({
      method: "DELETE",
      url: `/api/tasks/${id}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(204);
    const gone = await app.inject({ method: "GET", url: `/api/tasks/${id}` });
    expect(gone.statusCode).toBe(404);
  });
});

describe("tasks API — state machine", () => {
  it("allows a legal transition and sets completedAt on done", async () => {
    const created = await createTask({ title: "Workflow" });
    const id = created.json().id;

    const inProgress = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${id}`,
      headers: authHeaders(),
      payload: { state: "in_progress" },
    });
    expect(inProgress.statusCode).toBe(200);
    expect(inProgress.json().state).toBe("in_progress");

    const done = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${id}`,
      headers: authHeaders(),
      payload: { state: "done" },
    });
    expect(done.statusCode).toBe(200);
    expect(done.json().state).toBe("done");
    expect(done.json().completedAt).toBeTruthy();
  });

  it("rejects an illegal transition with 409", async () => {
    const created = await createTask({ title: "Blocked path" });
    const id = created.json().id;
    // todo -> done is legal; but blocked -> done is NOT in STATE_TRANSITIONS.
    await app.inject({
      method: "PATCH",
      url: `/api/tasks/${id}`,
      headers: authHeaders(),
      payload: { state: "blocked" },
    });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${id}`,
      headers: authHeaders(),
      payload: { state: "done" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("illegal_transition");
  });
});

describe("tasks API — filtering & pagination", () => {
  let filterProjectId: string;

  beforeAll(async () => {
    const project = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: authHeaders(),
      payload: { key: "FILT", name: "Filter Project", ownerId: reporterId },
    });
    filterProjectId = project.json().id;

    const make = (title: string, priority: string, labels: string[]) =>
      app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: authHeaders(),
        payload: { projectId: filterProjectId, reporterId, title, priority, labels },
      });

    await make("Urgent backend", "urgent", ["backend"]);
    await make("High frontend", "high", ["frontend"]);
    await make("Low backend", "low", ["backend"]);
    await make("Medium misc", "medium", []);
  });

  it("filters by priority", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/tasks?projectId=${filterProjectId}&priority=urgent,high`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.items.every((t: { priority: string }) =>
      ["urgent", "high"].includes(t.priority))).toBe(true);
  });

  it("filters by label", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/tasks?projectId=${filterProjectId}&labels=backend`,
    });
    expect(res.json().total).toBe(2);
  });

  it("free-text search matches the title", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/tasks?projectId=${filterProjectId}&search=frontend`,
    });
    expect(res.json().total).toBe(1);
    expect(res.json().items[0].title).toBe("High frontend");
  });

  it("supports the DSL `q` parameter", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/tasks?projectId=${filterProjectId}&q=${encodeURIComponent("priority:urgent label:backend")}`,
    });
    expect(res.json().total).toBe(1);
    expect(res.json().items[0].title).toBe("Urgent backend");
  });

  it("paginates with limit and offset", async () => {
    const page1 = await app.inject({
      method: "GET",
      url: `/api/tasks?projectId=${filterProjectId}&limit=2&offset=0&sort=title&order=asc`,
    });
    expect(page1.json().items).toHaveLength(2);
    expect(page1.json().total).toBe(4);
    expect(page1.json().limit).toBe(2);

    const page2 = await app.inject({
      method: "GET",
      url: `/api/tasks?projectId=${filterProjectId}&limit=2&offset=2&sort=title&order=asc`,
    });
    expect(page2.json().items).toHaveLength(2);
    expect(page2.json().offset).toBe(2);

    const ids1 = page1.json().items.map((t: { id: string }) => t.id);
    const ids2 = page2.json().items.map((t: { id: string }) => t.id);
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
  });

  it("rejects an out-of-range limit (400)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/tasks?projectId=${filterProjectId}&limit=9999`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("sorts by priority descending", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/tasks?projectId=${filterProjectId}&sort=priority&order=desc`,
    });
    const priorities = res.json().items.map((t: { priority: string }) => t.priority);
    expect(priorities[0]).toBe("urgent");
  });
});
