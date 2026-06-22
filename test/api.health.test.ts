import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { useTempDatabase } from "./helpers.js";

const db = useTempDatabase();

let app: FastifyInstance;

beforeAll(async () => {
  const { buildServer } = await import("../src/api/server.js");
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  db.cleanup();
});

describe("GET /health", () => {
  it("returns ok with service metadata", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("firefunc-sample");
    expect(typeof body.time).toBe("string");
  });

  it("returns a structured 404 for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe("not_found");
    expect(body.statusCode).toBe(404);
  });
});
