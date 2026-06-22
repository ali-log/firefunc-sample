import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the singleton DB at a throwaway file BEFORE any module reads config.
const tmpDir = mkdtempSync(join(tmpdir(), "firefunc-seed-"));
process.env.DATABASE_PATH = join(tmpDir, "seed-test.db");
process.env.NODE_ENV = "test";

describe("db/seed", () => {
  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("migrates + seeds cleanly and returns realistic counts", async () => {
    const { seed } = await import("../src/db/seed.js");
    const { getDb, closeDb } = await import("../src/db/index.js");

    const result = seed();
    expect(result.users).toBeGreaterThanOrEqual(4);
    expect(result.projects).toBeGreaterThanOrEqual(2);
    expect(result.tasks).toBeGreaterThanOrEqual(8);

    // Spot-check the data actually landed and is queryable.
    const db = getDb();
    const taskRows = db.prepare("SELECT COUNT(*) AS n FROM tasks").get() as {
      n: number;
    };
    expect(taskRows.n).toBe(result.tasks);

    const doneRows = db
      .prepare("SELECT COUNT(*) AS n FROM tasks WHERE state = 'done'")
      .get() as { n: number };
    expect(doneRows.n).toBeGreaterThanOrEqual(1);

    closeDb();
  });

  it("is idempotent — re-running does not duplicate seed data", async () => {
    const { seed } = await import("../src/db/seed.js");
    const first = seed();
    const second = seed();
    expect(second).toEqual(first);
  });
});
