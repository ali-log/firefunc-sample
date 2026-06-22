import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { uniqueEmail, useTempDatabase } from "./helpers.js";

const db = useTempDatabase();

let app: FastifyInstance;
let token: string;
let projectId: string;
let reporterId: string;

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
  reporterId = owner.json().id;

  const project = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers: authHeaders(),
    payload: { key: "RPT", name: "Reports", ownerId: reporterId },
  });
  projectId = project.json().id;

  const make = (title: string, priority: string) =>
    app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: authHeaders(),
      payload: { projectId, reporterId, title, priority },
    });

  // 1 done, 1 in_progress, 2 todo, with an overdue todo.
  const done = await make("Done task", "high");
  await app.inject({
    method: "PATCH",
    url: `/api/tasks/${done.json().id}`,
    headers: authHeaders(),
    payload: { state: "done" },
  });

  const wip = await make("WIP task", "urgent");
  await app.inject({
    method: "PATCH",
    url: `/api/tasks/${wip.json().id}`,
    headers: authHeaders(),
    payload: { state: "in_progress" },
  });

  await make("Todo task", "low");

  const overdue = await make("Overdue task", "medium");
  await app.inject({
    method: "PATCH",
    url: `/api/tasks/${overdue.json().id}`,
    headers: authHeaders(),
    payload: { dueAt: new Date(Date.now() - 86_400_000).toISOString() },
  });
});

afterAll(async () => {
  await app.close();
  db.cleanup();
});

describe("reports API", () => {
  it("returns a project rollup report", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/reports/project/${projectId}`,
    });
    expect(res.statusCode).toBe(200);
    const report = res.json();
    expect(report.projectId).toBe(projectId);
    expect(report.totalTasks).toBe(4);
    expect(report.byState.done).toBe(1);
    expect(report.byState.in_progress).toBe(1);
    expect(report.byState.todo).toBe(2);
    expect(report.byPriority.urgent).toBe(1);
    expect(report.overdue).toBe(1);
    // The done task has a completedAt within the last week.
    expect(report.completedThisWeek).toBe(1);
    expect(report.avgCycleTimeHours).not.toBeNull();
  });

  it("404s a report for an unknown project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/reports/project/ghost",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns a burndown series", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/reports/burndown/${projectId}?days=7`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projectId).toBe(projectId);
    expect(body.points).toHaveLength(7);
    const last = body.points[body.points.length - 1];
    expect(typeof last.date).toBe("string");
    expect(typeof last.remaining).toBe("number");
    expect(typeof last.completed).toBe("number");
  });

  it("rejects an out-of-range days param (400)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/reports/burndown/${projectId}?days=500`,
    });
    expect(res.statusCode).toBe(400);
  });
});
